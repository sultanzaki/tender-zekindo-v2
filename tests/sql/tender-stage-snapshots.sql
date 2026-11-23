-- Run after 0013 on a seeded local database.
begin;
do $$
declare a text; b text; local_key text := 'local_00112233445566778899aabbccddeeff'; meeting uuid;
begin
  insert into tenders(period,area,customer) values('QA','QA','QA A') returning id into a;
  update tenders set milestone_order=array_append(milestone_order,local_key),
    milestone_labels=milestone_labels || jsonb_build_object(local_key,'Site visit'),
    milestones=jsonb_build_object(local_key,current_date+1) where id=a;
  insert into tenders(period,area,customer) values('QA','QA','QA B') returning id into b;
  assert not exists(select from milestone_types where key=local_key);
  assert not (select local_key=any(milestone_order) or milestone_labels ? local_key from tenders where id=b);
  insert into milestone_types(key,label,track,sort_order) values('fixtureDefault','New default','upstream',500);
  assert not (select milestone_labels ? 'fixtureDefault' from tenders where id=a);
  insert into tender_meetings(tender_id,milestone,topic,starts_at,participants,extra_emails)
    values(a,local_key,'Private meeting',now()+interval '2 days','{}',array['fixture@zekindo.co.id']) returning id into meeting;
  assert (select count(*)=2 and bool_and(body like '%Site visit%') from meeting_mail where meeting_id=meeting);
end $$;
rollback;
