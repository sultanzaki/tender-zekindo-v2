-- Who signed in, exported or downloaded what, from where. Written only by the
-- application's server code (service role); RLS with no policies keeps every
-- other client out, like the other tables. Rows are never updated.
create table if not exists public.access_log (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  actor_email text,
  action text not null check (action in (
    'login', 'login_failed', 'logout', 'logout_idle', 'export', 'download'
  )),
  detail jsonb not null default '{}'::jsonb,
  ip text,
  user_agent text
);

create index if not exists access_log_created_idx on public.access_log (created_at desc);
create index if not exists access_log_actor_idx on public.access_log (actor_id, created_at desc);

alter table public.access_log enable row level security;
