-- 1. access_log becomes append-only. Rows cannot be edited, and cannot be deleted
--    until they are 12 months old — not even with the service-role key — so a
--    compromised application cannot erase recent evidence. (Someone with owner
--    rights on the database could still drop the trigger; shipping the log to
--    external storage is what closes that last gap.)
-- 2. A retention function the daily cron calls to purge short-lived data.

alter table public.access_log drop constraint if exists access_log_action_check;
alter table public.access_log add constraint access_log_action_check check (action in (
  'login', 'login_failed', 'logout', 'logout_idle', 'export', 'download',
  'user_created', 'user_role_changed', 'user_password_reset', 'user_removed',
  'tender_deleted', 'twofactor_enabled', 'twofactor_disabled', 'twofactor_reset',
  'retention_run'
));

create or replace function public.access_log_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.created_at < now() - interval '12 months' then
      return old;
    end if;
    raise exception 'access_log rows are kept for 12 months' using errcode = '42501';
  elsif tg_op = 'UPDATE' then
    -- The only change allowed: the foreign key blanking actor_id when the
    -- person's account is removed. Everything else is read-only.
    if new.actor_id is null and old.actor_id is not null
       and (to_jsonb(new) - 'actor_id') = (to_jsonb(old) - 'actor_id') then
      return new;
    end if;
    raise exception 'access_log is append-only' using errcode = '42501';
  end if;
  raise exception 'access_log is append-only' using errcode = '42501';
end $$;

drop trigger if exists access_log_guard_rows on public.access_log;
create trigger access_log_guard_rows before update or delete on public.access_log
  for each row execute function public.access_log_guard();
drop trigger if exists access_log_guard_truncate on public.access_log;
create trigger access_log_guard_truncate before truncate on public.access_log
  for each statement execute function public.access_log_guard();

-- Purges data past its retention period and reports how many rows went.
-- Business records (tenders, documents, tender history) are never touched here.
create or replace function public.apply_retention(
  p_log_months integer default 12,
  p_session_days integer default 7,
  p_error_days integer default 90,
  p_mail_days integer default 30
) returns jsonb language plpgsql set search_path = public as $$
declare
  result jsonb := '{}'::jsonb;
  n bigint;
begin
  if p_log_months < 12 then
    raise exception 'access_log is kept at least 12 months';
  end if;
  delete from access_log where created_at < now() - make_interval(months => p_log_months);
  get diagnostics n = row_count; result := result || jsonb_build_object('access_log', n);
  delete from sessions where expires_at < now() - make_interval(days => p_session_days);
  get diagnostics n = row_count; result := result || jsonb_build_object('sessions', n);
  delete from login_challenges where expires_at < now() - interval '1 day';
  get diagnostics n = row_count; result := result || jsonb_build_object('login_challenges', n);
  delete from error_log where created_at < now() - make_interval(days => p_error_days);
  get diagnostics n = row_count; result := result || jsonb_build_object('error_log', n);
  delete from meeting_mail
    where coalesce(sent_at, expires_at) < now() - make_interval(days => p_mail_days);
  get diagnostics n = row_count; result := result || jsonb_build_object('meeting_mail', n);
  delete from reminder_digest where day < current_date - p_mail_days;
  get diagnostics n = row_count; result := result || jsonb_build_object('reminder_digest', n);
  return result;
end $$;

revoke execute on function public.apply_retention(integer, integer, integer, integer) from public, anon, authenticated;
grant execute on function public.apply_retention(integer, integer, integer, integer) to service_role;
revoke execute on function public.access_log_guard() from public, anon, authenticated;
