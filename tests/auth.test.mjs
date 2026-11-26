import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
let api, directory;
const key = "__zekindoAuthSecurity";
before(async () => {
  directory = await mkdtemp(path.resolve("node_modules/.auth-tests-"));
  const mocks = {
    "server-only": "",
    react: "export const cache=fn=>fn;",
    "next/navigation":
      "export function redirect(path){throw new Error('REDIRECT:'+path);}",
    "next/headers": `export async function headers(){return new Headers({'x-workspace-path':globalThis.${key}.path});}export async function cookies(){return {get(){return {value:globalThis.${key}.token};},set(name,value,options){globalThis.${key}.cookie={name,value,options};},delete(){globalThis.${key}.deleted=true;}};}`,
    "../supabase-server": `export function supabaseServer(){return {from(table){const query={table,operation:'select'};const chain={select(){return chain;},insert(payload){query.operation='insert';query.payload=payload;return chain;},delete(){query.operation='delete';return chain;},update(payload){query.operation='update';query.payload=payload;return chain;},eq(key,value){query[key]=value;return chain;},maybeSingle(){return chain;},then(resolve,reject){const state=globalThis.${key};state.calls.push(query);return Promise.resolve({data:table==='sessions' && state.session?{...state.session,profile:state.profile}:null,error:state.error??null}).then(resolve,reject);}};return chain;}};}`,
  };
  await build({
    stdin: {
      contents:
        "export * from './src/lib/auth/session.ts'; export * from './src/lib/auth/dal.ts'; export * from './src/lib/auth/login-throttle.ts'; export * from './src/lib/auth/totp.ts';",
      resolveDir: process.cwd(),
    },
    outfile: path.join(directory, "auth.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "auth-fixtures",
        setup(b) {
          b.onResolve(
            {
              filter:
                /^(server-only|react|next\/(navigation|headers)|\.\.\/supabase-server)$/,
            },
            (args) => ({ path: args.path, namespace: "fixture" }),
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents: mocks[args.path],
            loader: "js",
          }));
        },
      },
    ],
  });
  api = await import(pathToFileURL(path.join(directory, "auth.mjs")));
});
beforeEach(() => {
  globalThis[key] = {
    token: "a".repeat(43),
    session: { user_id: "viewer", expires_at: "2099-01-01T00:00:00Z" },
    profile: {
      id: "viewer",
      name: "Viewer",
      email: "viewer@example.test",
      role: "viewer",
    },
    path: "/tenders?track=all&search=hello",
    calls: [],
  };
});
after(async () => {
  delete globalThis[key];
  if (directory) await rm(directory, { recursive: true, force: true });
});
test("a protected request resolves its role with one session lookup", async () => {
  const ctx = await api.requireUser();
  assert.equal(ctx.profile.role, "viewer");
  assert.deepEqual(globalThis[key].calls.map((call) => call.table), ["sessions"]);
});
test("missing and malformed session tokens never query the database", async () => {
  for (const token of [
    undefined,
    "",
    "forged",
    "a".repeat(10000),
    "!".repeat(43),
  ]) {
    globalThis[key].token = token;
    assert.equal(await api.getSessionProfile(), null);
  }
  assert.equal(globalThis[key].calls.length, 0);
});
test("expired, revoked, missing-user and invalid-date sessions fail closed", async () => {
  for (const session of [
    null,
    { user_id: "viewer", expires_at: "2000-01-01" },
    { user_id: "viewer", expires_at: "invalid" },
    { user_id: "", expires_at: "2099-01-01" },
    { user_id: "viewer", expires_at: null },
  ]) {
    globalThis[key].session = session;
    assert.equal(await api.getSessionProfile(), null);
  }
  globalThis[key].error = { message: "Database unavailable" };
  assert.equal(await api.getSessionProfile(), null);
});
test("authentication rejects deleted profiles and unknown roles", async () => {
  for (const profile of [null, { id: "viewer", role: "owner" }]) {
    globalThis[key].profile = profile;
    assert.equal(await api.getAuthContext(), null);
  }
});
test("requireUser preserves internal return URLs and requireAdmin rejects a viewer", async () => {
  await assert.rejects(api.requireAdmin(), /REDIRECT:\/$/);
  globalThis[key].token = undefined;
  await assert.rejects(
    api.requireUser(),
    /REDIRECT:\/login\?next=%2Ftenders%3Ftrack%3Dall%26search%3Dhello/,
  );
});
test("sessions store only token hashes and set protective cookie flags", async () => {
  await api.createSession("viewer");
  const state = globalThis[key],
    insert = state.calls.find((call) => call.operation === "insert");
  assert.match(state.cookie.value, /^[A-Za-z0-9_-]{43}$/);
  assert.match(insert.payload.id, /^[a-f0-9]{64}$/);
  assert.notEqual(insert.payload.id, state.cookie.value);
  assert.equal(state.cookie.options.httpOnly, true);
  assert.equal(state.cookie.options.sameSite, "lax");
  assert.equal(state.cookie.options.path, "/");
  assert.equal(
    state.cookie.options.secure,
    process.env.NODE_ENV === "production",
  );
});
test("failed session revocation is reported instead of silently claiming logout or reset", async () => {
  globalThis[key].error = { message: "Fixture failure" };
  await assert.rejects(api.destroySession(), /Unable to revoke/);
  assert.equal(globalThis[key].deleted, undefined);
  await assert.rejects(
    api.destroyAllSessionsForUser("viewer"),
    /Unable to revoke/,
  );
});
test("login limits trip per email or per address, from shared log counts", () => {
  assert.equal(api.exceedsLoginLimits({ email: 9, ip: 29 }), false);
  assert.equal(api.exceedsLoginLimits({ email: 10, ip: 0 }), true);
  assert.equal(api.exceedsLoginLimits({ email: 0, ip: 30 }), true);
  assert.equal(api.exceedsLoginLimits({ email: 0, ip: null }), false);
});

