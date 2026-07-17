/** @jest-environment node */

import { hasCompletedOrderForBook } from '@/lib/reading/entitlement';

function makeOrderChain(result: { data: unknown; error: unknown }) {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  return chain;
}

describe('hasCompletedOrderForBook', () => {
  it('returns true when a completed order contains the book', async () => {
    const chain = makeOrderChain({ data: { id: 'order-1' }, error: null });
    const admin = { from: jest.fn(() => chain) };

    await expect(
      hasCompletedOrderForBook(admin as never, 'profile-1', 'book-1')
    ).resolves.toBe(true);

    expect(admin.from).toHaveBeenCalledWith('orders');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'profile-1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'completed');
    expect(chain.eq).toHaveBeenCalledWith('items.book_id', 'book-1');
  });

  it('returns false when no completed entitlement exists', async () => {
    const chain = makeOrderChain({ data: null, error: null });
    const admin = { from: jest.fn(() => chain) };

    await expect(
      hasCompletedOrderForBook(admin as never, 'profile-1', 'book-1')
    ).resolves.toBe(false);
  });

  it('fails closed by throwing on query errors', async () => {
    const chain = makeOrderChain({ data: null, error: { message: 'db down' } });
    const admin = { from: jest.fn(() => chain) };

    await expect(
      hasCompletedOrderForBook(admin as never, 'profile-1', 'book-1')
    ).rejects.toEqual({ message: 'db down' });
  });
});
