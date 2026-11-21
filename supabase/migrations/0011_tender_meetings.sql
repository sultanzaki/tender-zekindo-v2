begin;
create table tender_meetings (
  id uuid primary key default gen_random_uuid(),
  tender_id text not null references tenders(id) on delete cascade,
  milestone text not null,
  organizer uuid references profiles(id) on delete set null,
  topic text not null check(length(trim(topic)) between 1 and 180),
  starts_at timestamptz not null,
  link text,
  participants uuid[] not null,
  day_notice boolean not null default true,
  hour_notice boolean not null default true,
  cancelled boolean not null default false,
  revision integer not null default 1
);
create index tender_meetings_schedule on tender_meetings(tender_id,milestone,starts_at);
create table meeting_mail (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references tender_meetings(id) on delete cascade,
  recipient uuid not null references profiles(id) on delete cascade,
  kind text not null,
  due_at timestamptz not null,
  expires_at timestamptz not null,
  subject text not null,
  body text not null,
  sent_at timestamptz,
  retry_at timestamptz not null default now()
);
create index meeting_mail_due on meeting_mail(due_at,retry_at) where sent_at is null;
alter table tender_meetings enable row level security;
alter table meeting_mail enable row level security;
revoke all on tender_meetings, meeting_mail from anon, authenticated;
create view meeting_counts with (security_invoker=true) as
 select tender_id,milestone,count(*)::int as count from tender_meetings where not cancelled group by tender_id,milestone;
revoke all on meeting_counts from anon, authenticated;

create function schedule_meeting_mail() returns trigger language plpgsql set search_path=public as $$
declare
  member uuid;
  informed uuid[];
  prefix text;
  details text;
  ref text;
  name text;
  stage text;
  old_time timestamptz;
begin
  if not new.cancelled and exists(select 1 from unnest(new.participants) p where not exists(select 1 from profiles where id=p)) then
    raise exception 'Unknown internal participant';
  end if;
  select coalesce(t.tender_no,t.id), coalesce(t.product,t.customer), m.label into strict ref,name,stage
    from tenders t join milestone_types m on m.track=t.track and m.key=new.milestone
    where t.id=new.tender_id and t.archived_at is null;
  if tg_op='UPDATE' then
    old_time := old.starts_at;
    select array_agg(distinct recipient) into informed from meeting_mail where meeting_id=new.id and recipient=any(old.participants) and (sent_at is not null or retry_at>now() or kind='update');
    delete from meeting_mail where meeting_id=new.id and recipient=any(old.participants || new.participants) and sent_at is null;
  end if;
  details := concat_ws(E'\n','Meeting: '||new.topic,'Paket: '||ref||' · '||name,'Milestone: '||stage,
    'Waktu: '||to_char(new.starts_at at time zone 'Asia/Jakarta','DD Mon YYYY, HH24:MI')||' WIB');
  foreach member in array coalesce(informed,'{}') loop
    prefix := case when new.cancelled or not(member=any(new.participants)) then 'Pembatalan meeting' else 'Perubahan meeting' end;
    insert into meeting_mail(meeting_id,recipient,kind,due_at,expires_at,subject,body) values
      (new.id,member,'update',now(),greatest(new.starts_at,old_time,now()+interval '1 hour'),prefix||' | '||new.topic||' | '||ref,concat_ws(E'\n',prefix,E'',details,case when old_time<>new.starts_at then 'Waktu sebelumnya: '||to_char(old_time at time zone 'Asia/Jakarta','DD Mon YYYY, HH24:MI')||' WIB' end,case when prefix='Perubahan meeting' and new.link is not null then 'Link: '||new.link end));
  end loop;
  if not new.cancelled then
    insert into meeting_mail(meeting_id,recipient,kind,due_at,expires_at,subject,body)
      select new.id,p,k,new.starts_at-lag,case when k='24 jam' and new.hour_notice then new.starts_at-interval '1 hour' else new.starts_at end,
        'Pengingat '||k||' | '||new.topic||' | '||ref,concat_ws(E'\n','Pengingat jadwal meeting internal.',E'',details,case when new.link is not null then 'Link: '||new.link end)
      from unnest(new.participants) p cross join (values ('24 jam',interval '24 hours',new.day_notice),('1 jam',interval '1 hour',new.hour_notice)) offsets(k,lag,enabled)
      where enabled and new.starts_at-lag>=now();
  end if;
  return new;
end $$;
create trigger meeting_schedule after insert or update of topic, starts_at, participants, link, cancelled, day_notice, hour_notice on tender_meetings for each row execute function schedule_meeting_mail();
create function claim_meeting_mail() returns setof meeting_mail language sql set search_path=public as $$
  update meeting_mail j set retry_at=now()+interval '2 minutes' where j.id in (
    select q.id from meeting_mail q join tender_meetings m on m.id=q.meeting_id join tenders t on t.id=m.tender_id
    where t.archived_at is null and q.sent_at is null and q.due_at<=now() and q.retry_at<=now() and q.expires_at>now()
    order by q.due_at limit 10 for update of q skip locked
  ) returning j.*;
$$;
revoke execute on function claim_meeting_mail() from public,anon,authenticated;
grant execute on function claim_meeting_mail() to service_role;
commit;