test("TOTP follows RFC 6238, tolerates one step of drift and refuses replays", () => {
  // RFC 6238 appendix B: secret "12345678901234567890", T=59s -> 94287082 (8 digits).
  const secret = api.base32Encode(Buffer.from("12345678901234567890"));
  assert.equal(api.totpCode(secret, 1), "287082");
  const now = 59_000;
  assert.equal(api.verifyTotp(secret, "287 082", null, now), 1);
  assert.equal(api.verifyTotp(secret, "287082", null, now + 30_000), 1, "previous step still accepted");
  assert.equal(api.verifyTotp(secret, "287082", null, now + 90_000), null, "stale code refused");
  assert.equal(api.verifyTotp(secret, "287082", 1, now), null, "same step cannot be replayed");
  assert.equal(api.verifyTotp(secret, "12345", null, now), null);
  assert.deepEqual([...api.base32Decode(api.base32Encode(Buffer.from("zekindo")))], [...Buffer.from("zekindo")]);
});

test("recovery codes hash case- and hyphen-insensitively; secrets round-trip sealed", () => {
  const [code] = api.generateRecoveryCodes();
  assert.match(code, /^[a-z2-7]{5}-[a-z2-7]{5}$/);
  assert.equal(api.hashRecoveryCode(code), api.hashRecoveryCode(code.toUpperCase().replace("-", " ")));
  const secret = api.generateTotpSecret();
  assert.equal(api.openSecret(api.sealSecret(secret)), secret);
  process.env.TWO_FACTOR_ENCRYPTION_KEY = "k".repeat(40);
  try {
    const sealed = api.sealSecret(secret);
    assert.match(sealed, /^v1:/);
    assert.ok(!sealed.includes(secret));
    assert.equal(api.openSecret(sealed), secret);
    assert.equal(api.openSecret(secret), secret, "pre-encryption rows stay readable");
  } finally {
    delete process.env.TWO_FACTOR_ENCRYPTION_KEY;
  }
});

test("idle sessions end on the server; active ones refresh last-seen sparingly", async () => {
  const ago = (minutes) => new Date(Date.now() - minutes * 60000).toISOString();
  const state = globalThis[key];
  state.session = { user_id: "viewer", expires_at: "2099-01-01T00:00:00Z", last_seen_at: ago(61) };
  assert.equal(await api.getSessionProfile(), null, "61 minutes idle is signed out");
  assert.ok(state.calls.some((c) => c.table === "sessions" && c.operation === "delete"));

  for (const [minutes, touches] of [[10, true], [1, false]]) {
    state.calls = [];
    state.session = { user_id: "viewer", expires_at: "2099-01-01T00:00:00Z", last_seen_at: ago(minutes) };
    assert.equal((await api.getSessionProfile()).id, "viewer");
    const update = state.calls.find((c) => c.operation === "update");
    assert.equal(!!update, touches, `${minutes} minutes`);
    if (update) assert.ok(Date.now() - Date.parse(update.payload.last_seen_at) < 5000);
  }

  state.calls = [];
  state.session = { user_id: "viewer", expires_at: "2099-01-01T00:00:00Z" };
  assert.equal((await api.getSessionProfile()).id, "viewer", "works before migration 0016");
  assert.equal(state.calls.length, 1);
  state.session.last_seen_at = "not a date";
  assert.equal(await api.getSessionProfile(), null);
});

test("new sessions last at most 12 hours", async () => {
  await api.createSession("viewer");
  const insert = globalThis[key].calls.find((c) => c.operation === "insert");
  const hours = (Date.parse(insert.payload.expires_at) - Date.now()) / 3600000;
  assert.ok(hours > 11.9 && hours <= 12, String(hours));
  assert.ok(Math.abs(globalThis[key].cookie.options.expires - Date.parse(insert.payload.expires_at)) < 1000);
});
