# Astrology Service Platform: Phase 1 Tech-Stack Plan

## Context
One astrologer (owner) and one assistant serve clients in India who currently find them by word of mouth. Today a client only has a WhatsApp number. The goal is that a client sends "Hi", gets back a link, and the link opens a browser app. There the client picks a service, fills in one shared concern form (with an anonymous option and uploads), and gets a ticket number on WhatsApp. The provider side reviews tickets, manages slots and takes payments. Every status change goes to the client on WhatsApp.

After a consultation, the astrologer often sends clients on to 1–2 associate practitioners for follow-on services. The app lists these associates below the form, and the list can grow over time.

Volume is about 2–3 tickets a day, so the stack should cost close to ₹0, need almost no ops work, and fit a React / React Native / Node / PWA engineer.

**Decisions you made:** India · personal WhatsApp number today · free tiers · no client login (magic link + OTP to track a ticket) · English + 1–2 regional languages · admin side is an installable PWA · uploads needed · no domain yet · existing clients found by phone lookup + self-declaration · Razorpay from v1 · after accepting a new client's ticket, the provider picks the next step per ticket.

---

## 1. Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Frontend (client + admin) | **React 19 + Vite + TypeScript** in one PWA (`vite-plugin-pwa`), with route groups `/` (public) and `/admin` | Your strongest skill. One codebase, installable, works from a plain link. No SEO needs, so no Next.js is required |
| UI | Tailwind CSS + shadcn/ui; react-hook-form + zod | Fast, accessible forms; zod schemas shared with the backend |
| Data/state | TanStack Query + supabase-js; React Router | Simple caching; realtime ticket list for the admin side |
| i18n | react-i18next (en, kn/hi); service names stored per language in the DB | Language toggle from day one |
| Backend | **Supabase**: Postgres, Auth, Storage, Edge Functions (TypeScript/Deno), pg_cron | One managed service with a generous free tier. Postgres can lock slots safely. Row-Level Security instead of a custom API server |
| Server logic | Supabase Edge Functions: `submit-ticket`, `whatsapp-webhook`, `send-message`, `razorpay-webhook`, `create-order`, `book-slot` | All secrets stay server-side; webhooks land here |
| Scheduled jobs | pg_cron + pg_net → edge function | Reminders (24h / 1h before a call), expiring unpaid slot holds |
| WhatsApp | **Meta WhatsApp Cloud API** (direct, no BSP markup) on the existing number via **coexistence** (Business app and API on one number) | Replies inside the 24h window the client's "Hi" opens are free. Templates for reminders and status updates later |
| OTP / SMS | WhatsApp **authentication template** for OTP, plugged in through Supabase Auth's *Send SMS hook*; SMS fallback later via MSG91 (needs DLT) | WhatsApp OTP is cheaper and needs no DLT. SMS is optional |
| Payments | **Razorpay** Orders API + Standard Checkout inside the app's booking page; the `payment.captured` webhook is the source of truth (idempotent by payment id) | UPI/cards/INR, no setup fee, about 2% per transaction. One integration: WhatsApp messages link to the booking page instead of separate payment links |
| Files | Supabase Storage, private bucket, signed URLs; client-side image compression, 5 MB limit | Palm photos and horoscope PDFs |
| Provider alerts | Web Push from the PWA (iOS 16.4+ when installed) + WhatsApp utility template to the assistant's personal number + email via Resend (free tier) | Several channels so a ticket is never missed |
| Hosting | **Cloudflare Pages** for the PWA; Cloudflare DNS; Supabase project in the **Mumbai (ap-south-1)** region | The free plan allows commercial use (Vercel Hobby does not). Preview deploys. Data stays in India (low latency, DPDP-friendly) |
| Domain | Buy a `.in` domain (about ₹500–900/yr) | Trustworthy link in WhatsApp replies |
| Video call (later) | v1: WhatsApp call or a manual Google Meet link. Later: auto-create Meet links via the Google Calendar API, or embed Daily.co (free 10k min/mo) | No cost until it is needed |
| Monitoring | Sentry (free), Supabase logs; GitHub Actions for CI, a nightly encrypted `pg_dump` to Cloudflare R2 (free 10 GB), and a keep-alive ping | The free tier has no backups and pauses projects after 7 idle days |

