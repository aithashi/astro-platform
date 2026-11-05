-- Local development data only (runs on `supabase db reset`). Replace with real
-- services and associates through the admin pages once they exist.

insert into public.services (name, description, price_inr, duration_minutes, sort_order) values
  ('{"en": "Horoscope reading (sample)", "kn": "ಜಾತಕ ಪರಿಶೀಲನೆ", "hi": "कुंडली विश्लेषण"}',
   '{"en": "Placeholder service until the real list is provided."}', 1100, 30, 1),
  ('{"en": "Family and relationships (sample)"}', null, 1100, 30, 2),
  ('{"en": "Health and well-being (sample)"}', null, 1100, 30, 3);

insert into public.associates (name, services, phone, sort_order) values
  ('Sample Associate One', '{"en": "Vastu consultation (sample)"}', '+919000000001', 1),
  ('Sample Associate Two', '{"en": "Ayurveda and diet (sample)"}', '+919000000002', 2);

-- Mon–Sat 10:00–13:00 and 17:00–19:00, 30-minute slots.
insert into public.availability_rules (weekday, start_time, end_time, slot_minutes)
select d, t.s, t.e, 30
from generate_series(1, 6) d
cross join (values ('10:00'::time, '13:00'::time), ('17:00'::time, '19:00'::time)) t(s, e);
