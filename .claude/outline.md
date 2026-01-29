# Fairfax Civic Digest - Implementation Plan

## Project Overview

A civic technology web app that summarizes FCPS School Board meetings and sends keyword-based email alerts to Fairfax County residents.

**Philosophy**: SLC (Simple, Lovable, Complete) - ship the simplest fully-working version.

---

## Tech Stack Summary

| Component | Technology | Status |
|-----------|------------|--------|
| Framework | Next.js 16 (App Router) | ✅ Installed |
| Language | TypeScript (strict) | ✅ Installed |
| Styling | Tailwind CSS v4 | ✅ Installed |
| Components | shadcn/ui | ❌ To install |
| Icons | Lucide React | ❌ To install |
| Database | Supabase (PostgreSQL) | ✅ Client installed |
| Auth | Supabase Auth | ✅ Client installed |
| AI | Anthropic Claude API | ✅ Installed |
| Email | Resend | ✅ Installed |
| Validation | Zod | ❌ To install |

**Dependencies to Install**:
```bash
npx shadcn@latest init
npm install lucide-react zod @supabase/ssr
```

---

## Design Tokens

| Token | Value | Usage |
|-------|-------|-------|
| Primary | #3CB371 (Medium Sea Green) | Buttons, links, accents |
| Secondary | #B6B6B6 (Gray) | Borders, muted text |
| Background | #E0D8D8 (Warm light gray) | Page background |
| Surface | #FFFFFF | Cards, content areas |
| Text | #1A1A1A | Primary text |
| Font | Geist Sans/Mono | Already configured |

---

## Phase 1: Foundation

### 1.1 Install Missing Dependencies
- Initialize shadcn/ui with custom theme colors
- Install lucide-react, zod, @supabase/ssr

### 1.2 Supabase Setup (User Action Required)
1. Go to https://supabase.com and create account/sign in
2. Create new project:
   - Name: `fairfax-civic-digest`
   - Region: `us-east-1` (N. Virginia)
   - Generate strong database password (save it!)
3. Wait for project to provision (~2 minutes)
4. Go to Project Settings > API and copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`

### 1.3 Database Schema
Run in Supabase SQL Editor (modified from spec - removes Planning Commission):

```sql
-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- MEETINGS TABLE
create table public.meetings (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  body text not null check (body in ('FCPS School Board', 'Board of Supervisors')),
  meeting_date date not null,
  video_url text,
  transcript_url text,
  transcript_text text,
  status text not null default 'pending' check (status in ('pending', 'processing', 'summarized', 'failed')),
  error_message text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Indexes
create index meetings_body_idx on public.meetings(body);
create index meetings_date_idx on public.meetings(meeting_date desc);
create index meetings_status_idx on public.meetings(status);

-- Full text search
alter table public.meetings add column fts tsvector 
  generated always as (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(transcript_text, ''))) stored;
create index meetings_fts_idx on public.meetings using gin(fts);

