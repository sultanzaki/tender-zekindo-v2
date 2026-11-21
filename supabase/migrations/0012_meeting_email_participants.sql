begin;
alter table tender_meetings add column extra_emails text[] not null default '{}';
alter table meeting_mail alter column recipient drop not null, add column extra_email text;
create function valid_meeting_addresses(addresses text[]) returns boolean language sql immutable as $$
 select cardinality(addresses)<=50 and not exists(select from unnest(addresses) a where a is null or length(a)>254 or a !~ '^[a-z0-9_%+-]+([.][a-z0-9_%+-]+)*@zekindo[.]co[.]id$')
$$;
alter table tender_meetings add check(valid_meeting_addresses(extra_emails));
alter table meeting_mail add check(num_nonnulls(recipient,extra_email)=1 and (extra_email is null or valid_meeting_addresses(array[extra_email])));
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
  select coalesce(t.tender_no,t.id), coalesce(t.product,t.customer), m.label into strict ref,name,stage
    from tenders t join milestone_types m on m.track=t.track and m.key=new.milestone
    where t.id=new.tender_id and t.archived_at is null;
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
drop trigger meeting_schedule on tender_meetings;
create trigger meeting_schedule after insert or update of topic, starts_at, participants, extra_emails, link, cancelled, day_notice, hour_notice on tender_meetings for each row execute function schedule_meeting_mail();
commit;
