# Product Gap Crosswalk — P-### ↔ gates, Phoenix, stories, E-IDs, issues, code

> Generated view of `docs/product-gap-ledger.yml` (canonical). Do not edit by
> hand. Subordinate to `docs/NEXT_GO.md` — this document never overrides the
> G1–G13 gate matrix. Baseline `47340b73f6c609059229c3102ae442f5d161b910`.
>
> GitHub issues referenced: the open P0-backlog set #186–#205 (NEXT_GO.md §5)
> plus freeze notice #209. Dependabot PRs (#167, #160, #155, #154, #152, #133,
> #129) exist but are HELD pre-GO and irrelevant to this ledger. **No 60 fresh
> issues should be created** — see "Duplicates & already-evidenced" below.

## Crosswalk table (all 60 IDs)

| ID | Gate tie (G1–G13) | Phoenix task / North Star | Story / epic anchor | E-ID | Issue / PR | Code anchor |
| --- | --- | --- | --- | --- | --- | --- |
| P-001 | G6 | N/A | — | — | — | app/page.tsx, components/shared/Footer.tsx |
| P-002 | N/A | N/A | — | — | — | app/page.tsx, middleware.ts |
| P-003 | G6 | N/A | — | — | — | components/shared/Header.tsx, components/shared/Navigation.tsx, components/shared/Foote… |
| P-004 | G6 | N/A | NEXT_GO phase-9 | — | — | app/(consumer)/blog/page.tsx, app/(consumer)/comics/[slug]/page.tsx, app/(consumer)/pap… |
| P-005 | G3 | N/A | — | — | — | app/(auth)/register/page.tsx, app/(auth)/register/actions.ts, lib/auth/provider.ts |
| P-006 | G3 | N/A | — | — | — | app/(auth)/verify-email/page.tsx, app/(auth)/verify-email/actions.ts |
| P-007 | G3 | N/A | — | — | — | app/(auth)/login/page.tsx, app/(auth)/login/LoginForm.tsx, app/(auth)/login/actions.ts |
| P-008 | G3 | N/A | — | — | — | app/(auth)/reset-password/page.tsx, app/(auth)/reset-password/actions.ts, app/(auth)/re… |
| P-009 | G3 | N/A | — | — | — | app/error.tsx, app/global-error.tsx, app/(auth)/callback |
| P-010 | N/A | PROJECT_PHOENIX auth cutover | PROJECT_PHOENIX.md | — | — | lib/auth/provider.ts, lib/auth/better-auth-actions.ts, lib/auth-client.ts |
| P-011 | G5 | N/A | AEP r4 | — | — | app/(auth)/register, app/api/auth |
| P-012 | N/A | N/A | AEP r4 | — | — | app/dashboard/settings/page.tsx, app/api/session/route.ts |
| P-013 | G8 | N/A | stories:epic-t11-real-web-reader | — | — | app/(consumer)/reading/[bookId]/page.tsx, app/(consumer)/reading/[bookId]/ReadingClient… |
| P-014 | N/A | N/A | stories:epic-t13-readlisten-continuity | — | — | lib/reading/engagement.ts, app/(consumer)/reading/[bookId]/actions.ts |
| P-015 | N/A | N/A | stories:epic-t42-pricing-and-revenue-expansion | — | — | — |
| P-016 | N/A | N/A | stories:epic-t32-search-shelves-and-recommendations | — | — | app/(consumer)/books/page.tsx, app/(consumer)/books/BookFilters.tsx, app/(consumer)/dis… |
| P-017 | G4, G8 | N/A | NEXT_GO p0-010 | — | #205 | app/api/checkout/route.ts, app/api/webhooks/stripe/route.ts, lib/stripe/webhooks.ts |
| P-018 | G4, G8 | N/A | NEXT_GO p0-010 | — | — | app/(consumer)/library/page.tsx, lib/reading/entitlement.ts |
| P-019 | N/A | N/A | stories:epic-t12-highlights-notes-wishlist-follows | — | — | app/api/highlights/route.ts, app/api/wishlist/route.ts, app/api/follows/route.ts, app/a… |
| P-020 | G5 | N/A | stories:epic-t21-submission-to-published-pipeline | — | — | app/(portals)/author/submit/page.tsx, app/(portals)/author/submit/actions.ts, app/(port… |
| P-021 | N/A | N/A | NEXT_GO section-7 | — | — | app/(consumer)/audio/page.tsx, app/(consumer)/audio/[id]/page.tsx, lib/validations/audi… |
| P-022 | N/A | N/A | NEXT_GO section-7 | — | — | app/dashboard/my-reviews/page.tsx |
| P-023 | G5 | N/A | NEXT_GO.md | — | — | app/admin |
| P-024 | G5 | N/A | NEXT_GO.md | — | — | middleware.ts, lib/auth/roles.ts, lib/middleware/auth.ts |
| P-025 | G7 | N/A | NEXT_GO p0-015 | — | #199 | supabase/migrations/20260717114300_order_items_select_own.sql |
| P-026 | G3, G7 | N/A | NEXT_GO p0-011 | — | #195 | lib/rate-limit.ts, lib/rate-limit-response.ts |
| P-027 | G7 | N/A | NEXT_GO.md | — | — | app/api/health/route.ts |
| P-028 | N/A | N/A | NEXT_GO.md | — | — | lib/sentry/index.ts, sentry.server.config.ts, sentry.client.config.ts |
| P-029 | G7, G8 | N/A | NEXT_GO p0-016 | — | #203 | lib/utils/env-validation.ts |
| P-030 | G7 | N/A | NEXT_GO p0-017 | — | #200 | app/api/mcp/[transport] |
| P-031 | N/A | N/A | — | — | — | lib/actions/payouts.ts |
| P-032 | G4 | N/A | — | — | — | — |
| P-033 | G4 | N/A | — | — | — | app/api/checkout/route.ts, app/api/webhook/route.ts |
| P-034 | N/A | PROJECT_PHOENIX workstream 3 | — | — | — | lib/uploads/store-asset.ts, app/api/upload |
| P-035 | N/A | N/A | — | — | — | app/(consumer)/books/[slug]/page.tsx |
| P-036 | N/A | N/A | stories:t4.1 | — | — | — |
| P-037 | N/A | N/A | ENH e-001 | E-001 | #325 | app/(consumer)/book-clubs/ |
| P-038 | G6 | N/A | — | — | — | app/api/email/preferences/route.ts, components/email/EmailPreferences.tsx, lib/email/se… |
| P-039 | G6 | N/A | — | — | — | lib/resonance/recommendations.ts, app/api/resonance/recommend, app/(consumer)/recommend… |
| P-040 | N/A | N/A | stories:t6.2 | — | — | — |
| P-041 | G8 | N/A | AEP r5 | — | — | app/api/webhook/route.ts, lib/stripe/webhooks.ts, app/admin |
| P-042 | N/A | N/A | stories:t71 | — | — | app/(portals)/partner/catalogs/page.tsx |
| P-043 | G10 | N/A | AEP r6 | — | — | — |
| P-044 | G10 | N/A | AEP r6 | — | — | tests/e2e, playwright.config.ts |
| P-045 | N/A | N/A | stories:t71 | — | — | lib/actions/reviews.ts, app/admin |
| P-046 | N/A | N/A | stories:t22 | — | — | app/(portals)/author/analytics/page.tsx |
| P-047 | N/A | N/A | stories:t23 | — | — | app/(portals)/author/dashboard/page.tsx |
| P-048 | N/A | N/A | AEP r6 | — | — | app/(consumer)/privacy/page.tsx |
| P-049 | N/A | N/A | AEP r6 | — | — | app/(consumer)/terms/page.tsx, app/(consumer)/privacy/page.tsx |
| P-050 | G5 | N/A | NEXT_GO section-11 | — | — | app/(portals)/partner/orders/export, app/(portals)/partner/orders/page.tsx |
| P-051 | N/A | N/A | — | — | — | lib/seo/siteUrl.ts, app/robots.ts, app/sitemap.ts, app/dev/library-preview |
| P-052 | G6 | N/A | — | — | — | app/(consumer)/comics/page.tsx, app/(consumer)/comics/[slug]/page.tsx, app/(consumer)/p… |
| P-053 | G6 | N/A | ENH e-007 | E-007 | — | app/(consumer)/blog/page.tsx, app/(consumer)/press, app/(consumer)/careers |
| P-054 | G6 | N/A | NEXT_GO p0-013 | — | #201 | app/(consumer)/blog/page.tsx |
| P-055 | N/A | N/A | — | — | — | — |
| P-056 | N/A | N/A | — | — | — | — |
| P-057 | N/A | N/A | ENH e-002 | E-002 | — | app/api/webhook/route.ts, lib/utils/env-validation.ts, lib/actions/reviews.ts |
| P-058 | N/A | N/A | ENH e-004 | E-004 | — | app/(consumer)/layout.tsx |
| P-059 | N/A | PROJECT_PHOENIX data migration | PROJECT_PHOENIX.md | — | — | lib/db/provider.ts, docs/adr/ADR-002-mongodb-data-platform.md |
| P-060 | G1, G9, G11 | N/A | NEXT_GO p0-018 | — | #198 | — |

## Duplicates & already-evidenced — read before opening any issue

**No 60 fresh GitHub issues should be created.** Several ledger items are
already covered by existing vehicles or are already evidenced; opening new
issues for them duplicates tracked work.

- **P-030 (Public MCP transport)** — status ALREADY_EVIDENCED. Shipped as
  NEXT_GO P0-017 via issue **#200** (#217 + #223 route-export fix), evidenced
  at candidate SHA `ae7b92628d2079fe83632a5abc5b7383d7df11c1`
  ("fix(security): fail-closed MCP transport gate (P0-017) (#297)"). Issue #200
  is closable on operator confirmation; no new issue.
- **P-054 (Newsletter capture)** — status ALREADY_EVIDENCED. Shipped as NEXT_GO
  P0-013 via issue **#201**, evidenced at candidate SHA
  `9d625d9caadbe3af3cea6ac1a5d8807d524f5397` ("fix(forms): honest contact +
  newsletter states (P0-012, P0-013) (#303)", suite 127/127). G6 remains FALSE
  pending live Phase 12 QA confirmation — that is a QA-log activity, not a new
  issue.
- **P-037 (Book clubs honesty slice)** — the launch-relevant honesty slice is
  already shipped: ENHANCEMENT_LEDGER **E-001** via **#325**, commit
  `085a07aa5cb13253548f5c1007c41e71f4a38fde`, covered by
  `tests/unit/book-clubs-honesty.test.ts`. The ledger item remains DEFERRED
  (full clubs/challenges product is post-GO); only the honesty slice is
  evidenced.
- **P-017 → #205** (NEXT_GO P0-010 Stripe purchase → webhook → order →
  library → reading), **P-025 → #199** (P0-015 order_items SELECT policy),
  **P-026 → #195** (P0-011 Upstash fail-closed), **P-029 → #203** (P0-016
  production secrets), **P-060 → #198** (P0-018 canonical deploy path).
  These five map onto existing P0-backlog issues — close those issues with the
  ledger evidence rather than minting duplicates.
- Adjacent backlog issues #186–#205 (remainder) and freeze notice **#209**
  cover NEXT_GO release work, not new Product Gap scope; consult before filing
  anything titled "[Gap P-###]".

When a genuinely uncovered item is scheduled, issue titles are
`[Gap P-###]` with label `product-gap:P-###` — one issue per ledger ID, never
a bulk dump.
