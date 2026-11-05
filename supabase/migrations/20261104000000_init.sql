-- Initial schema: staff, clients, services, tickets, schedule, bookings, payments,
-- messaging, associates and settings. Times are timestamptz; the app shows Asia/Kolkata.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.staff_role as enum ('owner', 'admin');
create type public.case_type as enum ('A', 'B', 'C');
create type public.query_kind as enum ('new', 'followup');
create type public.ticket_status as enum (
  'submitted', 'pending_review', 'accepted', 'rejected', 'awaiting_slot', 'slot_held',
  'awaiting_payment', 'confirmed', 'replied', 'completed', 'cancelled', 'no_show'
);
create type public.ticket_decision as enum ('paid_booking', 'free_booking', 'text_reply', 'reject');
create type public.booking_status as enum ('held', 'confirmed', 'cancelled', 'expired', 'completed', 'no_show');
create type public.payment_status as enum ('created', 'captured', 'failed', 'refunded');
create type public.message_direction as enum ('inbound', 'outbound');
create type public.exception_kind as enum ('block', 'extra');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Staff (owner + admins). Users are invited by the owner; a row here grants access.
-- ---------------------------------------------------------------------------
create table public.staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role public.staff_role not null default 'admin',
  whatsapp_phone text,          -- receives new-ticket alerts
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index staff_single_owner on public.staff (role) where role = 'owner';
create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

create function public.is_staff() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and active);
$$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.staff where user_id = (select auth.uid()) and active and role = 'owner');
$$;

-- ---------------------------------------------------------------------------
-- Settings (singleton) and WhatsApp numbers
-- ---------------------------------------------------------------------------
create table public.whatsapp_numbers (
  id uuid primary key default gen_random_uuid(),
  display_phone text not null unique check (display_phone ~ '^\+[1-9][0-9]{7,14}$'),
  phone_number_id text not null unique,   -- Meta Cloud API id
  label text,
  created_at timestamptz not null default now()
);

create table public.settings (
  id boolean primary key default true check (id),
  business_name text not null default 'Astro Consult',
  active_whatsapp_number_id uuid references public.whatsapp_numbers (id) on delete set null,
  slot_hold_minutes integer not null default 15 check (slot_hold_minutes between 5 and 60),
  min_lead_minutes integer not null default 60 check (min_lead_minutes >= 0),
  booking_window_days integer not null default 14 check (booking_window_days between 1 and 90),
  privacy_policy_version text not null default '2026-11-01',
  updated_at timestamptz not null default now()
);
insert into public.settings default values;
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

-- What the public landing page may read (no ids or internals).
create function public.public_config() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'businessName', s.business_name,
    'whatsappNumber', w.display_phone,
    'bookingWindowDays', s.booking_window_days,
    'privacyPolicyVersion', s.privacy_policy_version
  )
  from public.settings s
  left join public.whatsapp_numbers w on w.id = s.active_whatsapp_number_id;
$$;

-- ---------------------------------------------------------------------------
-- Services and associates (referral contacts shown below the form)
-- ---------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  name jsonb not null check (name ? 'en'),        -- {"en": "...", "kn": "...", "hi": "..."}
  description jsonb,
  price_inr integer check (price_inr >= 0),
  duration_minutes integer not null default 30 check (duration_minutes > 0),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger services_updated_at before update on public.services
  for each row execute function public.set_updated_at();

create table public.associates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  services jsonb not null check (services ? 'en'),
  phone text not null check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger associates_updated_at before update on public.associates
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Clients and tickets
-- ---------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  whatsapp_phone text check (whatsapp_phone ~ '^\+[1-9][0-9]{7,14}$'),
  name text,
  email text,
  -- true once staff confirm a self-declared or imported existing client
  verified_existing boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clients_updated_at before update on public.clients
  for each row execute function public.set_updated_at();

create table public.ticket_ref_counters (
  period text primary key,      -- IST yymm
  last_value integer not null
);

-- AST-yymm-nnnn, sequence resets monthly (IST). Mirrors formatTicketRef() in @astro/shared.
create function public.next_ticket_ref() returns text
language plpgsql security definer set search_path = '' as $$
declare
  p text := to_char(now() at time zone 'Asia/Kolkata', 'YYMM');
  n integer;
