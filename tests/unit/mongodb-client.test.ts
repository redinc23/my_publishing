/**
 * Unit tests for MongoDB env helpers (no live Atlas / no native driver load).
 */

import { assertMongoUri, getMongoDbName, isMongoConfigured } from '@/lib/mongodb-config';

describe('lib/mongodb-config', () => {
  const originalUri = process.env.MONGODB_URI;
  const originalDb = process.env.MONGODB_DB;

  afterEach(() => {
    if (originalUri === undefined) {
      delete process.env.MONGODB_URI;
    } else {
      process.env.MONGODB_URI = originalUri;
    }
    if (originalDb === undefined) {
      delete process.env.MONGODB_DB;
    } else {
      process.env.MONGODB_DB = originalDb;
    }
  });

  it('isMongoConfigured is false without URI', () => {
    delete process.env.MONGODB_URI;
    expect(isMongoConfigured()).toBe(false);
  });

  it('isMongoConfigured is true for mongodb+srv URI', () => {
    expect(
      isMongoConfigured('mongodb+srv://user:pass@cluster0.example.mongodb.net/?appName=Cluster0')
    ).toBe(true);
  });

  it('getMongoDbName defaults to mangu', () => {
    delete process.env.MONGODB_DB;
    expect(getMongoDbName()).toBe('mangu');
  });

  it('getMongoDbName respects MONGODB_DB', () => {
    expect(getMongoDbName('mangu_test')).toBe('mangu_test');
  });

  it('assertMongoUri rejects placeholder password', () => {
    expect(() =>
      assertMongoUri('mongodb+srv://user:<password>@cluster0.example.mongodb.net/')
    ).toThrow(/password placeholder/i);
  });

  it('assertMongoUri rejects missing URI', () => {
    delete process.env.MONGODB_URI;
    expect(() => assertMongoUri()).toThrow(/MONGODB_URI/);
  });

  it('assertMongoUri accepts a real-shaped URI', () => {
    expect(
      assertMongoUri('mongodb+srv://user:s3cret@cluster0.example.mongodb.net/?appName=Cluster0')
    ).toMatch(/^mongodb\+srv:\/\//);
  });
});
