# Homepage Strategy

**Decision date:** 2026-05-31  
**Status:** Active — static landing page at `/homepage/v_a_1.html`

## Decision

Keep the **static HTML homepage** (`public/homepage/v_a_1.html`) as the primary landing experience for `/`, routed via a Next.js redirect in `app/page.tsx`.

### Why static (for now)

- Matches the approved Netflix-style draft exactly (HTML/CSS/JS/video) without a large JSX port.
- Fast to iterate on design in standalone HTML before merging into React components.
- Isolated from Supabase/mock-data dependencies on the landing page.
- Rest of the app remains fully React (books, auth, admin, checkout).

### Routing

```
GET /  → 307/redirect  →  /homepage/v_a_1.html  (static from public/)
```

Implementation:

```tsx
// app/page.tsx
import { redirect } from 'next/navigation';

export default function HomePage() {
  redirect('/homepage/v_a_1.html');
}
```

### Assets (committed in `public/homepage/`)

| File               | Purpose           |
| ------------------ | ----------------- |
| `v_a_1.html`       | Main landing page |
| `enhancements.css` | Styles            |
| `enhancements.js`  | Interactions      |
| `laps.mp4`         | Hero video        |

### Previous React homepage

The prior server-rendered homepage (featured/trending books from Supabase) was removed from `app/page.tsx` but remains in git history (`a9db2d0^`). To restore it at a secondary route (e.g. `/books-home`), revert or cherry-pick that file onto a new route.

### Future options (P1+)

1. **Keep static** — lowest maintenance; ensure internal links in HTML point to Next routes (`/books`, `/login`, etc.).
2. **Port to React/TSX** — shared layout/header/footer, better SEO metadata control, single design system with Tailwind/shadcn.
3. **Hybrid** — static hero + React islands for dynamic book rows.

Recommendation: stay static until design stabilizes, then port to `app/(consumer)/page.tsx` or a dedicated marketing route.

## Error page reconciliation

The project uses **App Router** error handling:

| Concern        | App Router file     | Replaces               |
| -------------- | ------------------- | ---------------------- |
| 404            | `app/not-found.tsx` | Legacy `pages/404.tsx` |
| Runtime errors | `app/error.tsx`     | Legacy `pages/500.tsx` |

Legacy Pages Router error files (`pages/404.tsx`, `pages/500.tsx`) were removed. Only `pages/_document.tsx` remains for any legacy pages compatibility. No duplicate error pages.

## Deploy requirement

Production must include `public/homepage/` in the build artifact. After pushing homepage assets, run:

```bash
gcloud auth login
./scripts/gcloud-build-submit.sh
./scripts/verify-gcp-production.sh
```

Until redeploy completes, production may still serve the old React homepage and return 404 for `/homepage/v_a_1.html`.
