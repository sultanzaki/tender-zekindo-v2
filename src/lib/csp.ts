/** Content-Security-Policy for every HTML response. Scripts run only with the
 * per-request nonce (plus what those scripts load: 'strict-dynamic'); nothing
 * can be framed, embedded as an object, or post forms elsewhere. Styles keep
 * 'unsafe-inline' because React/Radix set style attributes, which a nonce
 * cannot cover; script injection — the dangerous part — stays blocked. */
export function buildCsp(options: {
  nonce: string;
  /** Origin of the storage host the browser uploads files to (SUPABASE_URL). */
  storageOrigin?: string | null;
  dev?: boolean;
}): string {
  const connect = ["'self'", options.storageOrigin].filter(Boolean).join(" ");
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${options.nonce}' 'strict-dynamic'${options.dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(options.dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export function originOf(url: string | undefined): string | null {
  try {
    return url ? new URL(url).origin : null;
  } catch {
    return null;
  }
}
