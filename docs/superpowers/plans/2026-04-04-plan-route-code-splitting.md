# Plan: Route-based Code Splitting

**Goal:** Split the single 1.17 MB JS bundle into per-route chunks loaded on demand.

**Priority:** Low — performance optimization, not blocking any features.

**Depends on:** All route pages built and stable.

---

## Context

`vp build` produces one JS chunk (~1.17 MB gzipped to ~340 KB). All routes are statically imported, so users download everything on first load regardless of which page they visit.

## Implementation

Use `React.lazy()` with dynamic imports for each route in `src/app.tsx`:

```tsx
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("./routes/dashboard"));
const Transactions = lazy(() => import("./routes/transactions"));
const Budgets = lazy(() => import("./routes/budgets"));
const Categories = lazy(() => import("./routes/categories"));
```

Wrap the route outlet in a `<Suspense>` fallback (spinner or skeleton) inside `_layout.tsx`.

Login and register can stay statically imported — they're the entry point and small.

## Verification

```bash
vp build
# Check dist/assets/ — should see multiple .js chunks instead of one
# Each route chunk should be well under 500 KB
```
