import { z } from 'zod';
import { logger, sanitizeForLog } from './secure-logger';
import crypto from 'crypto';

// ===== BASE SCHEMAS WITH SECURITY ENHANCEMENTS =====
export const uuidSchema = z.string().uuid().describe('Valid UUID v4');
export const bookIdSchema = uuidSchema;
export const userIdSchema = uuidSchema;

export const emailSchema = z.string()
  .email()
  .max(254) // RFC 5321 limit
  .transform(val => val.toLowerCase().trim())
  .describe('Valid email address');

export const urlSchema = z.string()
  .url()
  .max(2048) // Common browser limit
  .refine(url => {
    try {
      const parsed = new URL(url);
      return ['http:', 'https:'].includes(parsed.protocol);
    } catch {
      return false;
    }
  }, 'Invalid URL protocol')
  .describe('Valid HTTP/HTTPS URL');

export const passwordSchema = z.string()
  .min(12)
  .max(128)
  .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Must contain at least one lowercase letter')
  .regex(/\d/, 'Must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Must contain at least one special character')
  .describe('Strong password');

// ===== ADVANCED VALIDATION SCHEMAS =====
export const recommendationQuerySchema = z.object({
  userId: userIdSchema.optional(),
  bookId: bookIdSchema.optional(),
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(10)
    .describe('Pagination limit (1-100)'),
  offset: z.number()
    .int()
    .min(0)
    .max(10000)
    .default(0)
    .describe('Pagination offset'),
  genre: z.string()
    .max(50)
    .regex(/^[a-zA-Z\s\-]+$/, 'Invalid genre format')
    .optional()
    .describe('Book genre filter'),
  minRating: z.number()
    .min(0)
    .max(5)
    .optional()
    .describe('Minimum rating (0-5)'),
  excludeIds: z.array(bookIdSchema)
    .max(100)
    .default([])
    .describe('Book IDs to exclude'),
  includeAdult: z.boolean()
    .default(false)
    .describe('Include adult content'),
  sortBy: z.enum(['relevance', 'popularity', 'rating', 'date'])
    .default('relevance')
    .describe('Sorting criteria')
}).strict() // No extra fields allowed
.refine(data => data.userId || data.bookId, {
  message: 'Either userId or bookId must be provided',
  path: ['userId', 'bookId']
});

export const collaboratorSchema = z.object({
  bookId: bookIdSchema,
  userId: userIdSchema,
  role: z.enum(['author', 'co_author', 'editor', 'reviewer', 'illustrator', 'proofreader']),
  permissions: z.array(z.enum(['read', 'write', 'comment', 'admin', 'export']))
    .min(1)
    .max(5)
    .refine(perms => {
      // Business logic: admin implies all permissions
      if (perms.includes('admin')) {
        return perms.length === 1 || perms.includes('read') && perms.includes('write');
      }
      return true;
    }, 'Admin permission cannot be combined with others'),
  royaltyPercentage: z.number()
    .min(0)
    .max(100)
    .multipleOf(0.01)
    .optional()
    .refine(val => !val || val <= 100, 'Royalty cannot exceed 100%'),
  contractSigned: z.boolean().default(false),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
}).strict()
.refine(data => {
  // End date must be after start date if both provided
  if (data.startDate && data.endDate) {
    return new Date(data.endDate) > new Date(data.startDate);
  }
  return true;
}, {
  message: 'End date must be after start date',
  path: ['endDate']
});

// ===== SANITIZATION SCHEMAS =====
export const htmlSanitizerSchema = z.string()
  .transform(val => {
    // Basic HTML sanitization (use DOMPurify in production)
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+="[^"]*"/gi, '');
  });

export const sqlInjectionGuardSchema = z.string()
  .refine(val => {
    const sqlKeywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'DROP', 'UNION', 'OR', 'AND'];
    const upperVal = val.toUpperCase();
    return !sqlKeywords.some(keyword => upperVal.includes(keyword));
  }, 'Potential SQL injection detected');

// ===== ADVANCED VALIDATION FUNCTION =====
export async function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  options: {
    stripUnknown?: boolean;
    abortEarly?: boolean;
    context?: Record<string, any>;
  } = {}
): Promise<{ success: boolean; data?: T; errors?: z.ZodError['issues']; validationId?: string }> {

  const validationId = crypto.randomUUID();
  const startTime = Date.now();

  try {
    const validationOptions: Partial<z.ParseParams> = {
      ...options,
      errorMap: (issue, ctx) => {
        // Custom error mapping for better UX
        switch (issue.code) {
          case z.ZodIssueCode.too_small:
            return { message: `${ctx.data} is too short. Minimum: ${issue.minimum}` };
          case z.ZodIssueCode.too_big:
            return { message: `${ctx.data} is too long. Maximum: ${issue.maximum}` };
          case z.ZodIssueCode.invalid_type:
            return { message: `Expected ${issue.expected}, got ${issue.received}` };
          default:
            return { message: ctx.defaultError };
        }
      }
    };

    const result = await schema.safeParseAsync(data, validationOptions);

    const duration = Date.now() - startTime;

    if (result.success) {
      logger.debug({
        validationId,
        duration,
        schema: schema.description || 'unnamed',
        dataSize: JSON.stringify(data).length
      }, 'Validation successful');

      return {
        success: true,
        data: result.data,
        validationId
      };
    } else {
      logger.warn({
        validationId,
        duration,
        schema: schema.description || 'unnamed',
        errors: sanitizeForLog(result.error.issues),
        inputSample: sanitizeForLog(data, 0, 2)
      }, 'Validation failed');

      return {
        success: false,
        errors: result.error.issues,
        validationId
      };
    }

  } catch (error) {
    logger.error({
      validationId,
      error: error instanceof Error ? error.message : 'Unknown validation error',
      input: sanitizeForLog(data, 0, 1)
    }, 'Validation runtime error');

    throw new Error(`Validation system error: ${validationId}`);
  }
}

// ===== BATCH VALIDATION =====
export async function validateBatch<T>(
  schema: z.ZodSchema<T>,
  items: unknown[],
  maxBatchSize: number = 1000
): Promise<{ valid: T[]; invalid: Array<{ index: number; errors: z.ZodError['issues'] }> }> {

  if (items.length > maxBatchSize) {
    throw new Error(`Batch size ${items.length} exceeds maximum ${maxBatchSize}`);
  }

  const results = await Promise.all(
    items.map((item, index) =>
      validateInput(schema, item).then(result => ({ index, result }))
    )
  );

  const valid: T[] = [];
  const invalid: Array<{ index: number; errors: z.ZodError['issues'] }> = [];

  results.forEach(({ index, result }) => {
    if (result.success && result.data) {
      valid.push(result.data);
    } else if (result.errors) {
      invalid.push({ index, errors: result.errors });
    }
  });

  logger.info({
    batchSize: items.length,
    validCount: valid.length,
    invalidCount: invalid.length
  }, 'Batch validation completed');

  return { valid, invalid };
}

// ===== CACHE FOR FREQUENTLY USED SCHEMAS =====
const schemaCache = new Map<string, z.ZodSchema>();

export function getCachedSchema<T>(key: string, factory: () => z.ZodSchema<T>): z.ZodSchema<T> {
  if (!schemaCache.has(key)) {
    schemaCache.set(key, factory());
  }
  return schemaCache.get(key) as z.ZodSchema<T>;
}
