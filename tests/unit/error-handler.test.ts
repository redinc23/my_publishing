/**
 * Unit tests for error handling utilities
 */
import { AppError, handleError } from '@/lib/utils/error-handler';

describe('Error Handler', () => {
  describe('AppError', () => {
    it('creates error with message', () => {
      const error = new AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('AppError');
    });

    it('creates error with status code', () => {
      const error = new AppError('Not found', 404);
      expect(error.statusCode).toBe(404);
    });

    it('defaults to 500 status code', () => {
      const error = new AppError('Server error');
      expect(error.statusCode).toBe(500);
    });

    it('includes optional error code', () => {
      const error = new AppError('Validation failed', 400, 'VALIDATION_ERROR');
      expect(error.code).toBe('VALIDATION_ERROR');
    });

    it('is instance of Error', () => {
      const error = new AppError('Test');
      expect(error instanceof Error).toBe(true);
      expect(error instanceof AppError).toBe(true);
    });
  });

  describe('handleError', () => {
    it('handles AppError correctly', () => {
      const error = new AppError('Custom error', 403);
      const result = handleError(error);
      
      expect(result.message).toBe('Custom error');
      expect(result.statusCode).toBe(403);
    });

    it('handles standard Error', () => {
      const error = new Error('Standard error');
      const result = handleError(error);
      
      expect(result.message).toBe('Standard error');
      expect(result.statusCode).toBe(500);
    });

    it('handles unknown error types', () => {
      const result = handleError('string error');
      
      expect(result.message).toBe('An unexpected error occurred');
      expect(result.statusCode).toBe(500);
    });

    it('handles null', () => {
      const result = handleError(null);
      
      expect(result.message).toBe('An unexpected error occurred');
      expect(result.statusCode).toBe(500);
    });

    it('handles undefined', () => {
      const result = handleError(undefined);
      
      expect(result.message).toBe('An unexpected error occurred');
      expect(result.statusCode).toBe(500);
    });

    it('handles objects without message', () => {
      const result = handleError({ foo: 'bar' });
      
      expect(result.message).toBe('An unexpected error occurred');
      expect(result.statusCode).toBe(500);
    });
  });

  describe('Common HTTP status codes', () => {
    it('handles 400 Bad Request', () => {
      const error = new AppError('Bad request', 400);
      const result = handleError(error);
      expect(result.statusCode).toBe(400);
    });

    it('handles 401 Unauthorized', () => {
      const error = new AppError('Unauthorized', 401);
      const result = handleError(error);
      expect(result.statusCode).toBe(401);
    });

    it('handles 403 Forbidden', () => {
      const error = new AppError('Forbidden', 403);
      const result = handleError(error);
      expect(result.statusCode).toBe(403);
    });

    it('handles 404 Not Found', () => {
      const error = new AppError('Not found', 404);
      const result = handleError(error);
      expect(result.statusCode).toBe(404);
    });

    it('handles 422 Unprocessable Entity', () => {
      const error = new AppError('Validation failed', 422);
      const result = handleError(error);
      expect(result.statusCode).toBe(422);
    });
  });
});
