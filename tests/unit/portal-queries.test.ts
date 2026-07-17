import { getAuthorForUser, getPartnerForUser } from '@/lib/supabase/portal-queries';
import { createClient } from '@/lib/supabase/admin';

jest.mock('@/lib/supabase/admin', () => ({
  createClient: jest.fn(),
}));

function makeSingleChain(result: unknown) {
  return {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
  };
}

describe('portal query helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves an author through user profile ownership', async () => {
    const profileChain = makeSingleChain({ data: { id: 'profile-1' }, error: null });
    const author = {
      id: 'author-1',
      profile_id: 'profile-1',
      pen_name: 'A. Writer',
      is_verified: true,
    };
    const authorChain = makeSingleChain({ data: author, error: null });
    const admin = {
      from: jest.fn((table: string) => (table === 'profiles' ? profileChain : authorChain)),
    };
    (createClient as jest.Mock).mockReturnValue(admin);

    await expect(getAuthorForUser('auth-user-1')).resolves.toBe(author);

    expect(admin.from).toHaveBeenNthCalledWith(1, 'profiles');
    expect(profileChain.select).toHaveBeenCalledWith('id');
    expect(profileChain.eq).toHaveBeenCalledWith('user_id', 'auth-user-1');
    expect(admin.from).toHaveBeenNthCalledWith(2, 'authors');
    expect(authorChain.select).toHaveBeenCalledWith(
      'id, profile_id, pen_name, bio, is_verified, total_books, photo_url, created_at'
    );
    expect(authorChain.eq).toHaveBeenCalledWith('profile_id', 'profile-1');
  });

  it('returns null without querying authors when the user has no profile', async () => {
    const profileChain = makeSingleChain({ data: null, error: null });
    const admin = {
      from: jest.fn(() => profileChain),
    };
    (createClient as jest.Mock).mockReturnValue(admin);

    await expect(getAuthorForUser('missing-user')).resolves.toBeNull();

    expect(admin.from).toHaveBeenCalledTimes(1);
    expect(profileChain.eq).toHaveBeenCalledWith('user_id', 'missing-user');
  });

  it('returns null when the profile has no author row', async () => {
    const profileChain = makeSingleChain({ data: { id: 'profile-without-author' }, error: null });
    const authorChain = makeSingleChain({ data: null, error: null });
    const admin = {
      from: jest.fn((table: string) => (table === 'profiles' ? profileChain : authorChain)),
    };
    (createClient as jest.Mock).mockReturnValue(admin);

    await expect(getAuthorForUser('reader-user')).resolves.toBeNull();

    expect(authorChain.eq).toHaveBeenCalledWith('profile_id', 'profile-without-author');
  });

  it('resolves a partner through user profile ownership', async () => {
    const profileChain = makeSingleChain({ data: { id: 'profile-2' }, error: null });
    const partner = {
      id: 'partner-1',
      profile_id: 'profile-2',
      institution_name: 'Library System',
      subscription_plan: 'enterprise',
    };
    const partnerChain = makeSingleChain({ data: partner, error: null });
    const admin = {
      from: jest.fn((table: string) => (table === 'profiles' ? profileChain : partnerChain)),
    };
    (createClient as jest.Mock).mockReturnValue(admin);

    await expect(getPartnerForUser('partner-user')).resolves.toBe(partner);

    expect(admin.from).toHaveBeenNthCalledWith(1, 'profiles');
    expect(profileChain.eq).toHaveBeenCalledWith('user_id', 'partner-user');
    expect(admin.from).toHaveBeenNthCalledWith(2, 'partners');
    expect(partnerChain.select).toHaveBeenCalledWith(
      'id, profile_id, institution_name, subscription_plan, created_at, updated_at'
    );
    expect(partnerChain.eq).toHaveBeenCalledWith('profile_id', 'profile-2');
  });

  it('returns null when the profile has no partner row', async () => {
    const profileChain = makeSingleChain({ data: { id: 'profile-without-partner' }, error: null });
    const partnerChain = makeSingleChain({ data: null, error: null });
    const admin = {
      from: jest.fn((table: string) => (table === 'profiles' ? profileChain : partnerChain)),
    };
    (createClient as jest.Mock).mockReturnValue(admin);

    await expect(getPartnerForUser('author-user')).resolves.toBeNull();

    expect(partnerChain.eq).toHaveBeenCalledWith('profile_id', 'profile-without-partner');
  });
});
