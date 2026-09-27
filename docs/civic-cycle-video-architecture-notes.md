# Civic Cycle video architecture notes

## 20-second narration

Civic Cycle is one Next.js and React application, with Supabase handling PostgreSQL data, search, authentication, and access rules. It imports official meeting content from BoardDocs, uses Claude to produce structured summaries, and sends alerts through Resend. When a resident searches a topic, the app queries full-text indexes across meetings and summaries, then returns the matching public records.

Word count: 57

## Technical highlight

- **File:** `lib/boarddocs-refresh.ts`
- **Function:** `refreshBoardDocsMeeting`
- **Section:** Approximately lines 141–240; for a short on-screen crop, focus on lines 168–226.
- **Why it is interesting:** This is the reliability layer around BoardDocs ingestion. It takes a database-backed refresh lease so overlapping jobs cannot overwrite each other, rejects partial or regressed source responses, compares content hashes to avoid unnecessary work, waits for official results, and only regenerates a summary when the stored summary is stale.
- **What to say in about 10 seconds:** “This refresh pipeline protects trustworthy data: it locks concurrent imports, rejects incomplete BoardDocs responses, and uses content hashes so Claude only regenerates a summary when the official meeting record actually changes.”
