---
paths: "app/**/*.tsx,components/**/*.tsx"
---

# Frontend Conventions
- Use server components by default, add 'use client' only when needed
- Tailwind only — no inline styles
- shadcn/ui for UI primitives
- Loading states with Suspense, not manual isLoading flags