### Stack review: alternatives considered and the decision
| Question | Alternative | Verdict |
|---|---|---|
| Supabase or Firebase? | Firebase (Firestore + Functions) | **Supabase.** The data is relational (clients → tickets → bookings → payments). A Postgres exclusion constraint makes double-booking impossible at the DB level, which Firestore cannot do as cleanly. Firebase Functions also need the Blaze (card-on-file) plan |
| Supabase or my own Node API + Neon/Render? | Express/Fastify on Render + Neon | **Supabase.** A custom server means writing your own auth, storage, cron and RLS, and Render's free tier sleeps (slow webhooks). Edge Functions are plain TypeScript HTTP handlers, so moving to Node later is easy, and Postgres is portable |
| Vite SPA or Next.js? | Next.js on Vercel | **Vite SPA.** No SEO need. WhatsApp link previews only need static OG tags in `index.html`. Vercel Hobby forbids commercial use. Vite is lighter for a PWA |
| PWA or React Native? | Expo app for admins | **PWA.** One codebase. Web push works on Android and on iOS 16.4+ (installed). If iOS push proves unreliable, add a Capacitor wrapper later without a rewrite |
| Meta Cloud API direct or a BSP? | Interakt/AiSensy/Gupshup | **Direct first** (no monthly fee). Use a BSP only if coexistence onboarding requires one. This is decided by an M0 spike |
| Custom OTP or Supabase Auth? | Hand-rolled OTP table | **Supabase Auth phone OTP** (built-in expiry and rate limits) with the Send SMS hook delivering over WhatsApp. Gives the client a scoped session for RLS |
| Build a calendar or use Cal.com/Calendly? | Cal.com embed | **Build it.** The rules (paid hold, provider decision, per-case flow) are custom, and a slot table + constraint is small. Google Calendar sync can come later |

**Known limits to watch:** Supabase free tier gives 500 MB DB / 1 GB storage (fine with compressed images at about 3/day; upgrade to Pro $25/mo when needed). Coexistence requires opening the WhatsApp Business app on the phone at least every ~14 days. Times are stored as `timestamptz` and shown in Asia/Kolkata.

**Repo layout (pnpm):** `apps/web` (PWA) · `supabase/migrations` · `supabase/functions` · `packages/shared` (zod schemas, types, i18n keys).

---

## 2. Core flows

**Entry:** the client sends "Hi" → `whatsapp-webhook` replies with a free service message: a greeting + `https://<domain>/?ref=wa&p=<signed phone token>`. The token pre-fills the phone number and the "same as WhatsApp" checkbox.

**Form submit (`submit-ticket`):** validate with zod → look up the phone in `clients`. If the number is known, the form asks *"New query or follow-up?"*. If not, the client can tick *"I have consulted before"*, which the provider verifies. The ticket is created with a human-readable ref (`AST-2611-0042`) → WhatsApp confirmation with the ref and a magic tracking link → push + WhatsApp alert to the provider.

**Three ticket paths (one state machine):**

| Case | Detection | Flow |
|---|---|---|
| A. Existing client, new query | known phone (or verified self-declared) + "new" | choose slot → slot **held 15 min** → Razorpay Checkout → on `payment.captured`, booking confirmed → WhatsApp |
| B. Existing client, follow-up | known phone + "follow-up" (optionally linked to an old ticket) | `pending_review` → provider picks **paid booking** (behaves like A) or **free reply** (*free slot booking* or *text reply only*) → WhatsApp with the right link |
| C. New client | unknown phone | `pending_review` → provider **Accepts** (picking *paid booking / free booking / text reply only*) or **Rejects** → WhatsApp with the result and the right link |

B and C share one **Decision** dialog in the admin side (Accept with paid / free booking / text reply, or Reject). A skips review and goes straight to slot + payment.

Statuses: `submitted → pending_review → accepted/rejected → awaiting_slot → slot_held → awaiting_payment → confirmed → completed / cancelled / no_show`. Every transition writes `ticket_events` and sends the matching WhatsApp template.

**Calendar (built in, no third-party service):** weekly `availability_rules` + `availability_exceptions` (leave, holidays) → slots are generated on the fly. A Postgres **exclusion constraint** on `bookings` (tstzrange, for active statuses) makes double-booking impossible. pg_cron releases expired holds. The client and admin see the same slot view; the admin can also block slots or book on a client's behalf. Optional Google Calendar sync later.

**Admin PWA:** login by email magic link (Supabase Auth; `staff.role` = owner | admin) · ticket inbox (realtime, filter by status/case) · ticket detail with attachments, client history and actions (decide/reply/mark completed) · services editor (multilingual) · client import (CSV) · message log. Master/settings pages:
- **Manage Schedule (master), for the owner and all admins:** turn each weekday on or off and set its time ranges + slot length. Per-date overrides (block a day or slot, add extra hours). Week view shows booked, held and free slots.
- **Team:** the owner invites admins by email (Supabase invite), changes roles or removes them. Only the owner can manage team and WhatsApp settings. Admins can handle tickets, the schedule, services and associates.
- **WhatsApp settings:** the active business number shown in links and on the landing page, and its Cloud API `phone_number_id`. Adding a *new* number still needs a one-time Meta registration of that number under the same WhatsApp Business Account (Meta allows several numbers per account). The app then lists the registered numbers and the owner switches the active one. The switch updates the reply links, the wa.me "Start" link and the QR code.
- **Associates:** add, edit, reorder and hide referral contacts (name, services offered, phone, i18n text).

**Landing page:** services list → shared concern form → **"Further consultations" section** below the form, listing the active associates with tap-to-call and WhatsApp buttons. The data comes from the `associates` table, so adding a third person is an admin edit, not a code change.

