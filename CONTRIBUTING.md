# Contributing to MANGU Platform

Thank you for your interest in contributing to MANGU Platform! This guide will help you get started with development, testing, and contributing code.

## Table of Contents

- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Testing Guidelines](#testing-guidelines)
- [Submitting Changes](#submitting-changes)
- [Common Tasks](#common-tasks)

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher (comes with Node.js)
- **Git**: For version control
- **Code Editor**: VS Code recommended with TypeScript extensions

### External Accounts Required

You'll need accounts for the following services:

1. **Supabase** (https://supabase.com)
   - Free tier is sufficient for development
   - Used for database, authentication, and file storage

2. **Stripe** (https://stripe.com)
   - Test mode keys for development
   - Used for payment processing

3. **Optional for full features**:
   - OpenAI API (https://platform.openai.com) - For AI recommendations
   - Resend (https://resend.com) - For email notifications

## Development Setup

### 1. Clone the Repository

```bash
git clone https://github.com/redinc23/my_publishing.git
cd my_publishing
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required npm packages defined in `package.json`.

### 3. Environment Configuration

Copy the example environment file:

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and fill in your values:

```env
# Required for basic functionality
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# Optional for Phase 2 features
# OPENAI_API_KEY=sk-proj-...
# RESEND_API_KEY=re_...
```

### 4. Database Setup

#### Option A: Using Supabase Dashboard (Recommended for First-Time Setup)

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open each migration file in `supabase/migrations/` directory
4. Copy and paste the SQL content into the editor
5. Run each migration **in the order specified** in [ARCHITECTURE.md](./ARCHITECTURE.md#database-layer-postgresqlplpgsql)

**Important**: Migrations must be run in the exact order listed, starting with `20260116000000_initial_schema.sql`.

#### Option B: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Push all migrations
supabase db push
```

#### Verify Database Setup

After running migrations, verify everything is working:

```bash
# Start the dev server
npm run dev

# Visit http://localhost:3000/api/health
# You should see: {"status":"healthy","database":"connected"}
```

### 5. Optional: Seed Sample Data

```bash
npm run db:seed
```

This will populate your database with sample books, authors, and users for testing.

## Development Workflow

### Starting Development Server

```bash
npm run dev
```

The app will be available at http://localhost:3000

### Making Changes

1. **Create a new branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following the [Code Standards](#code-standards)

3. **Test your changes** locally:
   ```bash
   npm run type-check  # Check TypeScript types
   npm run lint        # Check code style
   npm test            # Run unit tests
   ```

4. **Commit your changes** with a clear message:
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

### Commit Message Format

We follow conventional commit format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add book search functionality
fix: resolve authentication redirect issue
docs: update API documentation
```

## Code Standards

### TypeScript

- **Use strict typing** - No `any` types
- **Define interfaces** for all props and data structures
- **Import types** from `@/types` when available
- **Use TypeScript features** like generics and type guards

Example:
```typescript
import type { Book, User } from '@/types';

interface BookListProps {
  books: Book[];
  onBookSelect: (book: Book) => void;
}

export function BookList({ books, onBookSelect }: BookListProps) {
  // Component code
}
```

### React Components

- **Server Components by default** - Use Client Components only when needed
- **Mark Client Components** with `'use client'` directive
- **Proper imports** - Use `@/` path alias
- **Descriptive names** - Component names should be clear and specific

Example Server Component:
```typescript
import { createClient } from '@/lib/supabase/server';
import { BookCard } from '@/components/cards/BookCard';

export default async function BooksPage() {
  const supabase = await createClient();
  const { data: books } = await supabase.from('books').select('*');
  
  return (
    <div>
      {books?.map(book => <BookCard key={book.id} book={book} />)}
    </div>
  );
}
```

Example Client Component:
```typescript
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function SearchForm() {
  const [query, setQuery] = useState('');
  // Component code
}
```

### Styling

- **Use Tailwind CSS** classes for styling
- **Follow mobile-first** responsive design
- **Use design tokens** from `tailwind.config.ts`
- **Dark theme** by default

Example:
```typescript
<div className="container mx-auto px-4 py-8">
  <h1 className="text-3xl font-bold text-white mb-6">
    Books
  </h1>
</div>
```

### File Organization

- **Components**: Place in appropriate subdirectory under `components/`
  - `components/ui/` - Basic UI components
  - `components/shared/` - Shared across app
  - `components/cards/` - Card components
  - `components/layout/` - Layout components

- **Pages**: Place in appropriate route group under `app/`
  - `app/(consumer)/` - Public pages
  - `app/(portals)/` - Portal pages
  - `app/admin/` - Admin pages

- **API Routes**: Place in `app/api/[route]/route.ts`

- **Utilities**: Place in `lib/utils/`

- **Types**: Place in `types/` or colocate with components

## Testing Guidelines

### Running Tests

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run specific test file
npm test -- BookCard.test.tsx

# Run E2E tests
npm run test:e2e
```

### Writing Unit Tests

Place tests in `tests/unit/` directory:

```typescript
import { render, screen } from '@testing-library/react';
import { BookCard } from '@/components/cards/BookCard';

describe('BookCard', () => {
  it('renders book title', () => {
    const book = {
      id: '1',
      title: 'Test Book',
      author: 'Test Author',
    };
    
    render(<BookCard book={book} />);
    expect(screen.getByText('Test Book')).toBeInTheDocument();
  });
});
```

### Writing E2E Tests

Place tests in `tests/e2e/` directory:

```typescript
import { test, expect } from '@playwright/test';

test('user can browse books', async ({ page }) => {
  await page.goto('http://localhost:3000/books');
  await expect(page.locator('h1')).toContainText('Books');
});
```

### Test Coverage

- **Aim for 80%+ coverage** on critical business logic
- **Test edge cases** and error scenarios
- **Test user interactions** with E2E tests
- **Mock external services** in unit tests

## Submitting Changes

### Before Submitting

1. **Ensure all tests pass**:
   ```bash
   npm run type-check
   npm run lint
   npm test
   ```

2. **Update documentation** if you've changed:
   - API endpoints
   - Environment variables
   - Setup procedures
   - User-facing features

3. **Test manually** in the browser:
   - Verify your changes work as expected
   - Test on different screen sizes
   - Check console for errors

### Pull Request Process

1. **Push your branch** to GitHub:
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Create a Pull Request** on GitHub:
   - Provide a clear title and description
   - Reference any related issues
   - Include screenshots for UI changes
   - List any breaking changes

3. **Respond to review feedback**:
   - Address reviewer comments
   - Push additional commits if needed
   - Request re-review when ready

4. **Merge**:
   - Once approved, your PR will be merged
   - Delete your feature branch after merge

## Common Tasks

### Adding a New Page

1. Create file in appropriate route directory:
   ```bash
   app/(consumer)/new-page/page.tsx
   ```

2. Export default component:
   ```typescript
   export default function NewPage() {
     return <div>New Page</div>;
   }
   ```

3. Add to navigation if needed in `components/shared/Header.tsx`

### Adding a New API Route

1. Create route file:
   ```bash
   app/api/my-route/route.ts
   ```

2. Export HTTP method handlers:
   ```typescript
   import { NextResponse } from 'next/server';
   
   export async function GET(request: Request) {
     return NextResponse.json({ data: 'Hello' });
   }
   
   export async function POST(request: Request) {
     const body = await request.json();
     return NextResponse.json({ success: true });
   }
   ```

3. Document in `docs/API.md`

### Adding a Database Table

1. Create a new migration file:
   ```bash
   supabase/migrations/YYYYMMDD_description.sql
   ```

2. Write SQL for table creation:
   ```sql
   CREATE TABLE my_table (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
     -- other columns
   );
   
   -- Add RLS policies
   ALTER TABLE my_table ENABLE ROW LEVEL SECURITY;
   ```

3. Run migration on your Supabase project

4. Update TypeScript types in `types/database.ts`

### Adding a New Component

1. Create component file:
   ```bash
   components/cards/MyCard.tsx
   ```

2. Define interface and component:
   ```typescript
   interface MyCardProps {
     title: string;
     description: string;
   }
   
   export function MyCard({ title, description }: MyCardProps) {
     return (
       <div className="card">
         <h3>{title}</h3>
         <p>{description}</p>
       </div>
     );
   }
   ```

3. Export from index if creating a new directory:
   ```typescript
   // components/cards/index.ts
   export { MyCard } from './MyCard';
   ```

### Running Database Migrations Locally

Using Supabase CLI:
```bash
# Pull remote changes
supabase db pull

# Push local changes
supabase db push

# Reset database (destructive!)
supabase db reset
```

Using SQL Editor:
1. Open Supabase Dashboard → SQL Editor
2. Copy migration SQL
3. Run in editor

### Debugging

#### Server-Side Issues
- Check terminal output where `npm run dev` is running
- Add `console.log()` statements in Server Components and API routes
- Check Supabase logs in dashboard

#### Client-Side Issues
- Open browser DevTools console
- Check Network tab for failed requests
- Use React DevTools extension

#### Database Issues
- Check Supabase Dashboard → Database → Tables
- Verify RLS policies aren't blocking queries
- Check logs in Dashboard → Database → Logs

### Environment Variables

When adding new environment variables:

1. Add to `.env.local.example` with description
2. Add to `scripts/validate-env.ts` for validation
3. Document in README.md
4. Update `docs/AWS_AMPLIFY_DEPLOYMENT.md` if needed

## Getting Help

- **Documentation**: Check [docs/](./docs/) directory
- **Issues**: Search existing issues on GitHub
- **Questions**: Open a discussion on GitHub
- **Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)

## Code of Conduct

- Be respectful and constructive
- Welcome newcomers
- Focus on the issue, not the person
- Assume good intentions

## License

By contributing to MANGU Platform, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to MANGU Platform! 🚀