begin
  insert into public.ticket_ref_counters (period, last_value) values (p, 1)
  on conflict (period) do update set last_value = public.ticket_ref_counters.last_value + 1
  returning last_value into n;
  return 'AST-' || p || '-' || lpad(n::text, 4, '0');
end $$;

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique default public.next_ticket_ref(),
  client_id uuid not null references public.clients (id) on delete restrict,
  service_id uuid references public.services (id) on delete set null,
  case_type public.case_type not null,
  query_kind public.query_kind not null default 'new',
  claims_existing boolean not null default false,
  followup_of uuid references public.tickets (id) on delete set null,
  is_anonymous boolean not null default false,
  display_name text,
  concern text not null check (length(concern) between 10 and 4000),
  language text not null default 'en' check (language in ('en', 'kn', 'hi')),
  status public.ticket_status not null,
  decision public.ticket_decision,
  decided_by uuid references public.staff (user_id) on delete set null,
  decided_at timestamptz,
  reply_text text,              -- for text_reply decisions
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tickets_status_idx on public.tickets (status, created_at desc);
create index tickets_client_idx on public.tickets (client_id, created_at desc);
create trigger tickets_updated_at before update on public.tickets
  for each row execute function public.set_updated_at();

create table public.ticket_events (
  id bigint generated always as identity primary key,
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  from_status public.ticket_status,
  to_status public.ticket_status not null,
  actor uuid references public.staff (user_id) on delete set null,  -- null = system/client
  note text,
  created_at timestamptz not null default now()
);
create index ticket_events_ticket_idx on public.ticket_events (ticket_id, created_at);

-- Every status change is recorded automatically.
create function public.log_ticket_status() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.ticket_events (ticket_id, from_status, to_status, actor)
    values (new.id, case when tg_op = 'UPDATE' then old.status end, new.status,
            case when public.is_staff() then (select auth.uid()) end);
  end if;
  return new;
end $$;
create trigger tickets_log_status after insert or update of status on public.tickets
  for each row execute function public.log_ticket_status();

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  size_bytes integer not null check (size_bytes between 1 and 5242880),
  created_at timestamptz not null default now()
);

create table public.consents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  ticket_id uuid references public.tickets (id) on delete set null,
  policy_version text not null,
  accepted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Schedule (Manage Schedule page) and bookings
-- ---------------------------------------------------------------------------
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  weekday smallint not null check (weekday between 0 and 6),   -- 0 = Sunday
  start_time time not null,
  end_time time not null,
  slot_minutes integer not null default 30 check (slot_minutes between 10 and 180),
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  check (end_time > start_time)
);
create trigger availability_rules_updated_at before update on public.availability_rules
  for each row execute function public.set_updated_at();

create table public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  kind public.exception_kind not null,
  start_time time,              -- null + null = whole day (block only)
  end_time time,
  slot_minutes integer check (slot_minutes between 10 and 180),
  note text,
  created_at timestamptz not null default now(),
  check ((start_time is null) = (end_time is null)),
  check (start_time is null or end_time > start_time),
  check (kind = 'block' or start_time is not null)
);
create index availability_exceptions_date_idx on public.availability_exceptions (date);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  slot tstzrange not null check (not isempty(slot) and lower_inc(slot) and not upper_inc(slot)),
  status public.booking_status not null default 'held',
  hold_expires_at timestamptz,
  meeting_url text,
  created_by uuid references public.staff (user_id) on delete set null,  -- staff booking on behalf
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'held' or hold_expires_at is not null),
  -- The real guard against double-booking: no two active bookings may overlap.
  constraint bookings_no_overlap exclude using gist (slot with &&)
    where (status in ('held', 'confirmed'))
);
create unique index bookings_one_active_per_ticket on public.bookings (ticket_id)
  where status in ('held', 'confirmed');
