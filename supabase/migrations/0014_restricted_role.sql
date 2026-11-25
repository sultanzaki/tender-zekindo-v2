-- Read-only role that never sees OE, OE note, bid value, IDR/L or Analytics.
-- The application removes those fields server-side (src/lib/tenders.ts).
alter type public.user_role add value if not exists 'restricted';
