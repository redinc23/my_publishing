
import '@testing-library/jest-dom';
import { computeFileHash } from '@/lib/utils/file-utils';

describe('computeFileHash', () => {
  it('should generate a correct SHA-256 hash for a file', async () => {
    const content = 'Hello World';
    const file = new File([content], 'hello.txt', { type: 'text/plain' });

    const hashHex = await computeFileHash(file);

    // SHA-256 for "Hello World"
    expect(hashHex).toBe('a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e');
  });

  it('should generate different hashes for different content', async () => {
    const content1 = 'Hello World';
    const content2 = 'Hello World!';

    const file1 = new File([content1], 'hello.txt', { type: 'text/plain' });
    const file2 = new File([content2], 'hello.txt', { type: 'text/plain' });

    const hash1 = await computeFileHash(file1);
    const hash2 = await computeFileHash(file2);

    expect(hash1).not.toBe(hash2);
  });
});
