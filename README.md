# Algorithm CRM

A performance-tuned CRM for digital agencies. Built with Next.js 14, Supabase, and the Algorithm brand system.

**Phase 1** ships with:
- Single unified deal pipeline (8 stages, drag-and-drop kanban)
- Email + password auth (Supabase Auth)
- Contacts + Companies (auto-created when deals are promoted)
- Activity timeline (notes, stage changes)
- Deal owner on every deal (a real user, reassignable)
- Team-wide stage alerts (stalled-for-N-days and on-entry), sent to all users with the deal owner named — in-app Notifications, optional daily email digest
- Stage close-probabilities in `config/stage-probabilities.json`
- CSV / JSON deal export for the finance tracker (`/api/export/deals`)
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
3. **Run the schema migrations** in order:
   - Open `SQL Editor` in the Supabase dashboard
   - Paste and run each file in `supabase/migrations/` (`001_…`, `002_…`, `003_…`)
   - Run new migrations *before* deploying the code that needs them
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
   - Optional: `EXPORT_API_KEY`, `RESEND_API_KEY`, `ALERT_EMAIL_FROM`, `NEXT_PUBLIC_APP_URL` (see `.env.example`)
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
│   │   ├── notifications/  # In-app alert inbox
│   ├── api/cron/process-alerts/  # Daily stalled-deal alerts + email digest
│   ├── api/export/deals/   # CSV/JSON export for the finance tracker
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

config/
└── stage-probabilities.json     # Close probability % per stage

supabase/
└── migrations/                  # Run in order in the Supabase SQL editor

vercel.json                      # Cron configuration
```

---

## How the alert system works

Settings live on the **Automations** page and are **team-wide** (table `stage_alert_rules`, one row per stage):

- **Stalled after N days** — Vercel Cron hits `/api/cron/process-alerts` daily at 09:00 UTC. Every deal that has sat in the stage longer than N days creates a notification for **every user**. `deal_alert_log` makes sure that happens once per stage entry — moving the deal resets its timer.
- **On entry** — a Postgres trigger (`notify_deal_stage_entry`) notifies every user the moment a deal enters the stage, whichever screen moved it.

Every alert names the deal owner. Alerts appear on the **Notifications** page (unread badge in the sidebar).

**Google Chat:** if a webhook URL is saved in `integration_settings` (see `supabase/migrations/004_google_chat_alerts.sql`), alerts are also posted to the CRM directors' Google Chat space. On-entry alerts post instantly from the trigger via `pg_net`. Stalled alerts post as one batched message from the daily cron. Test the connection from the Automations page.

**Directors & deletes:** only profiles with `is_director = true` can delete deals; this is enforced by RLS (migration 006). Set it in the SQL editor. Deleting a deal notifies everyone and posts to Google Chat.

If `RESEND_API_KEY` and `ALERT_EMAIL_FROM` are set, the daily cron also emails each user a digest of their un-emailed notifications from the last 7 days.

---

## Stage probabilities

`config/stage-probabilities.json` holds the close-probability % for each stage. It feeds the Weighted metric, the export and the Automations page. It is validated at build time — a missing stage or a value outside 0–100 fails the deploy. To change it: edit, update `lastReviewed`/`reviewedBy`, push to main.

---

## Deal export

`GET /api/export/deals` returns every deal as CSV (Excel-ready) with name, stage, owner, value and probability. It is linked from the **Export CSV** button on the Deals page.

- Auth: a signed-in session, or `EXPORT_API_KEY` as `Authorization: Bearer <key>` or `?key=<key>` (for Excel → Data → From Web).
- `?status=open|won|lost|all` (default `all`), `?format=json`.

See `docs/crm-brief-sept-2026.md` for the full write-up of these features.

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
