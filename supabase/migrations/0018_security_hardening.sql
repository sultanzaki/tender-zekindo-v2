-- Security hardening:
--  1. Optional two-factor authentication (TOTP) per account.
--  2. Login challenges: the short-lived step between "password accepted" and
--     "code accepted"; no session exists until the code is verified.
--  3. Failed-login throttling now reads access_log (shared by every server
--     instance) instead of per-process memory, so it needs these indexes.
--  4. access_log records administrator actions as well.
--  5. Explicitly revoke every Data API (anon / authenticated) privilege. The
--     app only uses the service-role key; RLS without policies already denies
--     those roles, this makes the denial independent of RLS.
--  6. Cap uploads in the private bucket at 5 MB, whatever the client claims.

alter table public.profiles
  add column if not exists totp_secret text,
  add column if not exists totp_enabled_at timestamptz,
  add column if not exists totp_last_step bigint,
  add column if not exists totp_recovery_hashes text[] not null default '{}';

create table if not exists public.login_challenges (
  id text primary key, -- sha-256 of the challenge cookie; the raw value is never stored
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists login_challenges_user_idx on public.login_challenges (user_id);
create index if not exists login_challenges_expires_idx on public.login_challenges (expires_at);
alter table public.login_challenges enable row level security;

alter table public.access_log drop constraint if exists access_log_action_check;
alter table public.access_log add constraint access_log_action_check check (action in (
  'login', 'login_failed', 'logout', 'logout_idle', 'export', 'download',
  'user_created', 'user_role_changed', 'user_password_reset', 'user_removed',
  'tender_deleted', 'twofactor_enabled', 'twofactor_disabled', 'twofactor_reset'
));
create index if not exists access_log_failed_email_idx
  on public.access_log (actor_email, created_at desc) where action = 'login_failed';
create index if not exists access_log_failed_ip_idx
  on public.access_log (ip, created_at desc) where action = 'login_failed';

do $$
declare r record;
begin
  for r in select tablename from pg_tables where schemaname = 'public' loop
    execute format('revoke all on table public.%I from anon, authenticated', r.tablename);
    execute format('grant all on table public.%I to service_role', r.tablename);
  end loop;
  for r in select sequencename from pg_sequences where schemaname = 'public' loop
    execute format('revoke all on sequence public.%I from anon, authenticated', r.sequencename);
    execute format('grant all on sequence public.%I to service_role', r.sequencename);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f' loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- Objects created later start closed as well.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

-- When a meeting was created, for the per-user creation limit.
alter table public.tender_meetings add column if not exists created_at timestamptz not null default now();

update storage.buckets set file_size_limit = 5242880 where id = 'tender-documents';
