# M0 Account Setup Checklist

Work top to bottom. Items marked ⏳ have outside waiting times (approvals, KYC, DNS), so start them on day 1 and build while you wait. Prices and steps change; check them on each provider's site as you go.

**Who does what:** 🧑‍💻 = you (developer) · 🧘 = the astrologer (owner). Their documents, phone or presence are needed.

---

## 0. Gather first (🧘, before anything else)

- [ ] **Legal identity** for payments and Meta: individual or sole proprietorship. Ask a CA whether GST registration is needed.
- [ ] Documents ready as clear scans: PAN, Aadhaar, cancelled cheque or bank statement for the payout account, address proof. If a proprietorship, also a business proof (GST certificate, Udyam registration or Shop & Establishment licence).
- [ ] **Business email**. A new Gmail is fine at first (e.g. `astroconsult.business@gmail.com`); later it moves to the domain.
- [ ] The **phone** with the current WhatsApp number, plus a full chat backup.
- [ ] Decisions: consultation **prices**, **slot length** (30 min?), **refund/cancellation policy**, working hours.
- [ ] Content for Phase 2: the **services list** (name + short description, in English, Kannada and Hindi if possible), and the **associates** (name, services offered, phone).

## 1. Domain + Cloudflare (🧑‍💻, day 1) ⏳ DNS: minutes to hours

