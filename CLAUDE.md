# Civic Cycle

Civic tech app summarizing FCPS School Board meetings for Fairfax County residents.
Self-hosted locally via Docker + Caddy. Not on Vercel.

## Stack
- Next.js 16 App Router, TypeScript strict, Tailwind v4, shadcn/ui
- Supabase (PostgreSQL + Auth + RLS)
- Anthropic API — model string is always `claude-sonnet-4-6`
- Resend for email

## Model usage
- Planning, architecture decisions, debugging complex issues: `claude-opus-4-6`
- All code edits, file writes, refactors: `claude-sonnet-4-6`
- Never use any other model string — these are the only two valid values

## Current data source
BoardDocs (lib/boarddocs.ts). YouTube pipeline is deprecated — do not use or fix it.
Meetings imported via /admin/boarddocs → /api/boarddocs/meetings/[id]/import.
Summarization via POST /api/meetings/[id]/summarize.

## Status flow — never break this
pending → processing → summarized | failed
Any route that sets status to 'processing' MUST update to 'summarized' or 'failed'
in ALL code paths including error handlers. No exceptions.

## Supabase rules
- Read operations: use createClient() from lib/supabase/server.ts
- Write operations that bypass RLS: use createAdminClient() from lib/supabase/server.ts
- Never use @supabase/ssr createServerClient for admin ops
- Remaining as any casts are on the anon SSR client (supabase) or on summaries
  inserts (MeetingSummary/KeyDecision type mismatch) — both are acceptable

## What's working
- BoardDocs import flow (lib/boarddocs.ts + /admin/boarddocs)
- Auth (Supabase email + Google OAuth)
- Alert preferences CRUD
- Meeting list, detail, search pages
- Summarization flow end-to-end (pending → processing → summarized | failed)
- Status-aware meeting detail page (different messages per status)
- BoardDocs importer shows status badge + Generate Summary button after import

## What's broken / in progress
<!-- BROKEN_IN_PROGRESS_START -->
<!-- Claude: when asked to update "what's broken", edit only between these markers -->
- pipeline/ Python directory is incomplete and crashes — ignore it entirely,
  lib/boarddocs.ts is the replacement
<!-- BROKEN_IN_PROGRESS_END -->

## Lessons learned
<!-- LESSONS_START -->
<!-- Claude: when asked to update "lessons learned", edit only between these markers -->
- Always check isAuthenticated before hiding admin UI elements — missing this hid
  the SummarizeButton for all users
- Supabase silently ignores unknown columns on update (no error thrown) — always
  verify columns exist in the actual table, not just in types/database.ts
- YouTube ytInitialPlayerResponse regex extraction breaks on YouTube page updates —
  use the youtube-transcript npm package instead of manual scraping
- createAdminClient() should use plain @supabase/supabase-js, not @supabase/ssr —
  the SSR client causes type inference issues that force as any casts throughout
- Meeting status stuck on 'processing' if a route crashes mid-flight — every route
  that sets 'processing' needs a finally block or error handler that sets 'failed'
- .claude/ directory files are read as active instructions by Claude Code — specs
  and plans belong in .claude/docs/, not directly in .claude/
- meeting-detail.tsx was showing "Summary is being processed" for ALL meetings
  without a summary, regardless of status — always use status-aware conditionals
- BoardDocs importer must return dbId and dbStatus from the API so the frontend
  can show a "Generate Summary" button without a separate fetch
- Model strings in lib/anthropic.ts must match CLAUDE.md exactly — claude-sonnet-4-6,
  not date-versioned strings like claude-sonnet-4-20250514
- MeetingSummary.key_decisions ({decision, context}) doesn't match DB KeyDecision
  ({decision, vote_yes, vote_no, vote_abstain}) — as any cast is required on insert
  until either the prompt or the DB schema is reconciled
<!-- LESSONS_END -->

## Do not touch
- components/ui/ — shadcn generated, never edit manually
- types/database.ts — source of truth for schema; update here first, then migrations

## Reference docs
- Full implementation plan: .claude/docs/outline.md
- BoardDocs pipeline spec: .claude/docs/boarddocs-pipeline-spec.md

## Updating this file
When asked to update "what's broken / in progress", edit only between
BROKEN_IN_PROGRESS_START and BROKEN_IN_PROGRESS_END markers.
When asked to update "lessons learned", edit only between
LESSONS_START and LESSONS_END markers.
When a bug is fixed, move it from broken/in progress to lessons learned.
Do not rewrite or reformat sections outside the markers you were asked to edit.
