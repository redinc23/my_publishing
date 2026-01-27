# MANGU Platform - Developer Quick Reference

Quick reference guide for common development tasks and commands.

## 🚀 Quick Start (30 seconds)

```bash
git clone https://github.com/redinc23/my_publishing.git
cd my_publishing
npm install
cp .env.local.example .env.local
# Edit .env.local with your credentials
npm run dev
# Open http://localhost:3000
```

## 📦 Essential Commands

### Development
```bash
npm run dev              # Start dev server (http://localhost:3000)
npm run build            # Build for production
npm run start            # Start production server
```

### Code Quality
```bash
npm run lint             # Run ESLint
npm run type-check       # TypeScript type checking
npm run validate-env     # Validate environment variables
```

### Testing
```bash
npm test                 # Unit tests (Jest)
npm run test:e2e         # E2E tests (Playwright)
npm test -- --watch      # Watch mode
npm test -- --coverage   # With coverage
```

### Database
```bash
npm run db:seed          # Seed sample data
npm run db:migrate       # Run migrations
npm run verify-rls       # Verify RLS policies
```

## 🔧 Environment Variables

### Required (Minimum)
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

### Optional (Phase 2)
```env
OPENAI_API_KEY=sk-proj-...      # AI recommendations
RESEND_API_KEY=re_...           # Email notifications
```

## 🗂️ Project Structure

```
app/                    # Next.js App Router
├── (auth)/            # Login, signup
├── (consumer)/        # Public pages
├── (portals)/         # Author/Partner portals
├── admin/             # Admin dashboard
└── api/               # API routes
components/            # React components
lib/                   # Business logic
types/                 # TypeScript types
supabase/migrations/   # Database migrations
scripts/               # Utility scripts
tests/                 # Test files
docs/                  # Documentation
```

## 🌐 Key Routes

### Public
- `/` - Homepage
- `/books` - Book marketplace
- `/books/[slug]` - Book details
- `/login`, `/signup` - Authentication

### Authenticated
- `/reader/[bookId]` - Reading interface
- `/author` - Author portal
- `/admin` - Admin dashboard

### API
- `/api/health` - Health check
- `/api/checkout` - Stripe checkout
- `/api/webhook` - Stripe webhooks
- `/api/upload` - File uploads
- `/api/analytics` - Event tracking

## 🗄️ Database Migrations

### Quick Setup (Supabase Dashboard)
1. Go to SQL Editor
2. Run each migration in order (see [ARCHITECTURE.md](./ARCHITECTURE.md))
3. Start with `20260116000000_initial_schema.sql`

### Using CLI
```bash
npm install -g supabase
supabase login
supabase link --project-ref your-ref
supabase db push
```

### Verify
```bash
curl http://localhost:3000/api/health
# Should return: {"status":"healthy","database":"connected"}
```

## 🐳 Docker Commands

### Build & Run
```bash
docker build -t mangu-platform .
docker run -p 3000:3000 --env-file .env.local mangu-platform
```

### With Docker Compose
```bash
docker-compose up
docker-compose up --build     # Rebuild image
docker-compose down           # Stop and remove
```

## 🔍 Debugging

### Server-Side
- Check terminal where `npm run dev` is running
- Add `console.log()` in Server Components and API routes
- View Supabase logs in dashboard

### Client-Side
- Open Browser DevTools (F12)
- Check Console tab for errors
- Network tab for API requests
- React DevTools extension

### Database
- Supabase Dashboard → Database → Tables
- Check RLS policies
- View logs in Database → Logs

## 🚨 Common Issues

### Port 3000 in use
```bash
npx kill-port 3000
# Or use different port
PORT=3001 npm run dev
```

### Module not found
```bash
rm -rf node_modules package-lock.json
npm install
```

### Build fails
```bash
npm run type-check          # Check TypeScript errors
npm run lint                # Check linting errors
```

### Auth not working
1. Verify Supabase credentials in `.env.local`
2. Check `profiles` table exists
3. Clear browser cookies
4. Check middleware.ts is running

### Stripe webhooks (local)
```bash
stripe listen --forward-to localhost:3000/api/webhook
# Copy webhook secret to .env.local
```

## 📝 Git Workflow

### Feature Development
```bash
git checkout -b feature/your-feature
# Make changes
npm run type-check && npm run lint && npm test
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature
# Create Pull Request
```

### Commit Message Format
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Formatting
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

## 🧪 Testing Patterns

### Unit Test Example
```typescript
// tests/unit/BookCard.test.tsx
import { render, screen } from '@testing-library/react';
import { BookCard } from '@/components/cards/BookCard';

test('renders book title', () => {
  const book = { id: '1', title: 'Test Book' };
  render(<BookCard book={book} />);
  expect(screen.getByText('Test Book')).toBeInTheDocument();
});
```

### E2E Test Example
```typescript
// tests/e2e/books.spec.ts
import { test, expect } from '@playwright/test';

test('browse books', async ({ page }) => {
  await page.goto('/books');
  await expect(page.locator('h1')).toContainText('Books');
});
```

## 🎨 Component Patterns

### Server Component
```typescript
import { createClient } from '@/lib/supabase/server';

export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from('books').select('*');
  return <div>{/* Use data */}</div>;
}
```

### Client Component
```typescript
'use client';
import { useState } from 'react';

export function MyComponent() {
  const [state, setState] = useState('');
  return <div>{/* Interactive UI */}</div>;
}
```

## 🔐 Security Checklist

Development:
- ✅ Use test API keys only
- ✅ Never commit `.env.local`
- ✅ Validate all user inputs

Production:
- ✅ Use production API keys
- ✅ Enable Stripe live mode
- ✅ Set up monitoring
- ✅ Review RLS policies
- ✅ Enable HTTPS

## 📚 Documentation Links

- [README.md](./README.md) - Main setup guide
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System architecture
- [CONTRIBUTING.md](./CONTRIBUTING.md) - Contributing guide
- [DEPENDENCIES.md](./DEPENDENCIES.md) - Dependency details
- [docs/DEVELOPMENT.md](./docs/DEVELOPMENT.md) - Development guide
- [docs/API.md](./docs/API.md) - API documentation

## 🆘 Getting Help

1. **Search** existing issues
2. **Check** documentation in [docs/](./docs/)
3. **Ask** in GitHub Discussions
4. **Report** bugs with details

## 📊 Useful Snippets

### Create New API Route
```typescript
// app/api/my-route/route.ts
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  return NextResponse.json({ data: 'hello' });
}
```

### Create New Page
```typescript
// app/(consumer)/my-page/page.tsx
export default function MyPage() {
  return <div>My Page</div>;
}
```

### Add Database Query
```typescript
// lib/supabase/queries.ts
export async function getMyData() {
  const supabase = await createClient();
  return await supabase.from('my_table').select('*');
}
```

## 🎯 Performance Tips

- Use Server Components by default
- Use `next/image` for images
- Implement proper loading states
- Use React.memo for expensive renders
- Optimize database queries with indexes

## 🔗 External Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

**Pro Tip**: Bookmark this page for quick reference! 🔖
