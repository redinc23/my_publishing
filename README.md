# MANGU Platform

A complete, production-ready, Netflix-inspired digital publishing platform built with Next.js 14.

> **Repository Status**: ✅ Production-Ready | 🚀 Deployment-Ready | 📦 Self-Contained

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Docker Support](#docker-support)
- [Deployment](#deployment)
- [Documentation](#documentation)
- [Contributing](#contributing)

## 🚀 Deployment Status: AWS Amplify Ready!

This platform is now configured for immediate deployment to AWS Amplify. See [AWS Amplify Deployment Guide](./docs/AWS_AMPLIFY_DEPLOYMENT.md) for complete instructions.

## Features

### Core Features (Phase 1 - Ready for Launch)

- 📚 **Book Marketplace** - Browse, search, and filter books by genre, author, rating
- 📖 **Reading Interface** - Immersive reading experience with progress tracking
- ✍️ **Author Portal** - Manuscript submission and author management
- 💳 **Payment Processing** - Secure payments via Stripe integration
- 🔐 **Authentication** - User registration and login via Supabase Auth
- 📊 **Analytics** - Track user engagement and reading patterns
- 📱 **Responsive Design** - Mobile-first design that works on all devices
- 👤 **User Profiles** - Customizable user profiles and reading preferences

### Future Features (Phase 2+)

- 🤖 **AI-Powered Recommendations** (Resonance Engine) - *Requires OpenAI API*
- 🎧 **Audiobook Support** - *Coming soon*
- 📧 **Email Notifications** - *Requires Resend API*
- ⭐ **User Reviews and Ratings** - *Coming soon*
- 🔔 **Real-time Notifications** - *Coming soon*

## Tech Stack

### Frontend
- **Framework**: Next.js 14.2.35 (App Router)
- **Language**: TypeScript 5.3.3
- **UI Library**: React 18.3.1
- **Styling**: Tailwind CSS 3.4.1
- **Components**: Radix UI, Framer Motion
- **Form Handling**: React Hook Form + Zod validation

### Backend
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: Supabase Auth
- **Storage**: Supabase Storage
- **API**: Next.js API Routes
- **Real-time**: Supabase Realtime (ready for Phase 2)

### External Services
- **Payments**: Stripe (checkout + webhooks)
- **AI/ML**: OpenAI API (text embeddings for recommendations)
- **Email**: Resend (transactional emails - Phase 2)

### Development & Testing
- **Testing**: Jest (unit) + Playwright (E2E)
- **Linting**: ESLint + TypeScript
- **CI/CD**: GitHub Actions
- **Container**: Docker + Docker Compose ready

## Prerequisites

Before you begin, ensure you have the following installed:

### Required
- **Node.js**: 18.x or higher ([Download](https://nodejs.org/))
- **npm**: 9.x or higher (included with Node.js)
- **Git**: For version control

### Optional
- **Docker**: For containerized deployment (optional)
- **Supabase CLI**: For database migrations via CLI (optional)

### External Accounts

You'll need to create accounts for:

1. **Supabase** (https://supabase.com) - Database, Auth, Storage
   - Free tier available
   - Required for all functionality

2. **Stripe** (https://stripe.com) - Payment processing
   - Test mode for development
   - Required for payment features

3. **OpenAI** (https://platform.openai.com) - AI recommendations
   - Optional for Phase 1
   - Required for AI recommendation features

4. **Resend** (https://resend.com) - Email notifications
   - Optional for Phase 1
   - Required for email features

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/redinc23/my_publishing.git
cd my_publishing
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required npm packages (~200 dependencies).

### 3. Set Up Environment Variables

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and configure with your values (see [Environment Variables](#environment-variables) section below).

### 4. Set Up Database

See detailed instructions in the [Database Setup](#database-setup) section below.

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

### Required Variables (Phase 1)

These environment variables are **required** for the application to run:

#### Supabase Configuration
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

**Where to find**: Supabase Dashboard → Project Settings → API

#### Stripe Configuration
```env
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Where to find**: 
- Keys: Stripe Dashboard → Developers → API Keys
- Webhook secret: Stripe Dashboard → Developers → Webhooks

**For local development**: Use Stripe CLI to forward webhooks:
```bash
stripe listen --forward-to localhost:3000/api/webhook
```

#### Application Configuration
```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NODE_ENV=development
```

### Optional Variables (Phase 2)

These variables enable additional features:

#### OpenAI Configuration (AI Recommendations)
```env
OPENAI_API_KEY=sk-proj-...
```

**Where to find**: OpenAI Platform → API Keys

#### Email Configuration (Notifications)
```env
RESEND_API_KEY=re_...
```

**Where to find**: Resend Dashboard → API Keys

### Environment Variable Reference

See `.env.local.example` for the complete list with detailed comments and explanations.

## Database Setup

The platform uses Supabase, which provides PostgreSQL database, authentication, and file storage.

### Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Choose your organization (or create one)
4. Enter project details:
   - **Project Name**: mangu-platform (or your choice)
   - **Database Password**: Generate a strong password (save it securely)
   - **Region**: Choose closest to your users
5. Click "Create new project" (takes ~2 minutes)

### Step 2: Get Your Supabase Credentials

1. Go to **Project Settings** → **API**
2. Copy these values to your `.env.local`:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon/public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role key** → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret!)

### Step 3: Run Database Migrations

Migrations are located in `supabase/migrations/` and **must be applied in this exact order**:

1. `20260116000000_initial_schema.sql` - Core schema & profiles (REQUIRED)
2. `20260116000000_create_books_table.sql` - Books and content tables
3. `20260117000000_analytics_events.sql` - Analytics tracking
4. `20260117000000_storage_policies.sql` - Storage bucket policies
5. `20260117000001_analytics_sessions.sql` - Session tracking
6. `20260117000002_book_stats_materialized.sql` - Materialized views
7. `20260117000003_revenue_tracking.sql` - Revenue tracking
8. `20260117000004_author_payouts.sql` - Author payout system
9. `20260117000005_book_pricing.sql` - Pricing logic
10. `20260118000000_critical_fixes.sql` - Bug fixes
11. `20260120000006_performance_optimizations.sql` - Performance indexes
12. `20260121000000_profile_trigger.sql` - Profile creation trigger
13. `20260122000000_social_features.sql` - Social features

#### Option A: Using Supabase Dashboard (Recommended)

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. For each migration file (in order):
   - Open the migration file from `supabase/migrations/`
   - Copy the entire SQL content
   - Paste into SQL Editor
   - Click **Run** (or press Ctrl+Enter)
   - Verify "Success. No rows returned" message
5. Repeat for all migration files

#### Option B: Using Supabase CLI

```bash
# Install Supabase CLI globally
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project (find ref in Project Settings)
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push
```

### Step 4: Verify Database Setup

After running migrations, verify everything is working:

1. **Check Tables**: In Supabase Dashboard → **Database** → **Tables**, you should see:
   - `profiles`
   - `books`, `chapters`, `authors`
   - `purchases`, `reading_progress`
   - `analytics_events`, `analytics_sessions`
   - And more...

2. **Test Health Endpoint**: Start your dev server and visit:
   ```
   http://localhost:3000/api/health
   ```
   You should see:
   ```json
   {
     "status": "healthy",
     "database": "connected",
     "timestamp": "2024-01-27T12:00:00.000Z"
   }
   ```

### Step 5: (Optional) Seed Sample Data

To populate your database with sample books and authors for testing:

```bash
npm run db:seed
```

This will create:
- Sample authors
- Sample books with chapters
- Test users
- Sample reading progress

## Running the Application

### Development Mode

Start the development server with hot-reload:

```bash
npm run dev
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **API Routes**: http://localhost:3000/api/*

### Production Mode

Build and run the production version:

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Available Routes

Once running, you can access:

- `/` - Homepage with featured books
- `/books` - Browse all books
- `/books/[slug]` - Individual book pages  
- `/login` - User login
- `/signup` - User registration
- `/author` - Author portal (requires auth)
- `/admin` - Admin dashboard (requires admin role)

### Environment-Specific Commands

```bash
# Validate environment variables
npm run validate-env

# Run TypeScript type checking
npm run type-check

# Run linter
npm run lint

# Run all checks
npm run type-check && npm run lint
```

## Testing

### Unit Tests

Run Jest unit tests:

```bash
# Run all unit tests
npm test

# Run in watch mode (auto-rerun on changes)
npm test -- --watch

# Run with coverage report
npm test -- --coverage

# Run specific test file
npm test -- BookCard.test.tsx
```

### End-to-End Tests

Run Playwright E2E tests:

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests in headed mode (see browser)
npm run test:e2e -- --headed

# Run specific test file
npm run test:e2e -- tests/e2e/auth.spec.ts
```

### Test Structure

- **Unit Tests**: `tests/unit/` - Component and utility tests
- **E2E Tests**: `tests/e2e/` - Full user flow tests
- **Test Config**: `jest.config.js`, `playwright.config.ts`

## Docker Support

### Build Docker Image

```bash
docker build -t mangu-platform .
```

The Dockerfile uses a multi-stage build for optimization:
1. **deps stage**: Install dependencies
2. **builder stage**: Build Next.js app
3. **runner stage**: Create minimal runtime image

### Run with Docker

```bash
# Run container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=your-url \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-key \
  -e STRIPE_SECRET_KEY=your-key \
  -e NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=your-key \
  -e STRIPE_WEBHOOK_SECRET=your-secret \
  mangu-platform
```

### Docker Compose (Optional)

For easier local development with environment variables, create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env.local
```

Then run:
```bash
docker-compose up
```

### Docker Image Details

- **Base Image**: node:18-alpine
- **Final Image Size**: ~500MB (optimized)
- **User**: Runs as non-root user (nextjs)
- **Port**: Exposes port 3000
- **Output**: Next.js standalone output

## Project Structure

```
my_publishing/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Auth pages (login, signup)
│   ├── (consumer)/          # Public pages (books, reader)
│   ├── (portals)/           # Author/Partner portals
│   ├── admin/               # Admin dashboard
│   ├── api/                 # API routes
│   │   ├── analytics/       # Analytics endpoints
│   │   ├── checkout/        # Stripe checkout
│   │   ├── health/          # Health check
│   │   ├── resonance/       # AI recommendations
│   │   ├── session/         # Session management
│   │   ├── upload/          # File uploads
│   │   └── webhook/         # Stripe webhooks
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Homepage
├── components/              # React components
│   ├── ui/                 # Base UI components (buttons, dialogs, etc.)
│   ├── shared/             # Shared components (Header, Footer)
│   ├── cards/              # Card components (BookCard, etc.)
│   ├── layout/             # Layout components
│   └── providers/          # Context providers
├── lib/                    # Business logic & utilities
│   ├── supabase/          # Supabase clients & queries
│   ├── stripe/            # Stripe integration
│   ├── actions/           # Server actions
│   ├── hooks/             # React hooks
│   ├── utils/             # Utility functions
│   └── resonance/         # AI recommendation engine
├── types/                  # TypeScript type definitions
├── supabase/              # Database migrations
│   └── migrations/        # SQL migration files
├── scripts/               # Utility scripts
│   ├── seed-database.ts   # Database seeding
│   ├── validate-env.ts    # Env validation
│   ├── run-migrations.ts  # Migration runner
│   ├── verify-rls.ts      # RLS verification
│   ├── nexus_analyzer.py  # Project analysis tool
│   └── backup-db.sh       # Database backup
├── tests/                 # Test files
│   ├── unit/             # Unit tests
│   └── e2e/              # E2E tests
├── docs/                  # Documentation
├── .github/              # GitHub Actions workflows
│   └── workflows/
│       ├── ci.yml        # CI/CD pipeline
│       └── admin-setup.yml
├── Dockerfile            # Docker configuration
├── next.config.js        # Next.js configuration
├── tailwind.config.ts    # Tailwind CSS config
├── tsconfig.json         # TypeScript config
├── package.json          # Dependencies & scripts
└── .env.local.example    # Environment variable template
```

## Available Scripts

All scripts are defined in `package.json`:

### Development Scripts
```bash
npm run dev              # Start development server with env validation
npm run build            # Build production bundle
npm run start            # Start production server
```

### Code Quality Scripts
```bash
npm run lint             # Run ESLint
npm run type-check       # TypeScript type checking
npm run validate-env     # Validate environment variables
```

### Testing Scripts
```bash
npm test                 # Run Jest unit tests
npm run test:e2e         # Run Playwright E2E tests
```

### Database Scripts
```bash
npm run db:seed          # Seed database with sample data
npm run db:migrate       # Run database migrations
npm run verify-rls       # Verify Row Level Security policies
```

## Deployment

### AWS Amplify (Recommended) 🚀

The platform is pre-configured for AWS Amplify with the included `amplify.yml` file.

#### Quick Deploy

1. **Connect Repository**:
   - Open AWS Amplify Console
   - Click "New app" → "Host web app"
   - Connect your GitHub repository
   - Select branch (e.g., `main`)

2. **Configure Build**:
   - Amplify auto-detects `amplify.yml`
   - Build settings are pre-configured
   - No changes needed

3. **Add Environment Variables**:
   In Amplify Console → App settings → Environment variables, add:
   ```
   NEXT_PUBLIC_SUPABASE_URL
   NEXT_PUBLIC_SUPABASE_ANON_KEY
   SUPABASE_SERVICE_ROLE_KEY
   STRIPE_SECRET_KEY
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
   STRIPE_WEBHOOK_SECRET
   NEXT_PUBLIC_SITE_URL (set to Amplify domain)
   NODE_ENV=production
   ```

4. **Deploy**:
   - Click "Save and deploy"
   - First build takes ~5-10 minutes
   - You'll get a URL like: `https://main.xxxxx.amplifyapp.com`

#### Detailed Guide

See [AWS Amplify Deployment Guide](./docs/AWS_AMPLIFY_DEPLOYMENT.md) for complete step-by-step instructions.

### Vercel (Alternative)

Deploy to Vercel with zero configuration:

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel deploy --prod
```

Or connect via Vercel Dashboard:
1. Import your GitHub repository
2. Vercel auto-detects Next.js
3. Add environment variables
4. Deploy

### Docker Deployment

Deploy the Docker container to any platform:

```bash
# Build
docker build -t mangu-platform .

# Run
docker run -p 3000:3000 --env-file .env.local mangu-platform
```

Suitable for:
- AWS ECS/EKS
- Google Cloud Run
- Azure Container Instances
- DigitalOcean App Platform
- Self-hosted servers

## CI/CD

### GitHub Actions

The repository includes CI/CD workflows in `.github/workflows/`:

#### `ci.yml` - Continuous Integration

Runs on every push and PR:
- ✅ Install dependencies
- ✅ Run TypeScript type checking
- ✅ Run ESLint linting
- ✅ Run unit tests
- ✅ Build application
- 🚀 Deploy to Vercel (on main branch)

#### `admin-setup.yml` - Repository Management

Manually triggered workflow for managing environment variables across repositories.

### View CI Status

Check workflow status:
- In GitHub: **Actions** tab
- Badge in README (add badge if desired)

## Troubleshooting

### Common Issues

#### Build Fails: "Module not found"

**Solution**: Install dependencies
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Database Connection Error

**Solution**: Check environment variables
```bash
# Verify Supabase credentials
npm run validate-env
```

#### Stripe Webhook Failing Locally

**Solution**: Use Stripe CLI for local webhooks
```bash
stripe login
stripe listen --forward-to localhost:3000/api/webhook
# Copy the webhook signing secret to .env.local
```

#### Authentication Not Working

**Solutions**:
1. Verify Supabase credentials in `.env.local`
2. Check that `profiles` table exists in database
3. Verify middleware is running (check `middleware.ts`)
4. Clear browser cookies and try again

#### TypeScript Errors

**Solution**: Run type checking
```bash
npm run type-check
```

#### Port 3000 Already in Use

**Solution**: Kill process or use different port
```bash
# Kill process on port 3000
npx kill-port 3000

# Or use different port
PORT=3001 npm run dev
```

### Getting Help

- **Documentation**: Check the [docs/](./docs/) directory
- **Issues**: Search [GitHub Issues](https://github.com/redinc23/my_publishing/issues)
- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Contributing**: See [CONTRIBUTING.md](./CONTRIBUTING.md)

## Documentation

### Core Documentation

- **[README.md](./README.md)** - This file - Setup and getting started
- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture and technical details
- **[CONTRIBUTING.md](./CONTRIBUTING.md)** - Development workflow and contribution guidelines
- **[QUICK_START.md](./QUICK_START.md)** - Quick start guide

### Deployment Guides

- **[AWS Amplify Deployment](./docs/AWS_AMPLIFY_DEPLOYMENT.md)** - Complete AWS Amplify setup guide
- **[AWS Amplify Quick Start](./docs/AWS_AMPLIFY_QUICK_START.md)** - 5-minute deployment guide
- **[Vercel Deployment](./docs/DEPLOYMENT.md)** - Vercel deployment guide
- **[Launch Checklist](./docs/LAUNCH_CHECKLIST.md)** - Pre-launch verification checklist

### Development Guides

- **[Development Guide](./docs/DEVELOPMENT.md)** - Development setup and patterns
- **[API Documentation](./docs/API.md)** - API endpoint reference
- **[Migrations Guide](./docs/MIGRATIONS.md)** - Database migration instructions
- **[Feature Phases](./docs/FEATURE_PHASES.md)** - Phase 1 vs Phase 2+ features

### Testing Documentation

- **[Auth Testing](./docs/AUTH_TESTING.md)** - Authentication testing guide
- **[Webhook Testing](./docs/WEBHOOK_TESTING.md)** - Stripe webhook testing
- **[Admin Protection](./docs/ADMIN_PROTECTION_TESTING.md)** - Admin route protection testing

## Repository Completeness

### ✅ What's Included

This repository is **self-contained** and includes:

- ✅ Complete application source code (TypeScript/React/Next.js)
- ✅ All UI components and layouts
- ✅ API routes and server-side logic
- ✅ Database migration files (PLpgSQL)
- ✅ Configuration files (Next.js, TypeScript, Tailwind, etc.)
- ✅ Development and build scripts (TypeScript, Shell, Python)
- ✅ Test infrastructure (Jest, Playwright)
- ✅ CI/CD workflows (GitHub Actions)
- ✅ Docker configuration
- ✅ Comprehensive documentation

### ⚠️ External Dependencies

The following are **required but not included** (external services):

- **Supabase Account** - Database, authentication, file storage
- **Stripe Account** - Payment processing
- **OpenAI API Key** - AI recommendations (optional for Phase 1)
- **Resend API Key** - Email notifications (optional for Phase 1)

### 🚫 Not Committed

The following are **generated and excluded** from Git:

- `node_modules/` - npm dependencies (install with `npm install`)
- `.next/` - Next.js build output (generated by `npm run build`)
- `dist/` - Distribution files
- `.env.local` - Local environment variables (copy from `.env.local.example`)
- `coverage/` - Test coverage reports
- `playwright-report/` - E2E test reports

## Security

### Best Practices Implemented

- ✅ **Environment Variables** - All secrets stored in environment variables
- ✅ **Row Level Security** - Database access controlled with RLS policies
- ✅ **Input Validation** - Zod schemas for API input validation
- ✅ **CSRF Protection** - Built-in Next.js CSRF protection
- ✅ **Webhook Signatures** - Stripe webhook signature verification
- ✅ **HTTP-Only Cookies** - Session tokens in secure HTTP-only cookies
- ✅ **Rate Limiting** - API rate limiting (can be enhanced)
- ✅ **SQL Injection Prevention** - Parameterized queries via Supabase

### Security Checklist

Before deploying to production:

- [ ] Change all API keys to production keys
- [ ] Enable Stripe live mode
- [ ] Set strong database password
- [ ] Review and test RLS policies
- [ ] Configure proper CORS settings
- [ ] Enable HTTPS (automatic on Amplify/Vercel)
- [ ] Set up monitoring and alerts
- [ ] Review and restrict Supabase API keys
- [ ] Configure rate limiting
- [ ] Set up automated backups

## Performance

### Optimization Features

- ⚡ **Server-Side Rendering** - Fast initial page loads
- ⚡ **Static Generation** - Pre-rendered pages where possible
- ⚡ **Code Splitting** - Automatic code splitting by route
- ⚡ **Image Optimization** - Next.js Image component with automatic optimization
- ⚡ **Database Indexes** - Optimized queries with proper indexes
- ⚡ **Materialized Views** - Pre-computed analytics data
- ⚡ **LRU Cache** - In-memory caching for recommendations
- ⚡ **CDN Distribution** - Static assets served via CDN (Amplify/Vercel)

### Performance Monitoring

- Health check endpoint: `/api/health`
- Built-in Next.js analytics (optional)
- Supabase dashboard metrics
- Custom analytics events tracked in database

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:

- Development setup instructions
- Code standards and style guide
- Testing guidelines
- Pull request process
- Common development tasks

## License

MIT License - See [LICENSE](./LICENSE) file for details.

## Support

For questions, issues, or feature requests:

1. **Check Documentation** - Review docs in the [docs/](./docs/) directory
2. **Search Issues** - Check [existing issues](https://github.com/redinc23/my_publishing/issues)
3. **Open New Issue** - Create a new issue with details
4. **Community** - Join discussions on GitHub Discussions (if enabled)

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/) - React framework
- [Supabase](https://supabase.com/) - Backend platform
- [Stripe](https://stripe.com/) - Payment processing
- [Tailwind CSS](https://tailwindcss.com/) - Styling
- [Radix UI](https://www.radix-ui.com/) - UI components
- [OpenAI](https://openai.com/) - AI capabilities

---

**Ready to get started?** Follow the [Quick Start](#quick-start) guide above! 🚀