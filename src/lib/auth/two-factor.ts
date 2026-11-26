import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { supabaseServer } from "../supabase-server";

/** The step between "password accepted" and "code accepted". It holds no
 * access: a session is only created once the code (or a recovery code) checks
 * out. Five wrong codes burn the challenge and the user starts again. */
export const CHALLENGE_COOKIE = "zk_2fa";
export const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;

const hash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createChallenge(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + CHALLENGE_TTL_MS);
  const db = supabaseServer();
  await db.from("login_challenges").delete().lt("expires_at", new Date().toISOString());
  const { error } = await db
    .from("login_challenges")
    .insert({ id: hash(token), user_id: userId, expires_at: expires.toISOString() });
  if (error) throw new Error("Unable to start two-factor sign-in.");
  (await cookies()).set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires,
  });
}

export async function readChallenge() {
  const token = (await cookies()).get(CHALLENGE_COOKIE)?.value;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const { data } = await supabaseServer()
    .from("login_challenges")
    .select("*")
    .eq("id", hash(token))
    .maybeSingle();
  if (!data || new Date(data.expires_at).getTime() <= Date.now()) return null;
  return data;
}

export async function recordWrongCode(id: string, attempts: number) {
  const db = supabaseServer();
  if (attempts + 1 >= MAX_CODE_ATTEMPTS) {
    await db.from("login_challenges").delete().eq("id", id);
    return true;
  }
  await db.from("login_challenges").update({ attempts: attempts + 1 }).eq("id", id);
  return false;
}

export async function clearChallenge(id?: string) {
  if (id) await supabaseServer().from("login_challenges").delete().eq("id", id);
  (await cookies()).delete(CHALLENGE_COOKIE);
}
