begin;
do $$
declare person uuid; tender text; stage text; meeting uuid;
begin
  insert into profiles(name,email,role) values ('QA','qa-'||gen_random_uuid()||'@zekindo.co.id','viewer') returning id into person;
  select t.id,m.key into strict tender,stage from tenders t join milestone_types m on m.track=t.track where t.archived_at is null limit 1;
  insert into tender_meetings(tender_id,milestone,topic,starts_at,organizer,participants,extra_emails)
  values(tender,stage,'QA',now()+interval '2 days',person,array[person],array[(select email from profiles where id=person),'test-qa@zekindo.co.id','test-qa@zekindo.co.id']) returning id into meeting;
  assert (select count(*)=4 from meeting_mail where meeting_id=meeting);
  update meeting_mail set sent_at=now() where meeting_id=meeting and kind='24 jam';
  update tender_meetings set starts_at=starts_at+interval '1 day' where id=meeting;
  assert (select count(*)=1 from meeting_mail where meeting_id=meeting and extra_email='test-qa@zekindo.co.id' and kind='update');
  update tender_meetings set extra_emails='{}' where id=meeting;
  assert (select count(*)=1 and min(subject) like 'Pembatalan%' from meeting_mail where meeting_id=meeting and extra_email='test-qa@zekindo.co.id' and sent_at is null);
  assert not valid_meeting_addresses(array['test@zekindo.co.id.example']);
end $$;
rollback;
