"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { supabaseServer } from "../supabase-server";
import {
  createSession,
  destroyAllSessionsForUser,
  destroySession,
} from "./session";
import { getAuthContext, requireAdmin } from "./dal";
import { clientIp, logAccess } from "../access-log";
import { safeNextPath } from "../validation";
import type { UserRole } from "../types";
import { isUserRole } from "../roles";
import { isLoginThrottled } from "./login-throttle";
import {
  clearChallenge,
  createChallenge,
  readChallenge,
  recordWrongCode,
} from "./two-factor";
import { hashRecoveryCode, openSecret, verifyTotp } from "./totp";

export interface FormState {
  error?: string;
  /** Password accepted; the account has two-factor on, so a code is next. */
  twoFactor?: boolean;
  /** The pending sign-in is gone; show the password step again. */
  restart?: boolean;
}

const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
// Same work factor for unknown accounts, so the error path does not skip bcrypt.
const DUMMY_HASH =
  "$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export async function login(
  _prevState: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };
  if (email.length > 254 || password.length > 1024)
    return { error: "Incorrect email or password." };
  try {
    const ip = clientIp(await headers());
    if (await isLoginThrottled(email, ip)) {
      await logAccess({
        action: "login_failed",
        actorEmail: email,
        detail: { reason: "throttled" },
      });
      return {
        error: "Too many sign-in attempts. Please try again in 15 minutes.",
      };
    }

    const { data: profile, error } = await supabaseServer()
      .from("profiles")
      .select("id, password_hash, totp_enabled_at")
      .eq("email", email)
      .maybeSingle();
    if (error)
      return { error: "Sign-in is temporarily unavailable. Please try again." };
    const matches = await bcrypt.compare(
      password,
      profile?.password_hash || DUMMY_HASH,
    );
    if (!profile?.password_hash || !matches) {
      await logAccess({
        action: "login_failed",
        actorId: profile?.id ?? null,
        actorEmail: email,
        detail: { reason: profile ? "wrong_password" : "unknown_account" },
      });
      return { error: "Incorrect email or password." };
    }
    if (profile.totp_enabled_at) {
      await createChallenge(profile.id);
      return { twoFactor: true };
    }
    await createSession(profile.id);
    await logAccess({ action: "login", actorId: profile.id, actorEmail: email });
  } catch {
    return { error: "Unable to sign in. Check your connection and try again." };
  }

  const next = String(formData.get("next") || "/");
  redirect(safeNextPath(next));
}

/** Second step of a two-factor sign-in: an authenticator code, or one of the
 * single-use recovery codes. Wrong codes count towards the same sign-in limits
 * as wrong passwords. */
export async function verifyTwoFactorLogin(
  _prevState: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const restart = {
    error: "Your sign-in timed out. Enter your password again.",
    restart: true,
  };
  const challenge = await readChallenge();
  if (!challenge) return restart;
  const code = String(formData.get("code") || "").trim().slice(0, 64);
  if (!code) return { twoFactor: true, error: "Enter your 6-digit code." };

  const db = supabaseServer();
  const { data: profile } = await db
    .from("profiles")
    .select("id, email, totp_secret, totp_enabled_at, totp_last_step, totp_recovery_hashes")
    .eq("id", challenge.user_id)
    .maybeSingle();
  if (!profile?.totp_secret || !profile.totp_enabled_at) {
    await clearChallenge(challenge.id);
    return restart;
  }
  let throttled = true;
  try {
    throttled = await isLoginThrottled(profile.email, clientIp(await headers()));
  } catch {
    return { twoFactor: true, error: "Sign-in is temporarily unavailable. Please try again." };
  }
  if (throttled) {
    await clearChallenge(challenge.id);
    return { error: "Too many sign-in attempts. Please try again in 15 minutes.", restart: true };
  }

  let method: "totp" | "recovery" | null = null;
  if (/^\d{3}\s?\d{3}$/.test(code)) {
    const step = verifyTotp(openSecret(profile.totp_secret), code, profile.totp_last_step);
    if (step !== null) {
      const { data } = await db
        .from("profiles")
        .update({ totp_last_step: step })
        .eq("id", profile.id)
        .or(`totp_last_step.is.null,totp_last_step.lt.${step}`)
        .select("id");
      if (data?.length) method = "totp";
    }
  } else {
    const hash = hashRecoveryCode(code);
    if (profile.totp_recovery_hashes.includes(hash)) {
      const { data } = await db
        .from("profiles")
        .update({
          totp_recovery_hashes: profile.totp_recovery_hashes.filter((h) => h !== hash),
        })
        .eq("id", profile.id)
        .contains("totp_recovery_hashes", [hash])
        .select("id");
      if (data?.length) method = "recovery";
    }
  }

  if (!method) {
    await logAccess({
      action: "login_failed",
      actorId: profile.id,
      actorEmail: profile.email,
      detail: { reason: "wrong_2fa_code" },
    });
    const burned = await recordWrongCode(challenge.id, challenge.attempts);
    return burned
      ? { error: "Too many incorrect codes. Enter your password again.", restart: true }
      : { twoFactor: true, error: "That code is not valid. Try again." };
  }

  await clearChallenge(challenge.id);
  await createSession(profile.id);
  await logAccess({
    action: "login",
    actorId: profile.id,
    actorEmail: profile.email,
    detail: { twoFactor: method },
  });
  redirect(safeNextPath(String(formData.get("next") || "/")));
}

