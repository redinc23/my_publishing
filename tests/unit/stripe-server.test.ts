const ORIGINAL_ENV = process.env;

describe('Stripe server helpers', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      STRIPE_SECRET_KEY: 'sk_test_unit',
    };
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  async function loadWithMockedStripe() {
    const create = jest.fn().mockResolvedValue({ id: 'cs_test_123' });
    const StripeMock = jest.fn().mockImplementation(() => ({
      checkout: {
        sessions: {
          create,
        },
      },
    }));

    jest.doMock('stripe', () => ({
      __esModule: true,
      default: StripeMock,
    }));

    const mod = await import('@/lib/stripe/server');
    return { createCheckoutSession: mod.createCheckoutSession, create, StripeMock };
  }

  const baseParams = {
    bookId: 'book-123',
    bookSlug: 'my-book',
    userId: 'user-456',
    bookTitle: 'My Book',
    price: 12.34,
  };

  it('prefers an explicit baseUrl over environment fallback', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://env.example';
    const { createCheckoutSession, create } = await loadWithMockedStripe();

    await createCheckoutSession({
      ...baseParams,
      baseUrl: 'https://app.example',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'https://app.example/books/my-book?success=true',
        cancel_url: 'https://app.example/books/my-book?canceled=true',
      })
    );
  });

  it('falls back to NEXT_PUBLIC_SITE_URL, then localhost', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://site.example';
    let loaded = await loadWithMockedStripe();
    await loaded.createCheckoutSession(baseParams);
    expect(loaded.create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'https://site.example/books/my-book?success=true',
        cancel_url: 'https://site.example/books/my-book?canceled=true',
      })
    );

    jest.resetModules();
    delete process.env.NEXT_PUBLIC_SITE_URL;
    loaded = await loadWithMockedStripe();
    await loaded.createCheckoutSession(baseParams);
    expect(loaded.create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'http://localhost:3000/books/my-book?success=true',
        cancel_url: 'http://localhost:3000/books/my-book?canceled=true',
      })
    );
  });

  it('passes payment details and metadata through to Stripe', async () => {
    const { createCheckoutSession, create, StripeMock } = await loadWithMockedStripe();

    await expect(createCheckoutSession(baseParams)).resolves.toEqual({ id: 'cs_test_123' });

    expect(StripeMock).toHaveBeenCalledWith('sk_test_unit', { apiVersion: '2023-10-16' });
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          expect.objectContaining({
            price_data: expect.objectContaining({
              currency: 'usd',
              product_data: { name: 'My Book' },
              unit_amount: 1234,
            }),
            quantity: 1,
          }),
        ],
        metadata: {
          book_id: 'book-123',
          book_slug: 'my-book',
          user_id: 'user-456',
        },
      })
    );
  });

  it('uses book id in URLs and empty slug metadata when no slug is provided', async () => {
    const { createCheckoutSession, create } = await loadWithMockedStripe();

    await createCheckoutSession({
      ...baseParams,
      bookSlug: undefined,
      baseUrl: 'https://app.example',
    });

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url: 'https://app.example/books/book-123?success=true',
        cancel_url: 'https://app.example/books/book-123?canceled=true',
        metadata: expect.objectContaining({ book_slug: '' }),
      })
    );
  });
});
