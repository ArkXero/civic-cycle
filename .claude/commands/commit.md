Review the staged changes with `git diff --staged`, then create an enriched commit:

1. Use conventional commit format: `feat|fix|refactor|docs|chore(scope): summary`
2. Write a body focused on WHY, not what (the diff shows what)
3. Add a Context: section listing any changes to .claude/rules/, .claude/commands/, or CLAUDE.md

Format:
```
type(scope): short summary

WHY: [explain the reason for this change]

Context:
- [list any rule/doc/command changes, or "none"]
```

Run: git commit with this message.
