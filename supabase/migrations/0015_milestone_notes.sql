-- One note per milestone per tender, keyed like tenders.milestones.
-- Written by administrators from the Schedule tab; readable by every role.
-- Not part of the Excel export.
alter table public.tenders
  add column if not exists milestone_notes jsonb not null default '{}'::jsonb;
