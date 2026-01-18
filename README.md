# MANGU Platform

A complete, production-ready, Netflix-inspired digital publishing platform built with Next.js 14.

## Features

- 📚 Book marketplace with browsing and search
- 🤖 AI-powered recommendations (Resonance Engine)
- 📖 Reading interface with progress tracking
- ✍️ Author portal for manuscript submission
- 🎧 Audiobook support
- 💳 Stripe payment integration
- 🔐 Authentication with Supabase
- 📊 Analytics and engagement tracking

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
cp .env.example .env.local
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

1. Create a Supabase project
2. Run the database migrations (schema provided in types/database.ts)
3. Set up Row Level Security (RLS) policies
4. Enable pgvector extension for embeddings
5. Set up storage buckets for file uploads

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
- `npm test` - Run unit and integration tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report
- `npm run test:e2e` - Run end-to-end tests

## Testing

The platform includes comprehensive test coverage:

- **104+ unit tests** covering utilities, components, and business logic
- **Integration tests** for complex workflows
- **E2E tests** using Playwright for user flows
- **Test utilities** and mock factories for easy test writing

See [docs/TESTING.md](./docs/TESTING.md) for detailed testing documentation.

## License

MIT