-- Fictional sample data for LOCAL development only (`supabase db reset`).
-- Never contains real tenders: the company register is confidential and is
-- not stored in this repository. Safe to re-run: existing rows are kept,
-- nothing is truncated or overwritten.

insert into public.tenders (
  id, row_no, track, period, area, tender_no, customer, product, entitas,
  qty, oe, idr_per_l, milestones, result, remarks, nilai_penawaran
) values
  ('DEMO-0001', 1, 'upstream', '2026', 'Jawa', 'DEMO/001', 'Contoh Energi Tbk',
   'Demulsifier Supply (sample)', 'ZKI', 1000, 1000000, 1000,
   '{"regist":"2026-01-05","pq":"2026-01-20"}'::jsonb, null, 'Fictional sample', 900000),
  ('DEMO-0002', 2, 'upstream', '2026', 'Sumatera', 'DEMO/002', 'Sampel Migas',
   'Scale Inhibitor (sample)', 'TKT', null, null, null,
   '{"regist":"2026-02-10"}'::jsonb, 'WIN', null, null),
  ('DEMO-0003', 3, 'downstream', '2026', 'Kalimantan', 'DEMO/003', 'Ilustrasi Kimia',
   'Water Treatment (sample)', 'ZKI', null, 500000, null,
   '{"dsPendaftaran":"2026-03-01"}'::jsonb, 'LOSS PRICE', null, 450000)
on conflict (id) do nothing;

select setval('public.tenders_row_no_seq', greatest((select max(row_no) from public.tenders), 1));

insert into public.select_options (field, value)
select 'area', area from (select distinct area from public.tenders) as areas
on conflict do nothing;
