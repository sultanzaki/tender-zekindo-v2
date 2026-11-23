begin;
alter table tenders add column milestone_labels jsonb;
-- Preserve the last business edit on existing packages during backfill.
alter table tenders disable trigger tenders_set_updated_at;
with templates as (
  select track, jsonb_object_agg(key,label) labels, array_agg(key order by sort_order,created_at) keys
  from milestone_types where archived_at is null group by track
)
update tenders t set milestone_labels=templates.labels,
  milestone_order=coalesce(t.milestone_order,templates.keys)
from templates where t.track=templates.track;
update tenders set milestone_labels='{}', milestone_order=coalesce(milestone_order,'{}') where milestone_labels is null;

alter table tenders enable trigger tenders_set_updated_at;

-- Also snapshot imports and older application instances during rollout.
create function initialize_tender_stages() returns trigger language plpgsql set search_path=public as $$
begin
  if new.milestone_labels is null or new.milestone_order is null then
    select coalesce(new.milestone_labels,jsonb_object_agg(key,label),'{}'),
           coalesce(new.milestone_order,array_agg(key order by sort_order,created_at),'{}')
    into new.milestone_labels,new.milestone_order
    from milestone_types where track=new.track and archived_at is null;
  end if;
  return new;
end $$;
create trigger initialize_tender_stages before insert or update of milestone_order on tenders
for each row execute function initialize_tender_stages();
alter table tenders alter column milestone_labels set not null;
create or replace function schedule_meeting_mail() returns trigger language plpgsql set search_path=public as $$
declare
  member text;
  informed text[];
  addresses text[];
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
  select coalesce(t.tender_no,t.id), coalesce(t.product,t.customer), coalesce(t.milestone_labels->>new.milestone,m.label) into strict ref,name,stage
    from tenders t left join milestone_types m on m.track=t.track and m.key=new.milestone
    where t.id=new.tender_id and t.archived_at is null and coalesce(t.milestone_labels->>new.milestone,m.label) is not null;
  select array_agg(distinct address) into addresses from (
    select lower(email) address from profiles where id=any(new.participants)
    union select unnest(new.extra_emails)
  ) recipients;
  if tg_op='UPDATE' then
    old_time := old.starts_at;
    select array_agg(distinct coalesce(extra_email,(select lower(email) from profiles where id=recipient))) into informed from meeting_mail where meeting_id=new.id and (recipient=any(old.participants) or extra_email=any(old.extra_emails)) and (sent_at is not null or retry_at>now() or kind='update');
    delete from meeting_mail where meeting_id=new.id and (recipient=any(old.participants || new.participants) or extra_email=any(old.extra_emails || new.extra_emails)) and sent_at is null;
  end if;
  details := concat_ws(E'\n','Meeting: '||new.topic,'Paket: '||ref||' · '||name,'Milestone: '||stage,
    'Waktu: '||to_char(new.starts_at at time zone 'Asia/Jakarta','DD Mon YYYY, HH24:MI')||' WIB');
  foreach member in array coalesce(informed,'{}') loop
    prefix := case when new.cancelled or not(member=any(addresses)) then 'Pembatalan meeting' else 'Perubahan meeting' end;
    insert into meeting_mail(meeting_id,recipient,extra_email,kind,due_at,expires_at,subject,body) values
      (new.id,(select id from profiles where lower(email)=member and id=any(old.participants || new.participants)),case when not exists(select 1 from profiles where lower(email)=member and id=any(old.participants || new.participants)) then member end,'update',now(),greatest(new.starts_at,old_time,now()+interval '1 hour'),prefix||' | '||new.topic||' | '||ref,concat_ws(E'\n',prefix,E'',details,case when old_time<>new.starts_at then 'Waktu sebelumnya: '||to_char(old_time at time zone 'Asia/Jakarta','DD Mon YYYY, HH24:MI')||' WIB' end,case when prefix='Perubahan meeting' and new.link is not null then 'Link: '||new.link end));
  end loop;
  if not new.cancelled then
    insert into meeting_mail(meeting_id,recipient,extra_email,kind,due_at,expires_at,subject,body)
      select new.id,profile.id,case when profile.id is null then p end,k,new.starts_at-lag,case when k='24 jam' and new.hour_notice then new.starts_at-interval '1 hour' else new.starts_at end,
        'Pengingat '||k||' | '||new.topic||' | '||ref,concat_ws(E'\n','Pengingat jadwal meeting internal.',E'',details,case when new.link is not null then 'Link: '||new.link end)
      from unnest(addresses) p left join profiles profile on lower(profile.email)=p and profile.id=any(new.participants) cross join (values ('24 jam',interval '24 hours',new.day_notice),('1 jam',interval '1 hour',new.hour_notice)) offsets(k,lag,enabled)
      where enabled and new.starts_at-lag>=now();
  end if;
  return new;
end $$;

create or replace function public.notification_counts()
returns table(due_h3 integer,due_soon integer,stalled integer)
language sql stable set search_path=public as $$
with clock as (select (now() at time zone 'Asia/Jakarta')::date today),
dates as (
 select (select min(nullif(t.milestones->>k,'')::date) from unnest(t.milestone_order) k
 where t.milestone_labels ? k and t.milestones->>k >= to_char(clock.today,'YYYY-MM-DD')) upcoming, clock.today
 from tenders t cross join clock where t.result is null and t.archived_at is null
)
select count(*) filter(where upcoming<=today+3)::int, count(*) filter(where upcoming<=today+14)::int,
count(*) filter(where upcoming is null)::int from dates
$$;
commit;
