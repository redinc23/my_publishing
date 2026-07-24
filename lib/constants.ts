export const UPLOAD_LIMITS = {
  COVER: {
    MAX_SIZE: 5 * 1024 * 1024, // 5MB
    ALLOWED_TYPES: ['image/jpeg', 'image/png', 'image/webp'],
  },
  EPUB: {
    MAX_SIZE: 100 * 1024 * 1024, // 100MB
    ALLOWED_TYPES: ['application/epub+zip'],
  },
  MANUSCRIPT: {
    MAX_SIZE: 50 * 1024 * 1024, // 50MB
    ALLOWED_TYPES: ['application/pdf', 'application/msword', 'text/plain'],
  },
} as const;

export const BOOK_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
  REVIEW: 'review',
} as const;

export const USER_ROLES = {
  USER: 'user',
  AUTHOR: 'author',
  ADMIN: 'admin',
} as const;

export const SUBSCRIPTION_TIERS = {
  FREE: 'free',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export const PRICING = {
  FREE: {
    maxBooks: 3,
    maxStorage: 100 * 1024 * 1024, // 100MB
    features: ['Basic analytics', 'Standard support'],
  },
  PRO: {
    maxBooks: 50,
    maxStorage: 10 * 1024 * 1024 * 1024, // 10GB
    features: ['Advanced analytics', 'Priority support', 'Custom domains'],
  },
  ENTERPRISE: {
    maxBooks: Infinity,
    maxStorage: 100 * 1024 * 1024 * 1024, // 100GB
    features: ['All Pro features', 'Dedicated support', 'API access'],
  },
} as const;
