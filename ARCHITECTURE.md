# MANGU Platform - Architecture Documentation

## Overview

MANGU Platform is a complete, production-ready digital publishing platform built with Next.js 14, featuring a Netflix-inspired UI for book discovery, reading, and publishing.

## System Architecture

### Technology Stack

- **Frontend Framework**: Next.js 14.2.35 with App Router
- **Language**: TypeScript 5.3.3
- **UI Framework**: React 18.3.1
- **Styling**: Tailwind CSS 3.4.1
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Payment Processing**: Stripe
- **AI/ML**: OpenAI API (embeddings & recommendations)
- **Email**: Resend
- **Hosting**: AWS Amplify / Vercel
- **Container**: Docker

## Entry Points and Components

### 1. TypeScript/Next.js Application (Primary)

#### Main Application Entry Point
- **File**: `app/layout.tsx` - Root layout with providers
- **File**: `app/page.tsx` - Homepage with featured books
- **Port**: 3000 (development), configurable in production

#### Application Routes

**Public Routes** (`app/(consumer)/`)
- `/` - Homepage with featured books
- `/books` - Book marketplace and search
- `/books/[slug]` - Individual book pages
- `/reader/[bookId]` - Reading interface
- `/login`, `/signup` - Authentication pages

**Portal Routes** (`app/(portals)/`)
- `/author` - Author portal for manuscript submission
- `/partner` - Partner portal for ARC requests

**Admin Routes** (`app/admin/`)
- `/admin/dashboard` - Admin dashboard
- `/admin/books` - Book management
- `/admin/users` - User management
- `/admin/analytics` - Analytics dashboard

#### API Routes (`app/api/`)

| Route | Purpose | Methods |
|-------|---------|---------|
| `/api/health` | Health check endpoint | GET |
| `/api/analytics` | Analytics event tracking | POST |
| `/api/checkout` | Stripe checkout session creation | POST |
| `/api/webhook` | Stripe webhook handler | POST |
| `/api/upload` | File upload to Supabase Storage | POST |
| `/api/resonance` | AI-powered recommendations | GET |
| `/api/session` | Session management | GET, POST |

### 2. Database Layer (PostgreSQL/PLpgSQL)

#### Migration Files (`supabase/migrations/`)

Migrations must be applied in this **exact order**:

1. `20260116000000_initial_schema.sql` - Core schema, profiles, books, chapters, authors (REQUIRED)
2. `20260117000000_analytics_events.sql` - Analytics tracking
3. `20260117000000_storage_policies.sql` - Storage bucket policies
4. `20260117000001_analytics_sessions.sql` - Session tracking
5. `20260117000002_book_stats_materialized.sql` - Materialized views
6. `20260117000003_revenue_tracking.sql` - Revenue and payments
7. `20260117000004_author_payouts.sql` - Author payout system
8. `20260117000005_book_pricing.sql` - Pricing logic
9. `20260118000000_critical_fixes.sql` - Bug fixes
10. `20260120000006_performance_optimizations.sql` - Performance indexes
11. `20260121000000_profile_trigger.sql` - Profile creation trigger
12. `20260122000000_social_features.sql` - Social features

#### Key Database Tables

- `profiles` - User profiles (linked to Supabase Auth)
- `books` - Book catalog and metadata
- `chapters` - Book chapters and content
- `authors` - Author information
- `purchases` - Purchase records
- `reading_progress` - User reading progress
- `analytics_events` - Event tracking
- `revenue_tracking` - Revenue data

### 3. Python Scripts (Development Tools)

#### `scripts/nexus_analyzer.py`
- **Purpose**: Project analysis and forensic recovery tool
- **Dependencies**: Python 3.x standard library only (os, json, sys, subprocess, pathlib, datetime, typing, argparse)
- **Usage**: `python3 scripts/nexus_analyzer.py [options]`
- **Output**: Analysis reports for project structure and health

#### `tools/copilot_deep_dive.py`
- **Purpose**: Deep code analysis and navigation tool
- **Dependencies**: Python 3.x standard library only (argparse, os, re, shlex, subprocess, sys, dataclasses, datetime, pathlib, typing)
- **Usage**: `python3 tools/copilot_deep_dive.py [options]`
- **Output**: Code analysis and insights

