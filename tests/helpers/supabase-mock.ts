/**
 * Mock Supabase client for testing
 */

const createMockChain = () => {
  const chain: any = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
  };
  
  // Add a helper to set mock return values
  chain.mockResolvedValue = (value: any) => {
    Object.keys(chain).forEach(key => {
      if (typeof chain[key] === 'function' && key !== 'mockResolvedValue') {
        chain[key].mockResolvedValue(value);
      }
    });
    return chain;
  };
  
  return chain;
};

export const mockSupabaseClient = {
  auth: {
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: null }),
    signUp: jest.fn().mockResolvedValue({ data: null, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  from: jest.fn(() => createMockChain()),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ data: null, error: null }),
      download: jest.fn().mockResolvedValue({ data: null, error: null }),
      remove: jest.fn().mockResolvedValue({ data: null, error: null }),
      getPublicUrl: jest.fn(() => ({
        data: { publicUrl: 'https://example.com/file.jpg' },
      })),
    })),
  },
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
};

export function resetSupabaseMocks() {
  jest.clearAllMocks();
}

export function createMockSupabaseResponse(data: any, error: any = null) {
  return { data, error };
}
