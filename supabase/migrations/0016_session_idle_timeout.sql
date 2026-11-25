-- Idle sign-out: sessions record when they were last used. The application
-- rejects a session unused for IDLE_TIMEOUT_MS and caps every session at
-- SESSION_MAX_AGE_MS (src/lib/auth/session-policy.ts).
alter table public.sessions
  add column if not exists last_seen_at timestamptz not null default now();

-- Sessions issued under the old 30-day policy end within 12 hours.
update public.sessions
  set expires_at = least(expires_at, now() + interval '12 hours');

-- Expired sessions are no longer useful to anyone.
delete from public.sessions where expires_at <= now();
