import "server-only";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** RFC 6238 time-based one-time passwords (SHA-1, 6 digits, 30 s steps) — the
 * variant every authenticator app supports. */
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const TOTP_STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // accept one step either side for clock drift

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0,
    value = 0,
    out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0,
    value = 0;
  const out: number[] = [];
  for (const char of text.replace(/[\s=-]/g, "").toUpperCase()) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error("Invalid base32 secret");
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 15;
  const binary =
    ((hmac[offset] & 127) << 24) |
    (hmac[offset + 1] << 16) |
    (hmac[offset + 2] << 8) |
    hmac[offset + 3];
  return String(binary % 10 ** DIGITS).padStart(DIGITS, "0");
}

/** Returns the matching time step, or null. `lastStep` blocks replaying a code
 * (or any earlier one) that was already accepted. */
export function verifyTotp(
  secret: string,
  input: string,
  lastStep: number | null,
  now = Date.now(),
): number | null {
  const code = input.replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return null;
  const current = Math.floor(now / 1000 / TOTP_STEP_SECONDS);
  for (let step = current - WINDOW; step <= current + WINDOW; step++) {
    if (lastStep !== null && step <= lastStep) continue;
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

export function otpauthUri(email: string, secret: string): string {
  const label = encodeURIComponent(`Zekindo Tender:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent("Zekindo Tender")}&algorithm=SHA1&digits=${DIGITS}&period=${TOTP_STEP_SECONDS}`;
}

export function hashRecoveryCode(code: string): string {
  return createHash("sha256")
    .update(code.replace(/[\s-]/g, "").toLowerCase())
    .digest("hex");
}

/** Ten single-use codes, shown once. */
export function generateRecoveryCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const raw = base32Encode(randomBytes(7)).slice(0, 10).toLowerCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

// --- Secret at rest ---------------------------------------------------------
// With TWO_FACTOR_ENCRYPTION_KEY set (any string of 32+ characters), secrets
// are stored AES-256-GCM encrypted, so a database dump alone cannot be used to
// generate codes. Without it they are stored as-is; both forms are readable.

function encryptionKey(): Buffer | null {
  const raw = process.env.TWO_FACTOR_ENCRYPTION_KEY;
  return raw && raw.length >= 32
    ? createHash("sha256").update(raw).digest()
    : null;
}

export function sealSecret(secret: string): string {
  const key = encryptionKey();
  if (!key) return secret;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${body.toString("base64url")}`;
}

export function openSecret(stored: string): string {
  if (!stored.startsWith("v1:")) return stored;
  const key = encryptionKey();
  if (!key) throw new Error("TWO_FACTOR_ENCRYPTION_KEY is required to read this secret.");
  const [, iv, tag, body] = stored.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(body, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