**Note**: Both Python scripts use only standard library imports - no external dependencies required.

### 4. Shell Scripts (Automation & Setup)

#### `setup.sh`
- **Purpose**: Initial project setup automation
- **Dependencies**: bash, node/npm
- **Usage**: `./setup.sh`
- **Functions**: Environment detection, npm install, basic configuration

#### `verify-setup.sh`
- **Purpose**: Verify repository and environment setup
- **Dependencies**: bash, curl, GitHub CLI (gh)
- **Environment**: Requires `GH_PAT` environment variable
- **Usage**: `./verify-setup.sh [repos.txt]`

#### `setup-envs.sh`
- **Purpose**: Setup environment variables across repositories
- **Dependencies**: bash, gh CLI, jq
- **Environment**: Requires `GH_PAT` environment variable
- **Usage**: `./setup-envs.sh [repos.txt]`

#### `cleanup-envs.sh`
- **Purpose**: Clean up environment variables
- **Dependencies**: bash
- **Usage**: `./cleanup-envs.sh`

#### `scripts/setup.sh`
- **Purpose**: Docker container setup script
- **Usage**: Used internally by Dockerfile during build

#### `scripts/backup-db.sh`
- **Purpose**: Database backup script
- **Dependencies**: bash, Supabase CLI
- **Usage**: `./scripts/backup-db.sh`

### 5. TypeScript Scripts (Database & Validation)

#### `scripts/validate-env.ts`
- **Purpose**: Validate environment variables before startup
- **Runtime**: Node.js with tsx
- **Usage**: `npm run validate-env` (runs automatically before dev)

#### `scripts/seed-database.ts`
- **Purpose**: Seed database with sample data
- **Runtime**: Node.js with tsx
- **Usage**: `npm run db:seed`

#### `scripts/run-migrations.ts`
- **Purpose**: Run database migrations programmatically
- **Runtime**: Node.js with tsx
- **Usage**: `npm run db:migrate`

#### `scripts/verify-rls.ts`
- **Purpose**: Verify Row Level Security policies
- **Runtime**: Node.js with tsx
- **Usage**: `npm run verify-rls`

## Data Flow

### Authentication Flow
1. User signs up/logs in via Supabase Auth
2. Profile automatically created via database trigger
3. Session stored in HTTP-only cookie
4. Middleware validates session on protected routes

### Book Purchase Flow
1. User selects book → `/api/checkout` creates Stripe session
2. Stripe redirects to payment page
3. Payment completion triggers webhook → `/api/webhook`
4. Webhook creates purchase record in database
5. User redirected to book reader

### Reading Experience
1. User accesses `/reader/[bookId]`
2. Middleware validates purchase/access
3. Chapters loaded progressively
4. Progress tracked automatically
5. Analytics events sent to `/api/analytics`

### AI Recommendations (Resonance Engine)
1. Book content → OpenAI embeddings
2. Stored in PostgreSQL with pgvector
3. User preferences → similarity search
4. `/api/resonance` returns personalized recommendations

## External Dependencies

### Required Services

1. **Supabase** (Database, Auth, Storage)
   - PostgreSQL database with pgvector extension
   - Authentication service
   - File storage buckets
   - Row Level Security (RLS) enabled

2. **Stripe** (Payment Processing)
   - Checkout sessions
   - Webhook handling
   - Payment intent management

### Optional Services (Phase 2)

3. **OpenAI** (AI Features)
   - Text embeddings (ada-002)
   - Recommendation engine
   - Future: Content analysis

4. **Resend** (Email Notifications)
   - Transactional emails
   - Purchase confirmations
   - Author notifications

## Security Architecture

### Authentication & Authorization
- Supabase Auth with JWT tokens
- HTTP-only cookies for session management
- Row Level Security (RLS) on all tables
- Role-based access control (RBAC)

### API Security
- CSRF protection via Next.js
- Rate limiting on sensitive endpoints
- Stripe webhook signature verification
- Input validation with Zod schemas

