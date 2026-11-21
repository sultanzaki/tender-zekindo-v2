-- Run against a migrated, seeded local database using psql -v ON_ERROR_STOP=1.
begin;
do $$
declare person uuid; tender text; stage text; meeting uuid;
begin
  insert into profiles(name,email,role) values ('QA participant',gen_random_uuid()::text||'@example.test','viewer') returning id into person;
  select t.id,m.key into strict tender,stage from tenders t join milestone_types m on m.track=t.track
    where t.archived_at is null and m.archived_at is null limit 1;
  insert into tender_meetings(tender_id,milestone,topic,starts_at,organizer,participants)
    values(tender,stage,'Reminder regression',now()+interval '3 hours',person,array[person]) returning id into meeting;
  assert (select count(*)=1 and min(kind)='1 jam' from meeting_mail where meeting_id=meeting);
  update meeting_mail set sent_at=now() where meeting_id=meeting;
  update tender_meetings set starts_at=now()+interval '2 days' where id=meeting;
  assert (select count(*)=3 from meeting_mail where meeting_id=meeting and sent_at is null);
  update tender_meetings set cancelled=true where id=meeting;
  assert (select count(*)=1 and min(subject) like 'Pembatalan%' from meeting_mail where meeting_id=meeting and sent_at is null);
end $$;
rollback;
