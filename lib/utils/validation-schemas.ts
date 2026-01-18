import { z } from 'zod';
import { v4 as uuidv4, validate as uuidValidate, version as uuidVersion } from 'uuid';

/**
 * Divine validation schemas that would make even the heavens approve.
 * Built with the wisdom of ages and the precision of a cosmic clock.
 */

// ==================== CONSTANTS & REGEX ====================
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SANITIZE_REGEX = /[<>"'`;|&$()\\]/g;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const LANGUAGE_REGEX = /^[a-z]{2,3}(?:-[A-Z]{2})?$/;

// ==================== ERROR MESSAGES ====================
const ERROR_MESSAGES = {
  UUID: {
    INVALID_FORMAT: 'UUID must be a valid v4 UUID',
    INVALID_VERSION: 'UUID must be version 4',
    REQUIRED: 'UUID is required'
  },
  STRING: {
    TOO_SHORT: 'Must be at least {min} characters',
    TOO_LONG: 'Must be at most {max} characters',
    INVALID_FORMAT: 'Invalid format'
  },
  NUMBER: {
    TOO_SMALL: 'Must be at least {min}',
    TOO_BIG: 'Must be at most {max}',
    INVALID_TYPE: 'Must be a number'
  },
  VALIDATION: {
    PERSONALIZED_REQUIRES_USER: 'Personalized recommendations require a user ID',
    SIMILAR_REQUIRES_BOOK: 'Similar recommendations require a book ID',
    CONTEXT_REQUIREMENTS: 'Context {context} has specific requirements'
  }
} as const;

// ==================== CUSTOM VALIDATORS ====================
const createCustomValidator = <T>(fn: (value: T) => boolean, message: string) =>
  (value: T) => fn(value) ? true : { message };

const isUUIDv4 = (value: string): boolean =>
  uuidValidate(value) && uuidVersion(value) === 4;

const isFutureDate = (date: Date): boolean => date > new Date();
const isPastDate = (date: Date): boolean => date < new Date();
const isWithinLastNDays = (date: Date, days: number): boolean =>
  date > new Date(Date.now() - days * 24 * 60 * 60 * 1000);

// ==================== CORE SCHEMAS ====================
export const UUIDSchema = z.string()
  .min(1, ERROR_MESSAGES.UUID.REQUIRED)
  .refine(isUUIDv4, {
    message: ERROR_MESSAGES.UUID.INVALID_VERSION,
    params: { code: 'INVALID_UUID_VERSION' }
  })
  .describe('A valid UUID v4 identifier');

export const EmailSchema = z.string()
  .min(1, 'Email is required')
  .email('Invalid email format')
  .max(254, 'Email too long')
  .transform(val => val.toLowerCase().trim())
  .describe('A valid email address');

export const ISODateSchema = z.string()
  .regex(ISO_DATE_REGEX, 'Must be ISO 8601 format')
  .refine(val => !isFutureDate(new Date(val)), 'Date cannot be in the future')
  .transform(val => new Date(val))
  .describe('ISO 8601 date string');

// ==================== DOMAIN SCHEMAS ====================
export const LimitSchema = z.number()
  .int('Must be an integer')
  .min(1, ERROR_MESSAGES.NUMBER.TOO_SMALL.replace('{min}', '1'))
  .max(1000, ERROR_MESSAGES.NUMBER.TOO_BIG.replace('{max}', '1000'))
  .default(12)
  .describe('Number of results to return (1-1000)');

export const ContextSchema = z.enum([
  'homepage',
  'discovery',
  'book_page',
  'search',
  'profile',
  'reading_list',
  'purchase_history',
  'wishlist'
])
  .default('homepage')
  .describe('User interface context for recommendations');

export const RecommendationTypeSchema = z.enum([
  'personalized',
  'similar',
  'trending',
  'discovery',
  'diverse',
  'refresh',
  'editor_pick',
  'popular',
  'new_releases'
])
  .default('personalized')
  .describe('Algorithm type for recommendations');

export const GenreSchema = z.string()
  .min(2, 'Genre must be at least 2 characters')
  .max(50, 'Genre must be at most 50 characters')
  .regex(/^[a-zA-Z\s\-&]+$/, 'Genre can only contain letters, spaces, hyphens, and ampersands')
  .transform(val => val.trim().toLowerCase())
  .describe('Book genre');

export const LanguageSchema = z.string()
  .min(2, 'Language code too short')
  .max(5, 'Language code too long')
  .regex(LANGUAGE_REGEX, 'Must be ISO language code (e.g., en, en-US)')
  .transform(val => val.toLowerCase())
  .describe('ISO language code');

// ==================== COMPLEX SCHEMAS ====================
export const FilterSchema = z.object({
  // Content filters
  genres: z.array(GenreSchema)
    .max(20, 'Maximum 20 genres allowed')
    .optional()
    .default([]),

  authors: z.array(z.string().min(1).max(100))
    .max(50, 'Maximum 50 authors allowed')
    .optional()
    .default([]),

  publishers: z.array(z.string().min(1).max(100))
    .max(20, 'Maximum 20 publishers allowed')
    .optional()
    .default([]),

  // Quality filters
  minRating: z.number()
    .min(0, 'Rating cannot be negative')
    .max(5, 'Maximum rating is 5')
    .optional()
    .refine(val => val === undefined || val % 0.5 === 0, {
      message: 'Rating must be in increments of 0.5'
    }),

  minReviews: z.number()
    .int('Must be an integer')
    .min(0, 'Cannot be negative')
    .max(1000000, 'Value too large')
    .optional(),

  // Temporal filters
  publicationDate: z.object({
    after: ISODateSchema.optional(),
    before: ISODateSchema.optional()
  })
    .optional()
    .refine(data => {
      if (!data?.after || !data?.before) return true;
      return data.after < data.before;
    }, 'After date must be before before date'),

  maxAgeDays: z.number()
    .int('Must be an integer')
    .min(1, 'Must be at least 1 day')
    .max(3650, 'Cannot exceed 10 years')
    .optional(),

  // Content characteristics
  languages: z.array(LanguageSchema)
    .min(1, 'At least one language required')
    .max(10, 'Maximum 10 languages allowed')
    .default(['en']),

  pageRange: z.tuple([
    z.number().min(1).max(9999),
    z.number().min(1).max(9999)
  ])
    .optional()
    .refine(([min, max]) => min <= max, 'Minimum pages must be less than or equal to maximum'),

  // Advanced filters
  priceRange: z.tuple([
    z.number().min(0).max(10000),
    z.number().min(0).max(10000)
  ])
    .optional()
    .refine(([min, max]) => min <= max, 'Minimum price must be less than or equal to maximum'),

  formats: z.array(z.enum(['paperback', 'hardcover', 'ebook', 'audiobook']))
    .optional()
    .default(['ebook']),

  excludeIds: z.array(UUIDSchema)
    .max(100, 'Cannot exclude more than 100 items')
    .optional()
    .default([]),

  requiredTags: z.array(z.string().max(50))
    .max(10, 'Maximum 10 tags allowed')
    .optional()
    .default([])
})
  .strict()
  .optional()
  .default({})
  .describe('Advanced filtering options for recommendations');

// ==================== MAIN QUERY SCHEMA ====================
export const RecommendationQuerySchema = z.object({
  // Core identifiers
  userId: UUIDSchema
    .optional()
    .describe('User identifier for personalized recommendations'),

  sessionId: UUIDSchema
    .optional()
    .describe('Session identifier for tracking'),

  deviceId: z.string()
    .max(200, 'Device ID too long')
    .optional()
    .describe('Device identifier'),

  // Recommendation parameters
  context: ContextSchema,
  limit: LimitSchema,
  type: RecommendationTypeSchema,

  // Content references
  bookId: UUIDSchema
    .optional()
    .describe('Reference book ID for similar recommendations'),

  seedIds: z.array(UUIDSchema)
    .max(5, 'Maximum 5 seed IDs allowed')
    .optional()
    .default([])
    .describe('Seed content IDs for recommendations'),

  // Filters
  filters: FilterSchema,

  // Personalization
  personalizationStrength: z.number()
    .min(0, 'Cannot be negative')
    .max(1, 'Cannot exceed 1')
    .default(0.8)
    .describe('Strength of personalization (0-1)'),

  diversityFactor: z.number()
    .min(0, 'Cannot be negative')
    .max(1, 'Cannot exceed 1')
    .default(0.3)
    .describe('Diversity factor for results (0-1)'),

  // Performance & caching
  useCache: z.boolean()
    .default(true)
    .describe('Whether to use cached results'),

  cacheTtlSeconds: z.number()
    .int('Must be an integer')
    .min(0, 'Cannot be negative')
    .max(86400, 'Cannot exceed 24 hours')
    .default(300)
    .optional(),

  // Tracking & debugging
  requestId: UUIDSchema
    .default(() => uuidv4())
    .describe('Unique request identifier'),

  debug: z.boolean()
    .default(false)
    .describe('Enable debug mode'),

  metadata: z.record(z.any())
    .optional()
    .default({})
    .describe('Additional metadata for tracking')
})
  .strict()
  .superRefine((data, ctx) => {
    // Context-specific validations
    const contextRequirements: Record<string, string[]> = {
      'book_page': ['bookId'],
      'profile': ['userId'],
      'purchase_history': ['userId'],
      'wishlist': ['userId']
    };

    const required = contextRequirements[data.context];
    if (required) {
      required.forEach(field => {
        if (!data[field as keyof typeof data]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Context '${data.context}' requires ${field}`,
            path: [field],
            params: { code: 'CONTEXT_REQUIREMENT' }
          });
        }
      });
    }

    // Type-specific validations
    if (data.type === 'personalized' && !data.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: ERROR_MESSAGES.VALIDATION.PERSONALIZED_REQUIRES_USER,
        path: ['userId'],
        params: { code: 'PERSONALIZATION_REQUIRES_USER' }
      });
    }

    if (data.type === 'similar' && !data.bookId && data.seedIds.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: ERROR_MESSAGES.VALIDATION.SIMILAR_REQUIRES_BOOK,
        path: ['bookId'],
        params: { code: 'SIMILAR_REQUIRES_REFERENCE' }
      });
    }

    // Business logic validations
    if (data.filters?.priceRange && data.context === 'discovery') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Price filtering not available in discovery context',
        path: ['filters', 'priceRange'],
        params: { code: 'CONTEXT_RESTRICTION' }
      });
    }

    // Performance validations
    if (data.limit > 100 && data.type === 'diverse') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Diverse recommendations limited to 100 items',
        path: ['limit'],
        params: { code: 'PERFORMANCE_LIMIT' }
      });
    }
  })
  .describe('Complete recommendation query with validation');

// ==================== VALIDATION UTILITIES ====================
export type ValidationResult<T> =
  | { success: true; data: T; warnings?: string[] }
  | { success: false; errors: string[]; details: z.ZodIssue[] };

export class DivineValidator {
  private static instance: DivineValidator;
  private cache = new Map<string, { timestamp: number; result: any }>();
  private readonly CACHE_TTL = 5000; // 5 seconds

  private constructor() {}

  static getInstance(): DivineValidator {
    if (!DivineValidator.instance) {
      DivineValidator.instance = new DivineValidator();
    }
    return DivineValidator.instance;
  }

  validateAndSanitize<T>(schema: z.ZodType<T>, data: unknown): ValidationResult<T> {
    const cacheKey = `${schema.description}-${JSON.stringify(data)}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.result;
    }

    const result = schema.safeParse(data);

    if (!result.success) {
      const errors = result.error.errors.map(e =>
        `${e.path.join('.')}: ${e.message} (code: ${e.code})`
      );

      const validationResult: ValidationResult<T> = {
        success: false,
        errors,
        details: result.error.errors
      };

      this.cache.set(cacheKey, { timestamp: Date.now(), result: validationResult });
      return validationResult;
    }

    const sanitizedData = this.sanitizeData(result.data);
    const validationResult: ValidationResult<T> = {
      success: true,
      data: sanitizedData
    };

    this.cache.set(cacheKey, { timestamp: Date.now(), result: validationResult });
    return validationResult;
  }

  private sanitizeData<T>(data: T): T {
    if (typeof data === 'string') {
      return this.sanitizeString(data) as unknown as T;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item)) as unknown as T;
    }

    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeData(value);
      }
      return sanitized;
    }

    return data;
  }

  sanitizeString(input: string): string {
    if (typeof input !== 'string') return input;

    return input
      .replace(SANITIZE_REGEX, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 5000);
  }

  validateEmail(email: string): boolean {
    return EmailSchema.safeParse(email).success;
  }

  validateUUID(uuid: string): boolean {
    return UUIDSchema.safeParse(uuid).success;
  }

  generateRequestId(): string {
    return uuidv4();
  }

  getSchemaErrors(schema: z.ZodType<any>, data: unknown): string[] {
    const result = schema.safeParse(data);
    return result.success ? [] : result.error.errors.map(e => e.message);
  }

  createQueryFromDefaults(defaults: Partial<z.infer<typeof RecommendationQuerySchema>>) {
    return RecommendationQuerySchema.parse({
      requestId: this.generateRequestId(),
      context: 'homepage',
      limit: 12,
      type: 'personalized',
      personalizationStrength: 0.8,
      diversityFactor: 0.3,
      useCache: true,
      debug: false,
      filters: {},
      metadata: {},
      ...defaults
    });
  }
}