**Later (fits the referral workflow):** when marking a ticket completed, the astrologer can tick the associate(s) to refer. The client then gets their contact card on WhatsApp, and the referral is logged.

**Client tracking (no account):** a per-ticket signed magic link in WhatsApp opens the ticket status and the booking/payment screen. If the link is lost, the client verifies their phone by WhatsApp OTP and sees their tickets.

---

## 3. Data model (Postgres)
`staff`, `clients` (phone E.164 unique, name, is_anonymous, email, verified_existing), `services` (i18n jsonb, active, price, duration, needs_payment default), `tickets` (ref, client_id, service_id, case_type, is_followup_of, concern, status, decision, decided_by), `ticket_events`, `attachments`, `availability_rules`, `availability_exceptions`, `bookings` (tstzrange + exclusion constraint, hold_expires_at, meeting_url), `payments` (razorpay ids, amount, status), `message_log` (direction, template, wa_message_id, status), `consents`, `associates` (name, services i18n, phone, sort_order, active), `referrals` (ticket_id, associate_id; later), `settings` (singleton: active whatsapp number + phone_number_id, slot length, hold minutes, business name), `whatsapp_numbers` (registered numbers).
RLS: the public side can do nothing directly. All client writes go through edge functions (service role). Staff get full access through their role.

---

## 4. Long-lead setup (start in week 1, these take days to weeks)
1. **WhatsApp:** move the personal number to the **WhatsApp Business app** (chats migrate) → create a Meta Business Portfolio → **business verification** → onboard the number to the Cloud API in coexistence mode. *Risk:* coexistence onboarding goes through Embedded Signup, which may require a Meta Tech Provider or a BSP (e.g. Interakt/AiSensy/Gupshup, with a monthly fee). Fallback: a dedicated new number on the plain Cloud API. Confirm this first. Note: without coexistence, a number moved to the Cloud API can no longer be used in the WhatsApp phone app. Zero-risk interim for the entry step: the Business app's built-in *greeting message* can already send the app link on "Hi" before the API is live.
2. **Templates:** submit the utility templates (ticket received, accepted/rejected, slot confirmed, reminder, booking/payment request) and one authentication (OTP) template for approval.
3. **Razorpay KYC** (individual/proprietor + bank account). *Risk:* astrology/spiritual services can face extra category review. Confirm acceptance early; fallbacks are Cashfree or PhonePe PG.
4. **Domain** purchase + Cloudflare DNS. Privacy policy + terms pages (India **DPDP Act 2023**: consent checkbox on the form, retention policy, a delete-my-data request).
5. MSG91 + DLT registration only if SMS turns out to be required.

---

## 5. Running cost (about 3 tickets/day; prices approximate, verify at signup)
- Supabase, Cloudflare Pages, Sentry, Resend: **₹0**
- Domain: about ₹70/mo
- WhatsApp: replies inside the 24h window are free. Utility/auth templates are roughly ₹0.12–0.15 each → about ₹50–150/mo
- Razorpay: about 2% of collected payments
- **Total: under ₹300/mo + payment fees.** Upgrade path: Supabase Pro ($25/mo) when backups or no-pause matter.

---

## 6. Phase 2 build milestones
- **M0** Accounts + long-lead items (section 4); repo scaffold, Supabase project, CI, deploy.
- **M1** Landing + services list + concern form + uploads + associates section + ticket creation + admin inbox/login + Team page + Associates editor. i18n scaffold.
- **M2** WhatsApp: "Hi" auto-reply, ticket confirmation, status templates, provider alerts, message log, WhatsApp settings page; WhatsApp OTP + magic links.
- **M3** Manage Schedule master page, slot picker, holds, cases A/B/C state machine + Decision dialog, reminders via pg_cron.
- **M4** Razorpay Orders + Checkout + webhook → booking confirmation.
- **M5** PWA polish (install prompt, web push), client CSV import, backups, Sentry.
- **Later:** video links (Meet/Daily), SMS fallback, Google Calendar sync, analytics.

---

## 7. Verification (per milestone)
- Local dev: `supabase start` (local Postgres/Auth/Storage/Functions) + `pnpm dev`. Migrations tested with `supabase db reset`.
- Unit tests (Vitest) for the slot generator, the case A/B/C decision logic and the zod schemas. A DB test that two concurrent bookings of one slot → one fails (exclusion constraint).
- WhatsApp: use Meta's free **test number** in the Cloud API sandbox to exercise the webhook → reply → template flows before the real number goes live.
- Razorpay **test mode** keys + test UPI/cards. Replay webhooks and confirm the booking flips to `confirmed` exactly once (idempotent by payment id).
- E2E (Playwright) on a preview deploy: Hi link → form → ticket ref → admin accept → slot → pay → confirmation, at mobile viewport.
- PWA: Lighthouse PWA checks; install + push test on Android Chrome and on an iPhone (home-screen install).
