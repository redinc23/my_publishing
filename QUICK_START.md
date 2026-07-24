# MANGU Publishers - Quick Start Guide

## 🚦 Platform Status: NO-GO — NOT RELEASE-READY

Release status is governed by the execution authority: **[docs/NEXT_GO.md](docs/NEXT_GO.md)**.
No production-ready claim is valid until hard gates G1–G13 are all evidenced TRUE (see the authority document for the gate matrix, P0 backlog, and Go/No-Go sign-off). This guide covers local development only.

## 📋 Prerequisites

- Node.js 22.x (LTS)
- npm or yarn
- Supabase account
- Stripe account (for payments)
- OpenAI API key (for recommendations)
- Resend account (for emails)

## 🏃 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Setup Environment

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Email
RESEND_API_KEY=re_...

# App
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### 3. Setup Database

1. Go to Supabase Dashboard → SQL Editor
2. Run `supabase/migrations/20260116000000_initial_schema.sql`
3. Verify all tables are created

### 4. Seed Database (Optional)

```bash
npm run db:seed
```

### 5. Start Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## 📁 Project Structure

```
my_publishing/
├── app/                    # Next.js app directory
│   ├── (auth)/            # Authentication pages
│   ├── (consumer)/        # Public pages
│   ├── (portals)/         # Author/Partner portals
│   ├── admin/             # Admin dashboard
│   └── api/               # API routes
├── components/            # React components
│   ├── ui/               # UI primitives
│   ├── shared/           # Shared components
│   ├── cards/            # Card components
│   └── providers/        # Context providers
├── lib/                  # Utilities & business logic
│   ├── supabase/         # Supabase clients
│   ├── stripe/           # Stripe integration
│   ├── resonance/        # AI recommendations
│   └── actions/          # Server actions
├── types/                # TypeScript types
├── supabase/             # Database migrations
└── scripts/              # Utility scripts
```

## 🎯 Key Features

✅ Complete authentication system  
✅ Book marketplace with search & filters  
✅ AI-powered recommendations  
✅ Reading interface with progress tracking  
✅ Author portal for manuscript submission  
✅ Partner portal for ARC requests  
✅ Admin dashboard  
✅ Stripe payment integration  
✅ Email notifications  
✅ File upload system  
✅ Responsive design  
✅ Dark theme

## 🔧 Available Scripts

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
npm run type-check   # TypeScript type checking
npm test             # Run unit tests
npm run test:e2e     # Run E2E tests
npm run db:seed      # Seed database
```

## 📚 Documentation

- [Release Authority (NEXT_GO)](./docs/NEXT_GO.md) — launch status, gates G1–G13, P0 backlog
- [ADR-001: Canonical Production Platform](./docs/adr/ADR-001-canonical-platform.md) — Vercel canonical (Option B, ACCEPTED)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [API Documentation](./docs/API.md)
- [Development Guide](./docs/DEVELOPMENT.md)
- [Complete File List](./COMPLETE_FILE_LIST.md)

## 🚀 Deployment

### Vercel (Canonical Production — ADR-001 Option B)

```bash
vercel deploy --prod
```

### Cloud Run (Legacy — superseded for GO per ADR-001)

Use Cloud Build with `cloudbuild.yaml` from `main` (compatibility/emergency use only).

### Docker

```bash
docker build -t mangu-publishers .
docker run -p 3000:3000 mangu-publishers
```

## ✅ Local Development Ready

The platform runs locally with the steps above. **Production deployment is gated**: follow [docs/NEXT_GO.md](docs/NEXT_GO.md) — deployment, DNS cutover, and any release claim require gates G1–G13 evidenced TRUE on the exact release SHA.
