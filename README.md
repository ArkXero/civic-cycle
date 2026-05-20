# Civic Cycle

AI-powered meeting summaries for Fairfax County FCPS School Board meetings. Imports agendas from BoardDocs, generates structured summaries with Claude, and delivers keyword alerts and digest emails to subscribers.

Self-hosted via Docker + Caddy. Not on Vercel.

---

## Architecture

```
BoardDocs API
    │
    ▼
/api/boarddocs/meetings/[id]/import   ← admin-triggered import
    │  creates meeting row (pending)
    │  auto-triggers summarization
    ▼
/api/meetings/[id]/summarize           ← POST to start / retry
    │  pending → processing → summarized | failed
    │  calls Claude (claude-sonnet-4-6), stores summary
    ▼
Public browse / search / meeting detail pages

Cron jobs (triggered externally via CRON_SECRET):
  /api/cron/import-meetings   ← auto-import last 60 days, purge 90-day stale
  /api/cron/send-alerts       ← match keywords, send Resend emails
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 App Router, TypeScript strict |
| Styling | Tailwind v4, shadcn/ui |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| AI | Anthropic API — `claude-sonnet-4-6` |
| Email | Resend |
| Package manager | pnpm |
| Task runner | Vite Plus (`vp`) |
| Hosting | Docker + Caddy (self-hosted) |

---

## Environment Variables

Copy `.env.example` to `.env.local` and fill in all values.

### Required

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (bypasses RLS) |
| `NEXT_PUBLIC_APP_URL` | Public URL of the app, e.g. `https://civiccycle.app` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude |
| `RESEND_API_KEY` | Resend API key for email delivery |
| `RESEND_FROM_EMAIL` | Sender address, e.g. `alerts@civiccycle.app` |
| `CRON_SECRET` | Shared secret for cron endpoint auth (Bearer token) |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |

### BoardDocs

| Variable | Description |
|---|---|
| `BOARDDOCS_STATE` | Two-letter state code, e.g. `va` |
| `BOARDDOCS_DISTRICT` | BoardDocs committee/district ID |

---

## Local Setup

### Prerequisites

- Node.js 20+
- Vite Plus (`vp`)
- pnpm 11+
- Docker + Docker Compose
- Supabase CLI

### Steps

```bash
# 1. Install dependencies
vp install
# or: pnpm install

# 2. Copy and fill env vars
cp .env.example .env.local

# 3. Start local Supabase
supabase start

# 4. Apply migrations
supabase db push

# 5. Start dev server
vp run dev
# or: pnpm dev
```

The app runs at `http://localhost:3000`. The default dev script uses webpack
(`next dev --webpack`) to avoid local Turbopack cache/RAM spikes. Use
`vp run dev:turbo` only when specifically testing Turbopack.

For Google OAuth in local development, add `http://localhost:3000/**` to
Supabase Auth's allowed redirect URLs. Keep the production callback URL there
too, e.g. `https://your-domain.example/auth/callback`. In Google Cloud, the
authorized redirect URI should remain Supabase's callback URL:
`https://<project-ref>.supabase.co/auth/v1/callback`.

---

## Import → Summarize Lifecycle

1. Admin visits `/admin/boarddocs` and browses available BoardDocs meetings.
2. Clicking **Import + Summarize** calls `POST /api/boarddocs/meetings/[id]/import`.
3. Import route creates a `meetings` row with `status: 'pending'`, then immediately kicks off summarization.
4. Summarization sets `status: 'processing'`, calls Claude, stores the result in `summaries`, then sets `status: 'summarized'` (or `'failed'` on error).
5. The meeting detail page is status-aware and shows appropriate messaging at each state.

**Status flow (never break this):**

```
pending → processing → summarized
                    ↘ failed
```

Any route that sets `processing` **must** set `summarized` or `failed` in all code paths including error handlers.

---

## Cron Endpoints

All cron endpoints require:

```
Authorization: Bearer <CRON_SECRET>
```

| Endpoint | Schedule (suggested) | What it does |
|---|---|---|
| `POST /api/cron/import-meetings` | Daily | Imports meetings from last 60 days, purges stale rows older than 90 days |
| `POST /api/cron/send-alerts` | Daily | Matches new summarized meetings against keyword alert preferences, sends emails |

---

## Data Model

| Table | Purpose |
|---|---|
| `meetings` | Imported meeting rows. Has `status`, `title`, `date`, `body`, `transcript_text`. |
| `summaries` | AI-generated summary for a meeting. `summary_text`, `topics`, `key_decisions`, `action_items`. |
| `alert_preferences` | Per-user keyword subscriptions. |
| `alert_history` | Record of every alert email sent or attempted. |
| `digest_subscribers` | Email addresses subscribed to periodic digest emails. |
| `user_roles` | Maps Supabase user IDs to roles (`admin`, `user`). |

---

## Commands

```bash
vp install        # Install dependencies with pnpm
vp run dev        # Start dev server via Next webpack dev mode
vp run dev:turbo  # Start dev server with Turbopack
vp run build      # Production build
vp run lint       # ESLint
vp run test       # Vitest
vp exec tsc --noEmit  # TypeScript check
```