create index bookings_slot_idx on public.bookings using gist (slot);
create trigger bookings_updated_at before update on public.bookings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Payments and messaging
-- ---------------------------------------------------------------------------
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete restrict,
  booking_id uuid references public.bookings (id) on delete set null,
  razorpay_order_id text not null unique,
  razorpay_payment_id text unique,   -- webhook idempotency key
  amount_paise integer not null check (amount_paise > 0),
  currency text not null default 'INR',
  status public.payment_status not null default 'created',
  raw jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payments_updated_at before update on public.payments
  for each row execute function public.set_updated_at();

create table public.message_log (
  id bigint generated always as identity primary key,
  direction public.message_direction not null,
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'sms', 'email', 'push')),
  to_phone text,
  from_phone text,
  client_id uuid references public.clients (id) on delete set null,
  ticket_id uuid references public.tickets (id) on delete set null,
  template text,
  body text,
  provider_message_id text unique,   -- Meta wamid; dedupes webhook retries
  status text,                       -- sent / delivered / read / failed
  error text,
  created_at timestamptz not null default now()
);
create index message_log_ticket_idx on public.message_log (ticket_id, created_at);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets (id) on delete cascade,
  associate_id uuid not null references public.associates (id) on delete cascade,
  created_by uuid references public.staff (user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (ticket_id, associate_id)
);

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- Clients never touch tables directly: their writes go through Edge Functions
-- (service role). Anonymous visitors may read only active services/associates
-- and public_config(). Staff get full access; owner-only for staff/settings/numbers.
-- ---------------------------------------------------------------------------
alter table public.staff enable row level security;
alter table public.settings enable row level security;
alter table public.whatsapp_numbers enable row level security;
alter table public.services enable row level security;
alter table public.associates enable row level security;
alter table public.clients enable row level security;
alter table public.ticket_ref_counters enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_events enable row level security;
alter table public.attachments enable row level security;
alter table public.consents enable row level security;
alter table public.availability_rules enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.bookings enable row level security;
alter table public.payments enable row level security;
alter table public.message_log enable row level security;
alter table public.referrals enable row level security;

-- Public read
create policy "public reads active services" on public.services
  for select to anon, authenticated using (active or (select public.is_staff()));
create policy "public reads active associates" on public.associates
  for select to anon, authenticated using (active or (select public.is_staff()));

-- Staff: read team; owner manages it
create policy "staff read team" on public.staff
  for select to authenticated using ((select public.is_staff()));
create policy "owner manages team" on public.staff
  for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

-- Owner-only configuration
create policy "staff read settings" on public.settings
  for select to authenticated using ((select public.is_staff()));
create policy "owner updates settings" on public.settings
  for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "staff read numbers" on public.whatsapp_numbers
  for select to authenticated using ((select public.is_staff()));
create policy "owner manages numbers" on public.whatsapp_numbers
  for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));

-- Everything operational: any active staff member (owner or admin)
create policy "staff manage services" on public.services
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage associates" on public.associates
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage clients" on public.clients
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage tickets" on public.tickets
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff read ticket events" on public.ticket_events
  for select to authenticated using ((select public.is_staff()));
create policy "staff manage attachments" on public.attachments
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff read consents" on public.consents
  for select to authenticated using ((select public.is_staff()));
create policy "staff manage rules" on public.availability_rules
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage exceptions" on public.availability_exceptions
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff manage bookings" on public.bookings
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));
create policy "staff read payments" on public.payments
  for select to authenticated using ((select public.is_staff()));
create policy "staff read messages" on public.message_log
  for select to authenticated using ((select public.is_staff()));
create policy "staff manage referrals" on public.referrals
  for all to authenticated using ((select public.is_staff())) with check ((select public.is_staff()));

-- Lock down helper functions: only what the app calls is executable by API roles.
revoke execute on function public.next_ticket_ref() from public, anon;
grant execute on function public.public_config() to anon, authenticated;

-- Realtime for the admin inbox
alter publication supabase_realtime add table public.tickets;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for client uploads (palm photos, horoscope PDFs).
-- Uploads go through signed upload URLs issued by submit-ticket.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']);

create policy "staff read attachments" on storage.objects
  for select to authenticated using (bucket_id = 'attachments' and (select public.is_staff()));
create policy "staff delete attachments" on storage.objects
  for delete to authenticated using (bucket_id = 'attachments' and (select public.is_staff()));
