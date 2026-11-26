// End-to-end sign-in: real production build, real browser, in-memory PostgREST.
//   npm run build && CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:2fa
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { once } from "node:events";
import { createHmac, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const PASSWORD = "OnlyFixturePassword!";
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP".slice(0, 32);
const decode = (s) => {
  let bits = 0, value = 0; const out = [];
  for (const c of s) { value = (value << 5) | ALPHABET.indexOf(c); bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } }
  return Buffer.from(out);
};
// Independent RFC 6238 implementation, so the app is not graded by itself.
const code = (offsetSteps = 0) => {
  const step = Math.floor(Date.now() / 30000) + offsetSteps;
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(step));
  const h = createHmac("sha1", decode(SECRET)).update(counter).digest();
  const o = h[h.length - 1] & 15;
  return String((((h[o] & 127) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3]) % 1e6).padStart(6, "0");
};
const sha = (s) => createHash("sha256").update(s).digest("hex");

const tables = { profiles: [], sessions: [], access_log: [], login_challenges: [] };
let fixture, app, browser, base, logs = "";

function test1(row, key, expr) {
  const value = key.includes("->>") ? row[key.split("->>")[0]]?.[key.split("->>")[1]] : row[key];
  const cmp = (a, b) => (isNaN(a) || isNaN(b) || a === null ? String(a) < String(b) : Number(a) < Number(b));
  const [op, ...rest] = expr.split("."); const arg = rest.join(".");
  switch (op) {
    case "eq": return String(value) === arg;
    case "neq": return value != null && String(value) !== arg;
    case "gte": return !cmp(value, arg);
    case "lt": return value != null && cmp(value, arg);
    case "is": return arg === "null" ? value == null : value != null;
    case "cs": return JSON.parse(arg.replace(/^\{/, "[").replace(/\}$/, "]").replace(/([^[\],"]+)/g, '"$1"').replace(/""/g, '"')).every((x) => (value ?? []).includes(x));
    default: return true;
  }
}
const rowMatches = (row, params) =>
  [...params].every(([key, expr]) => {
    if (["select", "order", "offset", "limit", "columns"].includes(key)) return true;
    if (key === "or")
      return expr.slice(1, -1).split(",").some((part) => { const [k, ...r] = part.split("."); return test1(row, k, r.join(".")); });
    return test1(row, key, expr);
  });

before(async () => {
  tables.profiles.push(
    { id: "u-2fa", email: "alice@example.test", name: "Alice", role: "viewer", created_at: "2026-01-01T00:00:00Z", password_hash: await bcrypt.hash(PASSWORD, 10),
      totp_secret: SECRET, totp_enabled_at: "2026-01-02T00:00:00Z", totp_last_step: null, totp_recovery_hashes: [sha("abcde12345")] },
    { id: "u-plain", email: "bob@example.test", name: "Bob", role: "viewer", created_at: "2026-01-01T00:00:00Z", password_hash: await bcrypt.hash(PASSWORD, 10),
      totp_secret: null, totp_enabled_at: null, totp_last_step: null, totp_recovery_hashes: [] },
  );
  let id = 0;
  fixture = createServer(async (req, res) => {
    const url = new URL(req.url, "http://fixture");
    const table = url.pathname.split("/").pop();
    if (!tables[table]) { res.writeHead(404); return res.end("{}"); }
    const rows = tables[table].filter((r) => rowMatches(r, url.searchParams));
    const chunks = []; for await (const c of req) chunks.push(c);
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : null;
    const wantsRows = /return=representation/.test(req.headers.prefer ?? "");
    let out = rows;
    if (req.method === "DELETE") tables[table] = tables[table].filter((r) => !rows.includes(r));
    else if (req.method === "POST") { out = [body].flat().map((r) => ({ id: ++id, ...(table === "login_challenges" ? { attempts: 0 } : {}), ...r })); tables[table].push(...out); }
    else if (req.method === "PATCH") for (const r of rows) Object.assign(r, body);
    if (req.method === "HEAD" || /count=exact/.test(req.headers.prefer ?? ""))
      res.setHeader("Content-Range", `0-0/${rows.length}`);
    if (req.method === "HEAD") { res.writeHead(200); return res.end(); }
    if (req.method !== "GET" && !wantsRows) { res.writeHead(201); return res.end(); }
    let cols = url.searchParams.get("select");
    if (table === "sessions" && cols?.includes("profile:profiles("))
      out = out.map((r) => ({ ...r, profile: tables.profiles.find((p) => p.id === r.user_id) }));
    else if (cols && cols !== "*") out = out.map((r) => Object.fromEntries(cols.split(",").map((k) => [k, r[k]])));
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(req.headers.accept?.includes("vnd.pgrst.object") ? out[0] ?? null : out));
  });
  fixture.listen(0, "127.0.0.1"); await once(fixture, "listening");
  const probe = createServer(); probe.listen(0, "127.0.0.1"); await once(probe, "listening");
  const port = probe.address().port; await new Promise((r) => probe.close(r));
  base = `http://localhost:${port}`;
  app = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "localhost", "--port", String(port)], {
    env: { ...process.env, NODE_ENV: "production", SUPABASE_URL: `http://127.0.0.1:${fixture.address().port}`, SUPABASE_SERVICE_ROLE_KEY: "fixture" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  app.stdout.on("data", (c) => (logs += c)); app.stderr.on("data", (c) => (logs += c));
  for (let i = 0; i < 150; i++) { try { if ((await fetch(base + "/login")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] });
});
after(async () => {
  await browser?.close();
  if (app?.exitCode === null) { app.kill("SIGTERM"); await once(app, "exit"); }
  await new Promise((r) => fixture?.close(r));
});

async function signIn(email, password) {
  tables.login_challenges.length = 0;
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(base + "/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator("#login-password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  return { ctx, page };
}
const verify = async (page, value) => {
  await page.getByLabel("Verification code").fill(value);
  await page.getByRole("button", { name: "Verify" }).click();
};
const expectAttempts = async (n) => {
  for (let i = 0; i < 100 && tables.login_challenges[0]?.attempts !== n; i++) await new Promise((r) => setTimeout(r, 50));
  assert.equal(tables.login_challenges[0]?.attempts, n);
};
const failures = (reason) => tables.access_log.filter((r) => r.action === "login_failed" && r.detail?.reason === reason).length;

test("a password alone does not sign in an account with two-factor", async () => {
  const { ctx, page } = await signIn("alice@example.test", PASSWORD);
  await page.getByRole("heading", { name: "Two-step verification" }).waitFor();
  assert.equal(tables.sessions.length, 0, "no session before the code is verified");
  assert.equal(tables.login_challenges.length, 1);
  await page.goto(base + "/tenders");
  assert.match(page.url(), /\/login/);
  await ctx.close();
});

test("a wrong code is refused and logged; the right code signs in", async () => {
  const { ctx, page } = await signIn("alice@example.test", PASSWORD);
  await verify(page, "000000");
  await page.getByText("That code is not valid").waitFor();
  assert.equal(failures("wrong_2fa_code"), 1);
  assert.equal(tables.sessions.length, 0);
  await verify(page, code());
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  assert.equal(tables.sessions.length, 1);
  assert.equal(tables.sessions[0].user_id, "u-2fa");
  assert.equal(tables.login_challenges.length, 0, "challenge is consumed");
  assert.equal(tables.access_log.at(-1).detail.twoFactor, "totp");
  await ctx.close();
});

test("an accepted code cannot be replayed", async () => {
  const { ctx, page } = await signIn("alice@example.test", PASSWORD);
  await verify(page, code());
  await page.getByText("That code is not valid").waitFor();
  await ctx.close();
});

test("a recovery code works exactly once", async () => {
  tables.profiles[0].totp_last_step = null;
  const first = await signIn("alice@example.test", PASSWORD);
  await verify(first.page, "ABCDE-12345");
  await first.page.waitForURL((u) => !u.pathname.startsWith("/login"));
  assert.deepEqual(tables.profiles[0].totp_recovery_hashes, []);
  await first.ctx.close();
  const second = await signIn("alice@example.test", PASSWORD);
  await verify(second.page, "ABCDE-12345");
  await second.page.getByText("That code is not valid").waitFor();
  await second.ctx.close();
});

test("five wrong codes burn the pending sign-in", async () => {
  tables.access_log.length = 0;
  const { ctx, page } = await signIn("alice@example.test", PASSWORD);
  for (let i = 0; i < 5; i++) {
    await verify(page, "000000");
    if (i < 4) await expectAttempts(i + 1);
  }
  await page.getByText("Too many incorrect codes").waitFor({ timeout: 5000 }).catch(async (e) => {
    throw new Error((await page.locator("main").innerText()) + JSON.stringify(tables.login_challenges) + "\n" + e.message);
  });
  assert.equal(tables.login_challenges.length, 0);
  await ctx.close();
});

test("accounts without two-factor sign in as before", async () => {
  const { ctx, page } = await signIn("bob@example.test", PASSWORD);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  assert.ok(tables.sessions.some((s) => s.user_id === "u-plain"));
  await ctx.close();
});

test("a user can turn two-factor on and off from Account security", async () => {
  const { ctx, page } = await signIn("bob@example.test", PASSWORD);
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
  await page.goto(base + "/settings/security");
  await page.getByText("Two-factor authentication is off").waitFor();
  await page.getByRole("button", { name: "Set up two-factor" }).click();
  await page.getByAltText("QR code for your authenticator app").waitFor();
  const secret = (await page.locator("code").innerText()).trim();
  assert.match(secret, /^[A-Z2-7]{32}$/);
  const bob = tables.profiles.find((p) => p.id === "u-plain");
  assert.equal(bob.totp_enabled_at, null, "not active until a code is confirmed");
  // Compute the code from the displayed key, like an authenticator app would.
  const at = (offset) => {
    const step = Math.floor(Date.now() / 30000) + offset, counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const h = createHmac("sha1", (() => { let b = 0, v = 0; const o = []; for (const c of secret) { v = (v << 5) | ALPHABET.indexOf(c); b += 5; if (b >= 8) { o.push((v >>> (b - 8)) & 255); b -= 8; } } return Buffer.from(o); })()).update(counter).digest();
    const k = h[h.length - 1] & 15;
    return String((((h[k] & 127) << 24) | (h[k + 1] << 16) | (h[k + 2] << 8) | h[k + 3]) % 1e6).padStart(6, "0");
  };
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: "Turn on" }).click();
  await page.getByText("That code is not valid").waitFor();
  await page.getByLabel("6-digit code").fill(at(0));
  await page.getByRole("button", { name: "Turn on" }).click();
  await page.getByText("Save your recovery codes").waitFor();
  assert.equal(await page.getByRole("list", { name: "Recovery codes" }).locator("li").count(), 10);
  assert.ok(bob.totp_enabled_at);
  assert.equal(bob.totp_recovery_hashes.length, 10);
  await page.getByRole("button", { name: "I saved them" }).click();
  // Turning it off needs the password and a fresh code.
  await page.getByRole("button", { name: "Turn off two-factor" }).click();
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByLabel("Current code or a recovery code").fill(at(1));
  await page.getByRole("button", { name: "Turn off", exact: true }).click();
  await page.getByText("The password or code is not correct").waitFor();
  assert.ok(bob.totp_enabled_at, "still on after a wrong password");
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByRole("button", { name: "Turn off", exact: true }).click();
  await page.getByText("Two-factor authentication is off").waitFor();
  assert.equal(bob.totp_enabled_at, null);
  assert.equal(bob.totp_secret, null);
  for (const action of ["twofactor_enabled", "twofactor_disabled"])
    assert.ok(tables.access_log.some((r) => r.action === action), action);
  await ctx.close();
});

test("ten failed sign-ins lock the account on every instance, even for the right password", async () => {
  tables.access_log.length = 0;
  tables.sessions.length = 0;
  for (let i = 0; i < 10; i++) {
    const { ctx, page } = await signIn("bob@example.test", "wrong-password");
    await page.getByText("Incorrect email or password").waitFor();
    await ctx.close();
  }
  const { ctx, page } = await signIn("bob@example.test", PASSWORD);
  await page.getByText("Too many sign-in attempts").waitFor();
  assert.equal(tables.sessions.length, 0);
  assert.equal(failures("throttled"), 1);
  await ctx.close();
});
