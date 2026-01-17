# Development Guide

Complete guide for developing on the MANGU platform.

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Git
- Supabase account
- Stripe account (for testing)

### Setup

1. Clone repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env.local`
4. Fill in environment variables
5. Run migrations: See Database Setup
6. Start dev server: `npm run dev`

## Project Structure

```
/app                    # Next.js app directory
  /(auth)              # Authentication pages
  /(consumer)          # Public-facing pages
  /(portals)           # Author/Partner portals
  /admin               # Admin dashboard
  /api                 # API routes
/components            # React components
  /admin              # Admin components
  /cards              # Card components
  /layout             # Layout components
  /players            # Media players
  /shared             # Shared components
  /ui                 # UI primitives
/lib                  # Utilities and business logic
  /email             # Email templates and sending
  /hooks             # React hooks
  /middleware        # Middleware utilities
  /resonance         # Resonance engine
  /stripe            # Stripe integration
  /supabase          # Supabase clients and queries
  /utils             # Utility functions
/scripts              # Scripts (seeding, etc.)
/supabase            # Database migrations
/tests               # Tests
/types               # TypeScript types
```

## Common Development Tasks

### Adding a New Page

1. Create file in appropriate directory (`app/(consumer)`, `app/(portals)`, etc.)
2. Export default component
3. Add to navigation if needed
4. Update types if needed

### Adding a New Component

1. Create file in `components/` directory
2. Use TypeScript with proper types
3. Follow existing component patterns
4. Add to appropriate subdirectory

### Database Queries

Use the query library in `lib/supabase/queries.ts`:

```typescript
import { getPublishedBooks, getBookBySlug } from '@/lib/supabase/queries';

// In Server Component
const books = await getPublishedBooks({ genre: 'sci-fi', limit: 10 });
```

### Adding a New API Route

1. Create file in `app/api/[route]/route.ts`
2. Export GET, POST, etc. functions
3. Add rate limiting if needed
4. Document in `docs/API.md`

### Testing

Run tests:
```bash
npm test              # Unit tests
npm run test:e2e      # E2E tests
```

Write tests:
- Unit tests: `tests/unit/`
- E2E tests: `tests/e2e/`

## Database

### Running Migrations

1. Connect to Supabase SQL Editor
2. Copy migration SQL
3. Run in SQL Editor
4. Verify tables created

### Seeding Data

```bash
npm run db:seed
```

### Query Patterns

**Server Components:**
```typescript
import { createClient } from '@/lib/supabase/server';

const supabase = await createClient();
const { data } = await supabase.from('books').select('*');
```

**Client Components:**
```typescript
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
const { data } = await supabase.from('books').select('*');
```

## Component Creation

### Server Component (Default)

```typescript
import { getPublishedBooks } from '@/lib/supabase/queries';

export default async function BooksPage() {
  const { data: books } = await getPublishedBooks();
  return <BookList books={books} />;
}
```

### Client Component

```typescript
'use client';

import { useState } from 'react';

export function BookSearch() {
  const [query, setQuery] = useState('');
  // ...
}
```

## Styling

- Use Tailwind CSS classes
- Follow design system colors
- Mobile-first responsive design
- Dark theme by default

## TypeScript

- Strict mode enabled
- No `any` types
- Proper interfaces for all props
- Use types from `types/database.ts`

## Troubleshooting

### Build Errors

- Run `npm run type-check` to find TypeScript errors
- Check all imports resolve correctly
- Verify environment variables are set

### Database Errors

- Check RLS policies aren't blocking queries
- Verify user has correct permissions
- Check Supabase connection

### Authentication Issues

- Verify Supabase keys are correct
- Check middleware is running
- Verify session tokens are valid

## Best Practices

1. **Server Components First**: Use Server Components by default
2. **Type Safety**: Always use TypeScript types
3. **Error Handling**: Wrap async operations in try-catch
4. **Loading States**: Show loading UI for async operations
5. **Accessibility**: Include ARIA labels and keyboard navigation
6. **Performance**: Optimize images, use Next.js Image component
7. **Security**: Validate all inputs, use RLS policies

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Stripe Documentation](https://stripe.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