async function endSession(action: "logout" | "logout_idle") {
  const ctx = await getAuthContext();
  await destroySession();
  if (ctx)
    await logAccess({ action, actorId: ctx.userId, actorEmail: ctx.email });
}

export async function logout() {
  await endSession("logout");
  redirect("/login");
}

/** Called by the idle timer: ends the session and explains why on /login. */
export async function logoutIdle() {
  await endSession("logout_idle");
  redirect("/login?reason=idle");
}

/** Heartbeat from an active browser. Reading the session refreshes its
 * last-seen time; `false` means it already ended (idle, expired, revoked). */
export async function keepSessionAlive(): Promise<boolean> {
  return (await getAuthContext()) !== null;
}

export interface CreateUserInput {
  email: string;
  name: string;
  role: UserRole;
  password: string;
}

/** Admin creates an account and sets its initial password directly — no
 * invite email involved. The person just needs to be told the password
 * out of band (chat, in person, etc.). */
export async function createUser(
  input: CreateUserInput,
): Promise<FormState | undefined> {
  const ctx = await requireAdmin();

  const email = input.email.trim().toLowerCase();
  const name = input.name.trim();
  if (!email || !name) return { error: "Name and email are required." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    return { error: "Enter a valid email address." };
  if (!isUserRole(input.role))
    return { error: "Choose a valid role." };
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const password_hash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const { error } = await supabaseServer()
    .from("profiles")
    .insert({ email, name, role: input.role, password_hash });
  if (error) {
    if (error.code === "23505")
      return { error: "A user with this email already exists." };
    return { error: error.message };
  }

  await logAccess({
    action: "user_created",
    actorId: ctx.userId,
    actorEmail: ctx.email,
    detail: { target: email, role: input.role },
  });
  revalidatePath("/admin/users");
}

/** Admin sets a new password for an existing user (forgot-password flow) —
 * also revokes that user's existing sessions so a stolen/old login can't
 * outlive the reset. */
export async function resetUserPassword(
  userId: string,
  newPassword: string,
): Promise<FormState | undefined> {
  const ctx = await requireAdmin();
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return {
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
    };
  }

  const target = await targetEmail(userId);
  const password_hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  const { error } = await supabaseServer()
    .from("profiles")
    .update({ password_hash })
    .eq("id", userId);
  if (error) return { error: error.message };

  try {
    await destroyAllSessionsForUser(userId);
  } catch {
    return {
      error:
        "The password changed, but existing sessions could not be revoked. Retry the reset before considering it complete.",
    };
  }
  await logAccess({
    action: "user_password_reset",
    actorId: ctx.userId,
    actorEmail: ctx.email,
    detail: { target: target?.email ?? userId },
  });
  revalidatePath("/admin/users");
}

async function targetEmail(userId: string): Promise<{ email: string; role: string } | null> {
  const { data } = await supabaseServer()
    .from("profiles")
    .select("email, role")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<FormState | undefined> {
  const ctx = await requireAdmin();
  if (userId === ctx.userId)
    return { error: "You cannot change your own role." };
  if (!isUserRole(role))
    return { error: "Choose a valid role." };
  const target = await targetEmail(userId);
  const { error } = await supabaseServer()
    .from("profiles")
    .update({ role })
    .eq("id", userId);
  if (error) return { error: error.message };
  await logAccess({
    action: "user_role_changed",
    actorId: ctx.userId,
    actorEmail: ctx.email,
    detail: { target: target?.email ?? userId, from: target?.role, to: role },
  });
  revalidatePath("/admin/users");
}

export async function removeUser(
  userId: string,
): Promise<FormState | undefined> {
  const ctx = await requireAdmin();
  if (userId === ctx.userId)
    return { error: "You can't remove your own account." };
  const target = await targetEmail(userId);
  const { error } = await supabaseServer()
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (error) return { error: error.message };
  await logAccess({
    action: "user_removed",
    actorId: ctx.userId,
    actorEmail: ctx.email,
    detail: { target: target?.email ?? userId },
  });
  revalidatePath("/admin/users");
}

/** Lost phone and no recovery codes: an administrator turns a user's two-factor
 * off and ends their sessions; the user can enrol again from Account security. */
export async function resetUserTwoFactor(
  userId: string,
): Promise<FormState | undefined> {
  const ctx = await requireAdmin();
  if (userId === ctx.userId)
    return { error: "Use Account security to turn off your own two-factor." };
  const target = await targetEmail(userId);
  const { error } = await supabaseServer()
    .from("profiles")
    .update({
      totp_secret: null,
      totp_enabled_at: null,
      totp_last_step: null,
      totp_recovery_hashes: [],
    })
    .eq("id", userId);
  if (error) return { error: error.message };
  try {
    await destroyAllSessionsForUser(userId);
  } catch {
    return { error: "Two-factor was reset, but existing sessions could not be revoked. Retry." };
  }
  await logAccess({
    action: "twofactor_reset",
    actorId: ctx.userId,
    actorEmail: ctx.email,
    detail: { target: target?.email ?? userId },
  });
  revalidatePath("/admin/users");
}