### Data Protection
- Environment variables for secrets
- No sensitive data in client-side code
- Encrypted database connections
- Secure file upload validation

## Deployment Architecture

### Docker Container
- Multi-stage build for optimization
- Node.js 18 Alpine base image
- Standalone Next.js output
- Port 3000 exposed

### AWS Amplify (Recommended)
- Automatic builds from Git
- Environment variable management
- CDN distribution
- SSL/TLS by default

### Vercel (Alternative)
- Zero-config deployment
- Edge functions
- Automatic preview deployments
- Built-in analytics

## Performance Considerations

### Database
- Materialized views for analytics
- Indexes on frequently queried columns
- Connection pooling via Supabase
- Optimized queries with proper JOINs

### Frontend
- Server-side rendering (SSR)
- React Server Components
- Image optimization with Next.js Image
- Code splitting by route

### Caching
- Static page generation where possible
- SWR for client-side data fetching
- LRU cache for recommendations
- Browser caching headers

## Monitoring & Observability

### Health Checks
- `/api/health` endpoint
- Database connectivity check
- Service availability monitoring

### Analytics
- Custom event tracking
- Session analytics
- User engagement metrics
- Revenue tracking

### Error Tracking
- Server-side error logging
- Client-side error boundaries
- Structured logging format

## Development Workflow

### Local Development
1. Clone repository
2. Install dependencies: `npm install`
3. Copy `.env.local.example` → `.env.local`
4. Configure environment variables
5. Run migrations (Supabase Dashboard or CLI)
6. Start dev server: `npm run dev`

### Testing
- Unit tests: `npm test` (Jest)
- E2E tests: `npm run test:e2e` (Playwright)
- Type checking: `npm run type-check`
- Linting: `npm run lint`

### CI/CD Pipeline
- Automated testing on PR
- Type checking and linting
- Build verification
- Automatic deployment to Vercel (on main branch)

## Scalability Notes

### Current Scale
- Suitable for thousands of concurrent users
- Designed for Supabase free/pro tier
- Optimized for Vercel/Amplify hosting

### Future Scaling
- Database read replicas for heavy traffic
- CDN for static assets and images
- Redis caching layer
- Microservices for heavy computations
- Queue system for background jobs

## Repository Completeness

### ✅ Included in Repository
- All application source code
- Database migration files
- Configuration files
- Documentation
- CI/CD workflows
- Development and build scripts

### ❌ Not Included (External)
- Environment variables (secrets)
- Supabase database instance
- Stripe account configuration
- OpenAI API access
- Production SSL certificates
- User-uploaded content (stored in Supabase Storage)

### 🔄 Generated (Not Committed)
- `node_modules/` - npm dependencies
- `.next/` - Next.js build output
- `dist/` - Distribution builds
- `.env.local` - Local environment variables

## Quick Reference

### Essential Commands
```bash
npm install              # Install dependencies
npm run dev             # Start development server
npm run build           # Build for production
npm run start           # Start production server
npm run lint            # Run linter
npm run type-check      # Check TypeScript types
npm test                # Run unit tests
npm run test:e2e        # Run E2E tests
npm run db:seed         # Seed database
```

### Key Files
- `package.json` - Dependencies and scripts
- `next.config.js` - Next.js configuration
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `.env.local.example` - Environment variable template
- `Dockerfile` - Container configuration
- `amplify.yml` - AWS Amplify build configuration
- `vercel.json` - Vercel deployment configuration

## Support & Resources

- **Main Documentation**: [README.md](./README.md)
- **Quick Start**: [QUICK_START.md](./QUICK_START.md)
- **Development Guide**: [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md)
- **API Reference**: [docs/API.md](./docs/API.md)
- **Deployment Guide**: [docs/AWS_AMPLIFY_DEPLOYMENT.md](./docs/AWS_AMPLIFY_DEPLOYMENT.md)
- **Migrations**: [docs/MIGRATIONS.md](./docs/MIGRATIONS.md)
- **Launch Checklist**: [docs/LAUNCH_CHECKLIST.md](./docs/LAUNCH_CHECKLIST.md)
