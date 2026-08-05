# Algorithm CRM

A performance-tuned CRM for digital agencies. Built with Next.js 14, Supabase, and the Algorithm brand system.

**Phase 1** ships with:
- Single unified deal pipeline (8 stages, drag-and-drop kanban)
- Email + password auth (Supabase Auth)
- Contacts + Companies (auto-created when deals are promoted)
- Activity timeline (notes, stage changes)
- Configurable stalled-deal alert rules (per-stage, per-user)
- Daily cron job that processes alerts (Phase 3 will plug in Gmail sending)
- ZAR as default currency with the R symbol

---

## Quick start (local dev)

```bash
# 1. Install dependencies
npm install

# 2. Copy env file and fill in (see "Set up Supabase" below)
cp .env.example .env.local

# 3. Run the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and you're in.

---

## Set up Supabase

1. **Create a Supabase project** at [supabase.com](https://supabase.com) — free tier is fine.
2. **Get your keys** from `Project Settings → API`:
   - `URL` → put in `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → put in `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → put in `SUPABASE_SERVICE_ROLE_KEY` (keep secret)
3. **Run the schema migration**:
   - Open `SQL Editor` in the Supabase dashboard
   - Copy the entire contents of `supabase/migrations/001_initial_schema.sql`
   - Paste and run
4. **Configure email auth**:
   - Go to `Authentication → Providers`
   - Make sure Email is enabled
   - For development, you can disable "Confirm email" so signup works instantly
5. **Generate a cron secret**:
   ```bash
   openssl rand -base64 32
   ```
   Put the result in `CRON_SECRET` in your `.env.local`.

---

## Deploy to Vercel

1. **Push this repo to GitHub** (private or public — your call).
2. **Connect to Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new)
   - Import your GitHub repo
   - Framework preset: **Next.js** (auto-detected)
3. **Add environment variables** in Vercel before deploying:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET`
4. **Deploy**. The first build takes ~2 minutes.
5. **Configure Supabase auth URL** for production:
   - In Supabase: `Authentication → URL Configuration`
   - Set "Site URL" to `https://your-app.vercel.app`
   - Add the same URL under "Redirect URLs"

The cron job (daily alert processing) runs automatically via `vercel.json` — no separate setup.

---

## Project structure

```
src/
├── app/
│   ├── (app)/              # Authenticated routes (sidebar layout)
│   │   ├── deals/          # Kanban — the home screen
│   │   ├── contacts/       # Contacts list
│   │   ├── companies/      # Companies list
│   │   ├── automations/    # Alert rules editor
│   │   ├── settings/       # Profile & preferences
│   │   └── layout.tsx
│   ├── (auth)/             # Login & signup
│   ├── api/cron/process-alerts/  # Daily stalled-deal processor
│   ├── globals.css         # Algorithm brand tokens
│   └── layout.tsx
├── components/
│   ├── kanban/             # DealsView, KanbanColumn, DealCard
│   ├── forms/              # Deal/Promote/Loss/Settings/AlertRules modals
│   ├── layout/             # Sidebar
│   └── ui/                 # Modal, Form, Toaster (shared primitives)
├── lib/
│   ├── supabase/           # Client + server Supabase factories
│   └── utils.ts
├── types/                  # Shared TypeScript types + domain helpers
└── middleware.ts           # Auth guard (redirects unauthenticated → /login)

supabase/
└── migrations/
    └── 001_initial_schema.sql   # The whole database schema

vercel.json                      # Cron configuration
```

---

## How the alert system works

In the `automations` page you set, per stage, "alert me when a deal sits here for more than X days".

- Vercel Cron hits `/api/cron/process-alerts` once a day at 09:00 UTC.
- The endpoint loops through every enabled rule, finds deals that have been in the watched stage longer than the threshold, and inserts a row in the `alert_firings` table.
- The dedupe constraint (`deal_id`, `rule_id`, `stage_entered_at`) ensures only one firing per stage entry — moving the deal to a new stage resets its timer.
- **In Phase 1, the firing just logs to the Vercel function logs.** Phase 3 plugs in the actual email sending (via your Gmail OAuth connection).

---

## Roadmap

- **Phase 1 (this drop)** — Pipeline, auth, contacts, companies, alert rules, daily cron skeleton ✓
- **Phase 2** — Activity timeline UI, deal detail pages, notes, contact/company detail views
- **Phase 3** — Gmail OAuth (testing mode), inbound/outbound email logging, outbound alert emails

---

## Currency & i18n

ZAR is the default. The currency formatter (`fmtCurrency` in `src/types/index.ts`) renders ZAR as `R85k`, `R1.2M`, etc. Per-deal currency overrides are supported — useful when you work with international clients.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS + Algorithm design tokens |
| Database | Postgres via Supabase |
| Auth | Supabase Auth |
| Drag-and-drop | `@dnd-kit/core` |
| Hosting | Vercel |

---

## License

Private — Algorithm.