- [ ] Pick and buy a `.in` domain (Cloudflare Registrar, or another registrar about ₹500–900/yr). Keep it short, since it goes into every WhatsApp reply.
- [ ] Create a Cloudflare account (owner's business email, you as a member) and add the domain. Point the nameservers to Cloudflare if you bought it elsewhere.

## 2. GitHub (🧑‍💻)

- [ ] Create a private repo and push this scaffold (`git remote add origin …; git push -u origin main`).
- [ ] Check that the **CI** workflow passes (web, functions, database jobs).

## 3. Supabase (🧑‍💻, about 15 min)

- [ ] Create an org (owner's email, you as a member) and a project named `astro-platform`, region **Mumbai (ap-south-1)**. Save the DB password in a password manager.
- [ ] `pnpm exec supabase login` → `pnpm exec supabase link --project-ref <ref>` → `pnpm exec supabase db push`
- [ ] Project Settings → API: copy the **Project URL** and the **publishable (anon) key** (for the web app), and the **service role / secret key** (Edge Functions only; never in the browser).
- [ ] Auth → URL configuration: Site URL `https://<domain>`. Redirect URLs `https://<domain>/admin` and `http://localhost:5173/admin`.
- [ ] Auth → SMTP: plug in Resend (step 5). Supabase's built-in mailer is heavily rate-limited and only meant for testing, so admin magic links need custom SMTP.
- [ ] Create the **owner account**: Authentication → Invite user → then run the `insert into public.staff …` snippet from the README.
- [ ] Deploy the functions: `pnpm exec supabase functions deploy` and set secrets with `pnpm exec supabase secrets set --env-file supabase/functions/.env`.
- [ ] GitHub repo → Settings → Secrets: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (used by the keep-alive workflow).

## 4. Cloudflare Pages (🧑‍💻, about 10 min)

- [ ] Workers & Pages → Create → Pages → connect the GitHub repo.
  - Build command: `pnpm install --frozen-lockfile && pnpm --filter web build`
  - Output directory: `apps/web/dist`
  - Env vars: `NODE_VERSION=22`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
- [ ] Custom domain: attach `<domain>` (and `www` → redirect).
- [ ] Open the site on a phone and confirm it loads and offers "Add to Home Screen".

## 5. Resend email (🧑‍💻) ⏳ DNS verification

- [ ] Sign up and add the domain → add the DNS records it shows in Cloudflare (SPF/DKIM) → wait for verification.
- [ ] Create SMTP credentials → Supabase Auth → SMTP settings (sender `no-reply@<domain>`).
- [ ] Send yourself an admin magic link from `/admin/login` to confirm.

## 6. WhatsApp Business Platform (🧘 + 🧑‍💻) ⏳ the longest item, 1–3 weeks

**6a. Move the number to WhatsApp Business (🧘, 30 min)**
- [ ] Back up chats. Install the **WhatsApp Business** app and register the same number; it offers to move the existing chats.
- [ ] Fill in the business profile (name, category, description, hours, website = `<domain>`).
- [ ] **Interim, zero-cost entry point:** Business tools → Greeting message → "Namaste! Please share your concern here: https://<domain>". This works on "Hi" before the API is ready.

**6b. Developer spike on Meta's test number (🧑‍💻, 1–2 hours, no verification needed)**
- [ ] Create a Meta developer account at developers.facebook.com → create an app (type Business) → add the **WhatsApp** product.
- [ ] Use the free **test number** to send the `hello_world` template to your own phone.
- [ ] Set the webhook: Callback URL `https://<project-ref>.supabase.co/functions/v1/whatsapp-webhook`, Verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to `messages`. Set `WHATSAPP_APP_SECRET` (App settings → Basic). Send "Hi" to the test number and confirm a row appears in `message_log`.

**6c. Business verification (🧘 documents, 🧑‍💻 forms)**
- [ ] Create a **Meta Business Portfolio** at business.facebook.com with the business email.
- [ ] Security Centre → **Business verification**: legal name, address and phone matching a document (GST / Udyam / utility bill), plus a website that shows the same name. You can use the API before verification, but at low messaging limits.

**6d. Coexistence decision (🧑‍💻): record the outcome in the Decision log below**
- [ ] Check whether *your* app can onboard an existing WhatsApp Business app number with **coexistence** through Embedded Signup. This may require becoming a Meta Tech Provider. Note: coexistence needs the Business app opened on the phone regularly (about every 14 days).
- [ ] If direct onboarding isn't possible, compare one or two Indian BSPs that support coexistence (e.g. Interakt, AiSensy, Gupshup): monthly fee, per-message markup, API/webhook access.
- [ ] Fallback if neither works: a **new dedicated number** on the plain Cloud API, and keep the personal/Business-app number for calls.

**6e. Production number (🧑‍💻)**
- [ ] Add the number to the WhatsApp Business Account → request **display name** approval (must match the business/website).
- [ ] Create a **System User** (Business settings → Users → System users) with a permanent token scoped to the WhatsApp account → `WHATSAPP_ACCESS_TOKEN`. Copy `WHATSAPP_PHONE_NUMBER_ID`.
- [ ] Add a **payment method** to the WhatsApp Business Account (template messages are billed per message in INR).

**6f. Message templates (🧑‍💻 drafts, 🧘 approves wording) ⏳ approval: minutes to 2 days**
Submit in English first; add `kn`/`hi` translations of each later.

| Name | Category | Purpose |
|---|---|---|
| `ticket_received` | Utility | "Your request {{ref}} is received. Track: {{link}}" |
| `ticket_decision` | Utility | Accepted/rejected + next step link |
| `booking_request` | Utility | "Please choose a time (and pay) here: {{link}}" |
| `slot_confirmed` | Utility | Date/time confirmation |
| `slot_reminder` | Utility | 24h / 1h reminders |
| `staff_new_ticket` | Utility | Alert to owner/admin phones |
| `login_otp` | Authentication | OTP for ticket tracking |

## 7. Razorpay (🧘 KYC, 🧑‍💻 integration) ⏳ KYC: 2–7 working days

- [ ] Sign up at razorpay.com with the business email → start **activation/KYC** (PAN, bank account, business proof).
- [ ] Ask Razorpay support early whether **astrology/spiritual consultation** is an accepted category for your entity type. If not, try Cashfree or PhonePe PG.
- [ ] Have these pages **live on the domain** before activation review (gateways check for them): Contact, Privacy Policy, Terms & Conditions, Refund & Cancellation Policy, and pricing for services.
- [ ] Meanwhile use **Test mode**: API keys → `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
- [ ] Webhooks: URL `https://<project-ref>.supabase.co/functions/v1/razorpay-webhook`, events `payment.captured`, `payment.failed`, `order.paid`, secret → `RAZORPAY_WEBHOOK_SECRET`. Repeat with live keys after activation.

## 8. Legal pages and privacy (🧘 content, 🧑‍💻 pages)

- [ ] Privacy Policy covering the **DPDP Act 2023**: what is collected (name, phone, concern, uploads), why, retention period, the right to deletion, and a grievance contact.
- [ ] Terms, Refund & Cancellation, Contact (address, email, phone).
- [ ] Set `settings.privacy_policy_version` when the policy changes. The form stores consent per ticket.

## 9. Monitoring (🧑‍💻, optional in M0)

- [ ] Sentry: create a React project and note the DSN (wired in M5).

## Later only if needed

- MSG91 + **DLT** registration (principal entity, headers, templates) for SMS fallback.
- Google Calendar API / Daily.co for video links.
- Supabase Pro ($25/mo) when daily backups and no auto-pause are needed.

---

## Values to collect → where they go

| Value | From | Goes to |
|---|---|---|
| Supabase URL, publishable key | Supabase → API | `apps/web/.env.local`, Cloudflare Pages env, GitHub secrets |
| Supabase service role key | Supabase → API | Edge Functions only (set automatically on hosted) |
| `WHATSAPP_VERIFY_TOKEN` | you generate (`openssl rand -hex 24`) | function secrets + Meta webhook config |
| `WHATSAPP_APP_SECRET` | Meta app → Settings → Basic | function secrets |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` | Meta System User / API setup | function secrets (+ `whatsapp_numbers` table) |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | Razorpay dashboard | function secrets |
| `LINK_SIGNING_SECRET` | you generate (`openssl rand -hex 32`) | function secrets |
| Resend SMTP credentials | Resend | Supabase Auth → SMTP |

Store every credential in a password manager shared with the owner. Never commit them.

## Decision log

| Decision | Options | Outcome | Date |
|---|---|---|---|
| WhatsApp onboarding route | Direct coexistence / BSP coexistence / new number | | |
| Legal entity for payments | Individual / proprietorship | | |
| Payment gateway | Razorpay / Cashfree / PhonePe | | |
| Domain | | | |
| Prices, slot length, refund policy | | | |