// ==================== EXPORT TYPES ====================
export type RecommendationQuery = z.infer<typeof RecommendationQuerySchema>;
export type RecommendationFilters = z.infer<typeof FilterSchema>;
export type ValidationSchemas = {
  UUIDSchema: typeof UUIDSchema;
  EmailSchema: typeof EmailSchema;
  LimitSchema: typeof LimitSchema;
  ContextSchema: typeof ContextSchema;
  RecommendationTypeSchema: typeof RecommendationTypeSchema;
  FilterSchema: typeof FilterSchema;
  RecommendationQuerySchema: typeof RecommendationQuerySchema;
};

// ==================== DEFAULT EXPORT ====================
export const validationSchemas: ValidationSchemas = {
  UUIDSchema,
  EmailSchema,
  LimitSchema,
  ContextSchema,
  RecommendationTypeSchema,
  FilterSchema,
  RecommendationQuerySchema
};

// ==================== SINGLETON EXPORT ====================
export const divineValidator = DivineValidator.getInstance();

// ==================== UTILITY FUNCTIONS ====================
export function createStrictValidator<T extends z.ZodType<any>>(schema: T) {
  return (data: unknown): z.infer<T> => {
    const validator = divineValidator;
    const result = validator.validateAndSanitize(schema, data);

    if (!result.success) {
      throw new Error(`Validation failed: ${result.errors.join(', ')}`);
    }

    return result.data;
  };
}

export function createLenientValidator<T extends z.ZodType<any>>(schema: T) {
  return (data: unknown): z.infer<T> => {
    try {
      return schema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Return defaults for lenient validation
        const shape = (schema as any).shape;
        const defaults: any = {};

        if (shape) {
          for (const [key, value] of Object.entries(shape)) {
            if (value instanceof z.ZodDefault) {
              defaults[key] = (value as any)._def.defaultValue();
            }
          }
        }

        return { ...defaults, ...(data as any) };
      }
      throw error;
    }
  };
}

// Example usage types for documentation
export const exampleQuery: RecommendationQuery = {
  requestId: uuidv4(),
  context: 'homepage',
  limit: 12,
  type: 'personalized',
  userId: uuidv4(),
  personalizationStrength: 0.8,
  diversityFactor: 0.3,
  useCache: true,
  debug: false,
  filters: {
    genres: ['science fiction', 'fantasy'],
    minRating: 4.0,
    languages: ['en', 'en-us'],
    pageRange: [200, 500]
  },
  metadata: {
    source: 'mobile_app',
    version: '1.0.0'
  }
};