-- SUMMARIES TABLE
create table public.summaries (
  id uuid default uuid_generate_v4() primary key,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  summary_text text not null,
  key_decisions jsonb default '[]'::jsonb,
  action_items jsonb default '[]'::jsonb,
  topics text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create unique index summaries_meeting_id_idx on public.summaries(meeting_id);

-- USER PROFILES TABLE
create table public.user_profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text not null,
  display_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- ALERT PREFERENCES TABLE
create table public.alert_preferences (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  keyword text not null,
  bodies text[] default '{}',
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

create index alert_preferences_user_id_idx on public.alert_preferences(user_id);
create index alert_preferences_active_idx on public.alert_preferences(is_active) where is_active = true;

-- ALERT HISTORY TABLE
create table public.alert_history (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.user_profiles(id) on delete cascade not null,
  meeting_id uuid references public.meetings(id) on delete cascade not null,
  alert_preference_id uuid references public.alert_preferences(id) on delete set null,
  sent_at timestamp with time zone default timezone('utc'::text, now()) not null,
  email_status text not null default 'sent' check (email_status in ('sent', 'failed', 'bounced'))
);

create index alert_history_user_id_idx on public.alert_history(user_id);

-- ROW LEVEL SECURITY
alter table public.meetings enable row level security;
alter table public.summaries enable row level security;
alter table public.user_profiles enable row level security;
alter table public.alert_preferences enable row level security;
alter table public.alert_history enable row level security;

-- Policies
create policy "Meetings are publicly readable" on public.meetings for select using (true);
create policy "Summaries are publicly readable" on public.summaries for select using (true);

create policy "Users can view own profile" on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on public.user_profiles for insert with check (auth.uid() = id);

create policy "Users can view own alerts" on public.alert_preferences for select using (auth.uid() = user_id);
create policy "Users can create own alerts" on public.alert_preferences for insert with check (auth.uid() = user_id);
create policy "Users can update own alerts" on public.alert_preferences for update using (auth.uid() = user_id);
create policy "Users can delete own alerts" on public.alert_preferences for delete using (auth.uid() = user_id);

create policy "Users can view own alert history" on public.alert_history for select using (auth.uid() = user_id);

-- FUNCTIONS
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

create trigger meetings_updated_at before update on public.meetings
  for each row execute function public.handle_updated_at();

create trigger user_profiles_updated_at before update on public.user_profiles
  for each row execute function public.handle_updated_at();

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.user_profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

### 1.4 Environment Configuration
Create `.env.local`:
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=<from supabase dashboard>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<from supabase dashboard>

# Anthropic (get from console.anthropic.com)
ANTHROPIC_API_KEY=

# Resend (get from resend.com/api-keys)
RESEND_API_KEY=
RESEND_FROM_EMAIL=onboarding@resend.dev

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
CRON_SECRET=<generate random string>
```

### 1.5 Project Structure Setup
Create directory structure:
```
app/
├── layout.tsx (update with theme)
├── page.tsx (homepage)
├── globals.css (update with design tokens)
├── meetings/
│   ├── page.tsx
│   └── [id]/page.tsx
├── search/page.tsx
├── alerts/
│   ├── page.tsx
│   └── new/page.tsx
├── auth/
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── callback/route.ts
├── unsubscribe/[token]/page.tsx
└── api/
    ├── meetings/
    ├── search/
    ├── alerts/
    └── cron/

components/
├── ui/ (shadcn components)
├── layout/
├── meetings/
├── alerts/
└── search/

lib/
├── supabase/
├── claude.ts
├── resend.ts
├── utils.ts
└── constants.ts

types/
├── database.ts
└── index.ts
```

### 1.6 Basic Layout
- Header with nav (Home, Meetings, Alerts, Login/Profile)
- Footer with credits
- Mobile-responsive navigation

---

## Phase 2: Core Reading Experience

### 2.1 Type Definitions
Create TypeScript types matching database schema.

### 2.2 Supabase Client Utilities
- `lib/supabase/client.ts` - Browser client
- `lib/supabase/server.ts` - Server client
- `lib/supabase/middleware.ts` - Auth middleware

### 2.3 API Routes
- `GET /api/meetings` - List meetings with pagination
- `GET /api/meetings/[id]` - Single meeting with summary

### 2.4 Components
- `MeetingCard` - Preview card with title, date, body, summary excerpt
- `MeetingList` - Paginated list of cards
- `MeetingDetail` - Full view with decisions and action items
- `KeyDecisions` - Voting results display
- `ActionItems` - Task list display

### 2.5 Pages
- `/meetings` - List all meetings
- `/meetings/[id]` - Single meeting detail

### 2.6 Seed Data
Insert 3 mock FCPS School Board meetings for testing.

---

## Phase 3: Search and Filters

### 3.1 API Routes
- `GET /api/search?q=keyword` - Full-text search

### 3.2 Components
- `SearchBar` - Keyword input with submit
- `FilterDropdown` - Filter by body (FCPS only for v1)
- `SearchResults` - Results display

### 3.3 Pages
- `/search` - Search results page
- Update `/meetings` with filter controls

---

## Phase 4: AI Summarization

### 4.1 Claude Client
- `lib/claude.ts` - API client with summarization prompt

### 4.2 Cron Routes
- `POST /api/cron/process-meetings` - Process pending meetings
  - Fetch meetings with status="pending"
  - Send transcript to Claude
  - Parse response, create Summary record
  - Update meeting status

### 4.3 Vercel Cron Configuration
```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/process-meetings",
      "schedule": "0 12 * * *"
    }
  ]
}
```

---

## Phase 5: User Authentication

### 5.1 Supabase Auth Configuration
- Enable Email/Password provider
- Enable Google OAuth provider
- Configure redirect URLs

### 5.2 Auth Components
- Login form (email/password + Google)
- Signup form
- Auth callback handler

### 5.3 Pages
- `/auth/login`
- `/auth/signup`
- `/auth/callback`

### 5.4 Middleware
- Protect `/alerts/*` routes
- Add user context to requests

---

## Phase 6: Email Alerts

### 6.1 Resend Setup
- `lib/resend.ts` - Email client
- Email templates (HTML + plain text)

### 6.2 API Routes
- `GET /api/alerts` - List user's alerts
- `POST /api/alerts` - Create alert
- `DELETE /api/alerts/[id]` - Delete alert

### 6.3 Alert Components
- `AlertList` - User's current alerts
- `AlertForm` - Create/edit alert
- `AlertCard` - Single alert display

### 6.4 Pages
- `/alerts` - Manage alerts (requires auth)
- `/alerts/new` - Create new alert
- `/unsubscribe/[token]` - One-click unsubscribe

### 6.5 Cron Route
- `POST /api/cron/send-alerts` - Match keywords, send emails

---

## Phase 7: Polish & Testing

### 7.1 Loading & Error States
- Add `loading.tsx` to all routes
- Add `error.tsx` with helpful messages
- Empty states for no results

### 7.2 Basic Tests
- API route tests (meetings, search, alerts)
- Component render tests
- Auth flow tests

### 7.3 SEO & Meta
- Page titles and descriptions
- Open Graph tags
- Favicon and app icons

### 7.4 Mobile Polish
- Test all pages on mobile viewports
- Ensure touch targets are 44px+
- Test navigation flow

---

## Verification Plan

### Manual Testing Checklist
1. Homepage loads and displays recent meetings
2. Meeting list shows pagination
3. Individual meeting page shows full summary
4. Search returns relevant results
5. Filter by body works
6. User can sign up with email
7. User can sign up with Google
8. User can create keyword alerts
9. User can delete alerts
10. Cron job processes pending meetings
11. Alert emails are sent correctly
12. Unsubscribe link works
13. All pages work on mobile

### Automated Tests
- Run with `npm test`
- CI runs tests on PR

---

## Files to Modify/Create

### Phase 1 (Foundation)
- `package.json` - Add dependencies
- `app/globals.css` - Design tokens
- `app/layout.tsx` - Root layout with nav
- `.env.local` - Environment variables
- `.env.example` - Template for env vars
- `tailwind.config.ts` - Custom colors (if needed for shadcn)
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `types/database.ts`
- `types/index.ts`
- `components/layout/header.tsx`
- `components/layout/footer.tsx`
- `components/layout/mobile-nav.tsx`

### Phase 2 (Core Reading)
- `app/page.tsx` - Homepage
- `app/meetings/page.tsx`
- `app/meetings/[id]/page.tsx`
- `app/api/meetings/route.ts`
- `app/api/meetings/[id]/route.ts`
- `components/meetings/meeting-card.tsx`
- `components/meetings/meeting-list.tsx`
- `components/meetings/meeting-detail.tsx`
- `components/meetings/key-decisions.tsx`
- `components/meetings/action-items.tsx`

### Phase 3 (Search)
- `app/search/page.tsx`
- `app/api/search/route.ts`
- `components/search/search-bar.tsx`
- `components/search/search-results.tsx`
- `components/meetings/meeting-filters.tsx`

### Phase 4 (AI)
- `lib/claude.ts`
- `app/api/cron/process-meetings/route.ts`
- `vercel.json`

### Phase 5 (Auth)
- `app/auth/login/page.tsx`
- `app/auth/signup/page.tsx`
- `app/auth/callback/route.ts`
- `lib/supabase/middleware.ts`
- `middleware.ts`

### Phase 6 (Alerts)
- `lib/resend.ts`
- `app/alerts/page.tsx`
- `app/alerts/new/page.tsx`
- `app/unsubscribe/[token]/page.tsx`
- `app/api/alerts/route.ts`
- `app/api/alerts/[id]/route.ts`
- `app/api/cron/send-alerts/route.ts`
- `components/alerts/alert-list.tsx`
- `components/alerts/alert-form.tsx`
- `components/alerts/alert-card.tsx`

---

## Open Decisions (Deferred)

1. **YouTube Transcript Extraction**: Manual for v1, automate later with `youtube-transcript` library
2. **Board of Supervisors**: Add in v2 after FCPS is working
3. **Custom Email Domain**: Purchase when ready for production
4. **Vercel Deployment**: Deploy after Phase 2 is complete

---

## Git Workflow

- **Feature branches**: `feature/<name>` for new features
- **Bug fixes**: Direct to `main` for small fixes
- **Merge strategy**: Ask before implementing significant changes
- **Commits**: Conventional commits (`feat:`, `fix:`, `docs:`, `refactor:`)
