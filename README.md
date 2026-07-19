# MANGU Publishers

A Netflix-inspired digital publishing platform built with Next.js 14.

## Deployment Status

> **Release authority: [docs/NEXT_GO.md](docs/NEXT_GO.md)** governs launch status, the hard gates (G1–G13), and the Go/No-Go decision.
> Current status: **NO-GO / NOT RELEASE-READY** until all 13 gates are evidenced TRUE. This README is a subordinate snapshot (CCR-001).

**Full project documentation:** [docs/MANGU_PUBLISHERS_END_TO_END.md](docs/MANGU_PUBLISHERS_END_TO_END.md) — business, architecture, env, deploy, migrations, Phase 2, and operator roadmap in one place.

Cloud Run via `cloudbuild.yaml` is the canonical production path.
Vercel and AWS Amplify configs are retained for compatibility and testing, but production release coordination should follow Cloud Build + Cloud Run.

## Core Features (Phase 1 - Ready for Launch)

- 📚 Book marketplace with browsing and search
- 📖 Reading interface with progress tracking
- ✍️ Author portal for manuscript submission
- 💳 Stripe payment integration
- 🔐 Authentication with Supabase
- 📊 Analytics and engagement tracking
- 📱 Responsive design and mobile support

## Phase 2 Features (shipped — `feature/top-dog-launch`)

- ⭐ Reviews & ratings — verified-purchase badges, helpful votes, author replies, sortable/paginated review API
- 🤖 AI-powered recommendations (Resonance Engine) — personalized "Because you read…" rails with trending/editorial fallback; works with or without OpenAI
- 🎧 Audiobook experience — speed control, sleep timer, ±15s skip, resume position, chapters, persistent mini-player
- 📧 Transactional email (Resend) — welcome, purchase receipts, author payout + new-review alerts, double opt-in newsletter, preference center
- 🔖 Reader engagement — bookmarks, highlights & notes, wishlist, author follows, Readers Hub
- 📊 Enhanced analytics and engagement tracking (impressions/clicks on all recommendation rails)

## Tech Stack

- **Frontend:** Next.js 14.2.3, React 18.3.1, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Payments:** Stripe
- **AI:** OpenAI (embeddings)
- **UI Components:** Radix UI, Framer Motion

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
cp .env.local.example .env.local
```

3. Configure your environment variables:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key
- `STRIPE_SECRET_KEY` - Your Stripe secret key
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` - Your Stripe publishable key
- `STRIPE_WEBHOOK_SECRET` - Your Stripe webhook secret
- `OPENAI_API_KEY` - Your OpenAI API key

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database Setup

The platform uses Supabase with PostgreSQL. You'll need to:

1. **Create a Supabase project** at https://supabase.com
2. **Run database migrations in order** (see migration order below)
3. **Set up Row Level Security (RLS) policies** (included in migrations)
4. **Enable pgvector extension** for embeddings (handled by migrations)
5. **Set up storage buckets** for file uploads (policies in migrations)

### Migration Order

Migrations are located in `supabase/migrations/` and **must be applied in this exact order**:

1. `20260116000000_initial_schema.sql` - Creates `profiles` table and core schema (required for health check)
2. `20260117000000_analytics_events.sql` - Analytics event tracking
3. `20260117000001_analytics_sessions.sql` - Session tracking
4. `20260117000002_book_stats_materialized.sql` - Materialized views for performance
5. `20260117000003_revenue_tracking.sql` - Revenue and payment tracking
6. `20260117000004_author_payouts.sql` - Author payout system
7. `20260117000005_book_pricing.sql` - Pricing logic and discounts
8. `20260117000006_storage_policies.sql` - Storage bucket policies
9. `20260118000000_critical_fixes.sql` - Bug fixes and corrections
10. `20260120000006_performance_optimizations.sql` - Performance indexes
11. `20260121000000_profile_trigger.sql` - Profile trigger consistency fixes
12. `20260122000000_social_features.sql` - Social features schema
13. `20260619124500_add_content_type_to_books.sql` - Adds `content_type` to books (idempotent)
14. `20260619162409_add_content_type.sql` - `content_type` follow-up (idempotent, safe re-run)
15. `20260619170000_add_retailer_urls.sql` - Retailer URL fields

**To apply migrations:**

**Option 1: Using Supabase Dashboard (Recommended for first-time setup)**

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste each migration file's contents in order
4. Run each migration sequentially

**Option 2: Using Supabase CLI**

```bash
# Install Supabase CLI if you haven't already
npm install -g supabase

# Link your project
supabase link --project-ref your-project-ref

# Apply all migrations
supabase db push
```

**Verification:**
After running migrations, verify the setup by checking:

- `/api/health` endpoint should return `"status": "healthy"` with database check passing
- The `profiles` table should exist (required for authentication)

## Project Structure

```
/app
  /(auth)          - Authentication pages
  /(consumer)      - Public-facing pages
  /(portals)       - Author and partner portals
  /api             - API routes
/components        - React components
/lib               - Utilities and business logic
/types             - TypeScript type definitions
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Local CI Checks

Run the same quality checks as CI (quality-checks + unit-tests + build-test):

```bash
./scripts/ci-local.sh
```

## Deployment

### Cloud Run (Canonical Production Path)

Production deploys should use Google Cloud Build and Cloud Run:

1. Trigger `cloudbuild.yaml` from `main`
2. Verify build + deploy steps complete successfully
3. Validate `/api/health` and critical smoke routes on the custom domain

### Vercel (Secondary / compatibility)

```bash
vercel deploy --prod
```

### Docker

```bash
docker build -t mangu-publishers .
docker run -p 3000:3000 mangu-publishers
```

## Documentation

- **[Release Authority (NEXT_GO)](./docs/NEXT_GO.md)** — launch status, hard gates G1–G13, P0 backlog, Go/No-Go sign-off
- **[Launch Checklist](./docs/LAUNCH_CHECKLIST.md)** - Complete pre-launch verification checklist
- **[Feature Phases](./docs/FEATURE_PHASES.md)** - Phase 1 (ready now) vs Phase 2+ features
- [Cloud Build + Cloud Run Config](./cloudbuild.yaml) - Canonical production deployment pipeline
- [AWS Amplify Quick Start](./docs/AWS_AMPLIFY_QUICK_START.md) - Legacy/secondary deployment path
- [AWS Amplify Deployment](./docs/AWS_AMPLIFY_DEPLOYMENT.md) - Legacy/secondary deployment path
- [Vercel Deployment](./docs/DEPLOYMENT.md) - Vercel deployment guide
- [API Documentation](./docs/API.md) - API reference
- [Development Guide](./docs/DEVELOPMENT.md) - Development setup and guidelines
- [Migrations Guide](./docs/MIGRATIONS.md) - Database migration instructions

## License

MIT
