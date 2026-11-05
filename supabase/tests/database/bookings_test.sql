-- Run with `pnpm exec supabase test db` (needs the local stack / Docker; CI runs it).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into public.clients (id, phone) values ('00000000-0000-0000-0000-0000000000c1', '+919876543210');
insert into public.tickets (id, client_id, case_type, concern, status) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', 'C', 'A concern long enough', 'pending_review'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c1', 'A', 'Another concern here', 'awaiting_slot');

select matches(
  (select ref from public.tickets where id = '00000000-0000-0000-0000-0000000000a1'),
  '^AST-\d{4}-\d{4}$', 'tickets get a human-readable ref');

select is(
  (select count(*)::int from public.ticket_events where ticket_id = '00000000-0000-0000-0000-0000000000a1'),
  1, 'creating a ticket logs its first status');

insert into public.bookings (ticket_id, slot, status, hold_expires_at) values
  ('00000000-0000-0000-0000-0000000000a1', '[2026-11-09 10:00+05:30, 2026-11-09 10:30+05:30)', 'held', now() + interval '15 min');

select throws_ok(
  $$ insert into public.bookings (ticket_id, slot, status) values
     ('00000000-0000-0000-0000-0000000000a2', '[2026-11-09 10:15+05:30, 2026-11-09 10:45+05:30)', 'confirmed') $$,
  '23P01', null, 'overlapping active bookings are rejected');

select lives_ok(
  $$ insert into public.bookings (ticket_id, slot, status) values
     ('00000000-0000-0000-0000-0000000000a2', '[2026-11-09 10:30+05:30, 2026-11-09 11:00+05:30)', 'confirmed') $$,
  'adjacent slots are allowed');

update public.bookings set status = 'expired' where ticket_id = '00000000-0000-0000-0000-0000000000a1';
select lives_ok(
  $$ insert into public.bookings (ticket_id, slot, status, hold_expires_at) values
     ('00000000-0000-0000-0000-0000000000a1', '[2026-11-09 10:00+05:30, 2026-11-09 10:30+05:30)', 'held', now() + interval '15 min') $$,
  'an expired hold frees the slot');

set local role anon;
select is((select count(*)::int from public.tickets), 0, 'anonymous visitors cannot read tickets');
reset role;

select * from finish();
rollback;
