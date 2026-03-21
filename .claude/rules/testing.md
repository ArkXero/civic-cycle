---
paths: "**/*.test.ts,**/*.spec.ts"
---

# Testing Conventions
- Use Vitest for unit tests
- Mock external services with vi.mock()
- Test file lives next to the file it tests
- Always test error paths, not just happy path
