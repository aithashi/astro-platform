# Astro Platform

A two-sided consultation platform for one astrologer and their team. A client sends "Hi" on WhatsApp and gets a link. The link opens the app, where the client picks a service, shares their concern and gets a ticket number. The provider then reviews the ticket, books a slot and takes payment. Status updates go back to the client on WhatsApp.

- Plan: [docs/phase1-tech-stack-plan.md](docs/phase1-tech-stack-plan.md)
- Account setup: [docs/setup-checklist.md](docs/setup-checklist.md)

## Layout

| Path | What |
|---|---|
| `apps/web` | React 19 + Vite PWA. Public pages at `/`, `/t/:ref`; provider dashboard at `/admin` (lazy-loaded) |
| `packages/shared` | zod form schema, ticket case/status logic, slot generator. Used by the web app **and** the Edge Functions |
| `supabase/migrations` | Postgres schema, RLS, storage bucket |
| `supabase/functions` | Edge Functions (Deno): `submit-ticket`, `whatsapp-webhook`, `razorpay-webhook` |
| `supabase/tests` | pgTAP database tests |

## Prerequisites

- Node 22 + pnpm 10 (`corepack enable`)
- Docker Desktop, needed for the local Supabase stack (`pnpm db:start`). Without it, you can still build the web app and run the unit tests.
- Optional: Deno 2 for type-checking functions locally (CI does this)

## Getting started

```bash
pnpm install
pnpm db:start                      # local Postgres/Auth/Storage/Functions; prints URL + keys
cp apps/web/.env.example apps/web/.env.local   # paste the publishable key from db:start
pnpm dev                           # http://localhost:5173
```

Other commands:

```bash
pnpm test          # unit tests (shared logic)
pnpm typecheck
pnpm build
pnpm db:reset      # re-apply migrations + seed.sql
pnpm exec supabase test db   # pgTAP tests
pnpm db:types      # regenerate DB types into packages/shared
pnpm functions:serve
```

### Debugging in VS Code

- Install the recommended extensions when prompted (`.vscode/extensions.json`): Deno for `supabase/functions`, Tailwind, Vitest, i18n Ally, PostgreSQL, Supabase, Prettier, Error Lens.
- **F5 → "Web: debug in Chrome"** starts `pnpm dev` and opens Chrome with breakpoints in `.tsx` files. Use the "(phone size)" variant to work at phone width.
- **Edge Functions:** run the task *functions: serve (debug)*, then **"Edge Functions: attach"** (inspector on port 8083).
- In dev, a yellow banner shows when Supabase is unreachable or `.env.local` is missing. The flower button at the bottom left opens the TanStack Query devtools.
- **Database GUI:** Supabase Studio at http://127.0.0.1:54323 (local) or the dashboard (hosted). For a desktop client, the VS Code PostgreSQL extension, TablePlus or DBeaver all work. Connection string: `postgresql://postgres:postgres@127.0.0.1:54322/postgres` locally. MongoDB Compass can't connect, because this is Postgres.
- Browser: install the React Developer Tools extension.

### First owner account (local)

1. Open Studio at http://127.0.0.1:54323 → Authentication → **Invite user** with the owner's email. The invite email shows up in Mailpit at http://127.0.0.1:54324.
2. In the SQL editor:
   ```sql
   insert into public.staff (user_id, display_name, role)
   select id, 'Owner', 'owner' from auth.users where email = 'owner@example.com';
   ```
3. Sign in at http://localhost:5173/admin/login.

On the hosted project, do the same from the Supabase dashboard. Later admins are invited from the Team page (M1).

## Conventions

- Clients never write tables directly. Every public write goes through an Edge Function that validates with `@astro/shared`.
- `packages/shared` uses explicit `.ts` import paths so that Deno can import it as-is.
- Times are stored as `timestamptz` and shown in IST (Asia/Kolkata, which has no DST).
- Double-booking is prevented by the `bookings_no_overlap` exclusion constraint; the slot generator is only for display.
