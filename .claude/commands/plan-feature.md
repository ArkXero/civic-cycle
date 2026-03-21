Plan the feature described in: $ARGUMENTS

ISOLATE research into sub-agents:

**Sub-agent 1 — Codebase Scout:**
Spawn a sub-agent with Task tool. Give it:
- The feature request
- Permission to read any file in src/
- Goal: find all files that will need to change, and how

**Sub-agent 2 — Docs Scout (if external API involved):**
Spawn a sub-agent with WebFetch/WebSearch.
Goal: find relevant docs, gotchas, and examples. Read doc headers first — only load full docs if relevant.

Once sub-agents complete, synthesize into specs/$ARGUMENTS-spec.md:
## Goal
## Files to Change
## Implementation Steps (ordered, checkboxable)
## Edge Cases
## Definition of Done
