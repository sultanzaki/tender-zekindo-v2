"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { supabaseServer } from "../supabase-server";
import { requireUser } from "./dal";
import { clientIp, logAccess } from "../access-log";
import { isLoginThrottled } from "./login-throttle";
import {
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  openSecret,
  otpauthUri,
  sealSecret,
  verifyTotp,
} from "./totp";

/** Optional two-factor authentication, managed by each user for their own
 * account from Account security. Every action re-reads the account, and the
 * sensitive ones (turning it off) ask for the password and a current code. */

export interface TwoFactorResult {
  error?: string;
}

async function load(userId: string) {
  const { data } = await supabaseServer()
    .from("profiles")
    .select("id, email, password_hash, totp_secret, totp_enabled_at, totp_last_step, totp_recovery_hashes")
    .eq("id", userId)
    .maybeSingle();
  return data;
}

/** Starts enrolment: stores a new, not yet active secret and returns what an
 * authenticator app needs. Calling it again replaces an unfinished attempt. */
export async function beginTwoFactorSetup(): Promise<
  TwoFactorResult & { secret?: string; qr?: string }
> {
  const ctx = await requireUser();
  const profile = await load(ctx.userId);
  if (!profile) return { error: "Account not found." };
  if (profile.totp_enabled_at)
    return { error: "Two-factor authentication is already on." };
  const secret = generateTotpSecret();
  const { error } = await supabaseServer()
    .from("profiles")
    .update({ totp_secret: sealSecret(secret), totp_last_step: null })
    .eq("id", ctx.userId);
  if (error) return { error: "Could not start setup. Please try again." };
  const qr = await QRCode.toDataURL(otpauthUri(ctx.email, secret), {
    margin: 1,
    width: 220,
    errorCorrectionLevel: "M",
  });
  return { secret, qr };
}

/** Finishes enrolment once the user proves their app produces valid codes.
 * Returns the recovery codes — the only time they are ever shown. */
export async function confirmTwoFactorSetup(
  code: string,
): Promise<TwoFactorResult & { recoveryCodes?: string[] }> {
  const ctx = await requireUser();
  const profile = await load(ctx.userId);
  if (!profile?.totp_secret || profile.totp_enabled_at)
    return { error: "Start the setup again." };
  const step = verifyTotp(openSecret(profile.totp_secret), String(code), null);
  if (step === null) return { error: "That code is not valid. Check the app and try again." };
  const recoveryCodes = generateRecoveryCodes();
  const { error } = await supabaseServer()
    .from("profiles")
    .update({
      totp_enabled_at: new Date().toISOString(),
      totp_last_step: step,
      totp_recovery_hashes: recoveryCodes.map(hashRecoveryCode),
    })
    .eq("id", ctx.userId);
  if (error) return { error: "Could not turn on two-factor. Please try again." };
  await logAccess({ action: "twofactor_enabled", actorId: ctx.userId, actorEmail: ctx.email });
  revalidatePath("/settings/security");
  return { recoveryCodes };
}

/** Turning it off needs the password and a current code (or a recovery code),
 * so a walked-away-from, signed-in browser cannot weaken the account. */
export async function disableTwoFactor(
  password: string,
  code: string,
): Promise<TwoFactorResult> {
  const ctx = await requireUser();
  const profile = await load(ctx.userId);
  if (!profile?.totp_enabled_at || !profile.totp_secret)
    return { error: "Two-factor authentication is not on." };
  try {
    if (await isLoginThrottled(ctx.email, clientIp(await headers())))
      return { error: "Too many attempts. Please try again in 15 minutes." };
  } catch {
    return { error: "Temporarily unavailable. Please try again." };
  }
  const fail = async () => {
    await logAccess({
      action: "login_failed",
      actorId: ctx.userId,
      actorEmail: ctx.email,
      detail: { reason: "wrong_2fa_disable" },
    });
    return { error: "The password or code is not correct." };
  };
  if (!profile.password_hash || !(await bcrypt.compare(String(password).slice(0, 1024), profile.password_hash)))
    return fail();
  const input = String(code).trim().slice(0, 64);
  const step = /^\d{3}\s?\d{3}$/.test(input)
    ? verifyTotp(openSecret(profile.totp_secret), input, profile.totp_last_step)
    : null;
  const recovery =
    step === null && profile.totp_recovery_hashes.includes(hashRecoveryCode(input));
  if (step === null && !recovery) return fail();
  const { error } = await supabaseServer()
    .from("profiles")
    .update({
      totp_secret: null,
      totp_enabled_at: null,
      totp_last_step: null,
      totp_recovery_hashes: [],
    })
    .eq("id", ctx.userId);
  if (error) return { error: "Could not turn off two-factor. Please try again." };
  await logAccess({ action: "twofactor_disabled", actorId: ctx.userId, actorEmail: ctx.email });
  revalidatePath("/settings/security");
  return {};
}
