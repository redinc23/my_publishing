# Testing Guide

Complete guide for testing the MANGU Platform.

## Overview

The MANGU Platform has comprehensive test coverage across multiple layers:
- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test interactions between modules
- **API Tests**: Test API endpoints
- **E2E Tests**: Test complete user workflows

## Test Structure

```
tests/
├── helpers/           # Test utilities and mocks
│   ├── test-utils.tsx    # React testing utilities
│   ├── mock-data.ts      # Mock data factories
│   └── supabase-mock.ts  # Supabase client mocks
├── unit/             # Unit tests
│   ├── utils.test.ts
│   ├── validation.test.ts
│   ├── Button.test.tsx
│   ├── GenreCard.test.tsx
│   └── viral-logic.test.ts
├── integration/      # Integration tests
│   └── book-browsing.test.ts
├── api/             # API route tests
│   └── health.test.ts
└── e2e/             # End-to-end tests
    ├── auth-flow.spec.ts
    ├── book-browsing.spec.ts
    └── purchase-flow.spec.ts
```

## Running Tests

### All Tests
```bash
npm test
```

### Unit Tests Only
```bash
npm test -- tests/unit
```

### Integration Tests Only
```bash
npm test -- tests/integration
```

### API Tests Only
```bash
npm test -- tests/api
```

### E2E Tests
```bash
npm run test:e2e
```

### Watch Mode
```bash
npm test -- --watch
```

### Coverage Report
```bash
npm test -- --coverage
```

## Writing Tests

### Unit Tests

Use Jest for unit tests. Example:

```typescript
import { formatCurrency } from '@/lib/utils';

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(10.99)).toBe('$10.99');
  });
});
```

### Component Tests

Use React Testing Library with our custom render:

```typescript
import { render, screen } from '@/tests/helpers/test-utils';
import { Button } from '@/components/ui/button';

describe('Button', () => {
  it('renders button text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('Click me');
  });
});
```

### Using Mock Data

Use the mock data factories from `tests/helpers/mock-data.ts`:

```typescript
import { createMockBook, createMockBooks } from '@/tests/helpers/mock-data';

const book = createMockBook({ title: 'Custom Title' });
const books = createMockBooks(10);
```

### Mocking Supabase

Use the Supabase mock from `tests/helpers/supabase-mock.ts`:

```typescript
import { mockSupabaseClient } from '@/tests/helpers/supabase-mock';

mockSupabaseClient
  .from('books')
  .select()
  .mockResolvedValue({ data: [book], error: null });
```

### E2E Tests

Use Playwright for end-to-end tests:

```typescript
import { test, expect } from '@playwright/test';

test('user can browse books', async ({ page }) => {
  await page.goto('/books');
  await expect(page).toHaveURL(/\/books/);
});
```

## Test Patterns and Best Practices

### 1. Arrange-Act-Assert Pattern

```typescript
it('calculates total correctly', () => {
  // Arrange
  const items = [10, 20, 30];
  
  // Act
  const total = calculateTotal(items);
  
  // Assert
  expect(total).toBe(60);
});
```

### 2. Descriptive Test Names

```typescript
// Good
it('shows validation error when email is invalid', () => {});

// Bad
it('test email', () => {});
```

### 3. Test One Thing

Each test should verify one specific behavior.

### 4. Avoid Testing Implementation Details

Test the public API and behavior, not internal implementation.

### 5. Use Data-Driven Tests

```typescript
describe.each([
  ['Fiction', 'fiction'],
  ['Science Fiction', 'science-fiction'],
  ['Mystery', 'mystery'],
])('generateSlug(%s)', (input, expected) => {
  it(`converts "${input}" to "${expected}"`, () => {
    expect(generateSlug(input)).toBe(expected);
  });
});
```

### 6. Clean Up After Tests

```typescript
beforeEach(() => {
  resetSupabaseMocks();
});

afterEach(() => {
  jest.clearAllMocks();
});
```

## Mocking External Services

### Supabase

Use `tests/helpers/supabase-mock.ts` for consistent mocking.

### Stripe

Mock Stripe in tests that use payment functionality:

```typescript
jest.mock('stripe', () => ({
  Stripe: jest.fn(() => ({
    checkout: {
      sessions: {
        create: jest.fn(),
      },
    },
  })),
}));
```

### OpenAI

Mock OpenAI for recommendation tests:

```typescript
jest.mock('openai', () => ({
  OpenAI: jest.fn(() => ({
    embeddings: {
      create: jest.fn().mockResolvedValue({
        data: [{ embedding: [0.1, 0.2, 0.3] }],
      }),
    },
  })),
}));
```

## CI/CD Integration

Tests run automatically on:
- Every push to `main` or `develop`
- Every pull request

The CI pipeline runs:
1. Type checking (`npm run type-check`)
2. Linting (`npm run lint`)
3. Unit tests (`npm test`)
4. E2E tests (`npm run test:e2e`)

## Test Coverage Goals

Aim for the following coverage:
- **Utilities**: 90%+
- **Components**: 80%+
- **API Routes**: 85%+
- **Business Logic**: 90%+

Check coverage with:
```bash
npm test -- --coverage
```

## Debugging Tests

### Debug Single Test

```bash
npm test -- -t "test name"
```

### Debug with Node Inspector

```bash
node --inspect-brk node_modules/.bin/jest --runInBand
```

### Debug E2E Tests

```bash
npm run test:e2e -- --debug
```

## Common Issues

### Tests Timing Out

Increase timeout for slow tests:

```typescript
it('slow operation', async () => {
  // test code
}, 10000); // 10 second timeout
```

### Async Issues

Always use `async/await` or return promises:

```typescript
it('fetches data', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});
```

### Mock Not Working

Ensure mocks are reset between tests:

```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Best Practices](https://testingjavascript.com/)

## Contributing

When adding new features:
1. Write tests first (TDD approach recommended)
2. Ensure all tests pass
3. Update this guide if you introduce new testing patterns
4. Maintain or improve coverage percentage
