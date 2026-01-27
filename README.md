# MANGU Platform

A complete, production-ready, Netflix-inspired digital publishing platform built with Next.js 14.

## 🚀 Deployment Status: AWS Amplify Ready!

This platform is now configured for immediate deployment to AWS Amplify. See [AWS Amplify Deployment Guide](./docs/AWS_AMPLIFY_DEPLOYMENT.md) for complete instructions.

## Core Features (Phase 1 - Ready for Launch)

- 📚 Book marketplace with browsing and search
- 📖 Reading interface with progress tracking
- ✍️ Author portal for manuscript submission
- 💳 Stripe payment integration
- 🔐 Authentication with Supabase
- 📊 Analytics and engagement tracking
- 📱 Responsive design and mobile support

## Future Features (Phase 2+)

- 🤖 AI-powered recommendations (Resonance Engine) - *Requires OpenAI API*
- 🎧 Audiobook support - *Coming soon*
- 📧 Email notifications - *Requires Resend*
- ⭐ User reviews and ratings - *Coming soon*

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
2. `20260116000000_create_books_table.sql` - Books and content tables
3. `20260117000000_analytics_events.sql` - Analytics event tracking
4. `20260117000000_storage_policies.sql` - Storage bucket policies
5. `20260117000001_analytics_sessions.sql` - Session tracking
6. `20260117000002_book_stats_materialized.sql` - Materialized views for performance
7. `20260117000003_revenue_tracking.sql` - Revenue and payment tracking
8. `20260117000004_author_payouts.sql` - Author payout system
9. `20260117000005_book_pricing.sql` - Pricing logic and discounts
10. `20260118000000_critical_fixes.sql` - Bug fixes and corrections
11. `20260120000006_performance_optimizations.sql` - Performance indexes

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

## Deployment

### AWS Amplify (Recommended) 🚀

The platform is pre-configured for AWS Amplify deployment:

1. **Quick Deploy to Amplify:**
   - Connect your GitHub repository to AWS Amplify
   - Amplify will automatically detect the `amplify.yml` configuration
   - Add environment variables in Amplify Console
   - Deploy!

2. **Detailed Instructions:**
   See [AWS Amplify Deployment Guide](./docs/AWS_AMPLIFY_DEPLOYMENT.md) for complete step-by-step instructions.

### Vercel (Alternative)

```bash
vercel deploy --prod
```

### Docker

```bash
docker build -t mangu-platform .
docker run -p 3000:3000 mangu-platform
```

## 🤖 GitHub AI Agent Tasks

This repository includes a safe-by-default task runner for GitHub AI agents. See [AGENT_TASKS.md](./AGENT_TASKS.md) for the complete task catalog.

**Quick Start:**

```bash
# List all available tasks
npx tsx tools/agent-tasks.ts list

# Show details for a specific task
npx tsx tools/agent-tasks.ts show quickstart:format

# Run a task (dry-run mode)
npx tsx tools/agent-tasks.ts run quality:type-check --dry-run

# Run the full CI validation
npx tsx tools/agent-tasks.ts run ci:lint-test
```

**Common Tasks:**

- `quickstart:format` - Format code with Prettier and ESLint
- `quality:type-check` - Run TypeScript type checking
- `quality:lint` - Run ESLint and auto-fix issues
- `test:unit` - Run Jest unit tests
- `test:e2e` - Run Playwright E2E tests
- `ci:lint-test` - Run full CI validation (type-check + lint + test)
- `build:production` - Build production bundle

High-risk tasks (like `deps:update`, `db:migrate`) require the `--allow-risky` flag.

## Documentation

- **[Agent Tasks](./AGENT_TASKS.md)** - Complete task catalog for AI agents
- **[Launch Checklist](./docs/LAUNCH_CHECKLIST.md)** - Complete pre-launch verification checklist
- **[Feature Phases](./docs/FEATURE_PHASES.md)** - Phase 1 (ready now) vs Phase 2+ features
- **[AWS Amplify Quick Start](./docs/AWS_AMPLIFY_QUICK_START.md)** - 5-minute deployment guide
- **[AWS Amplify Deployment](./docs/AWS_AMPLIFY_DEPLOYMENT.md)** - Complete AWS Amplify setup guide
- [Vercel Deployment](./docs/DEPLOYMENT.md) - Vercel deployment guide
- [API Documentation](./docs/API.md) - API reference
- [Development Guide](./docs/DEVELOPMENT.md) - Development setup and guidelines
- [Migrations Guide](./docs/MIGRATIONS.md) - Database migration instructions

## License

MIT