import '@/lib/server-only-guard';
import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { UPLOAD_CONFIGS } from '@/types/upload';

/**
 * Shared storage core for book cover / EPUB uploads.
 *
 * Used by app/api/upload/book-assets/route.ts. Mirrors the proven logic in
 * lib/actions/upload.ts (SHA-256 content-addressed paths + dedup) without
 * touching that server action. All functions here must run server-side only.
 */

export type BookAssetKind = 'cover' | 'epub';

export const BOOK_ASSET_BUCKETS: Record<BookAssetKind, 'book-covers' | 'published-epubs'> = {
  cover: 'book-covers',
  epub: 'published-epubs',
};

export interface StoredBookAsset {
  url: string;
  filePath: string;
  hash: string;
  deduplicated: boolean;
}

export function formatMb(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '');
}

/**
 * Validates a file against UPLOAD_CONFIGS for the given asset kind.
 * Returns a specific, user-safe message on failure.
 */
export function validateBookAsset(
  file: { name: string; size: number; type: string },
  asset: BookAssetKind
): { ok: true } | { ok: false; error: string } {
  const config = UPLOAD_CONFIGS[asset];
  if (!config) {
    return { ok: false, error: 'Unknown asset type' };
  }

  if (file.size <= 0) {
    return { ok: false, error: 'The file is empty' };
  }

  if (file.size > config.maxSize) {
    return {
      ok: false,
      error: `Max ${formatMb(config.maxSize)}MB — your file is ${formatMb(file.size)}MB`,
    };
  }

  if (asset === 'cover') {
    const allowedMimeTypes = Object.keys(config.accept);
    if (!allowedMimeTypes.includes(file.type)) {
      return { ok: false, error: 'JPG, PNG, WebP or GIF images only' };
    }
    return { ok: true };
  }

  // EPUB: browsers sometimes report .epub files as application/octet-stream
  // (or no type at all), so tolerate those when the extension is .epub.
  const mime = file.type;
  const isEpubMime = mime === 'application/epub+zip';
  const isLooseEpub =
    (mime === 'application/octet-stream' || mime === '') &&
    file.name.toLowerCase().endsWith('.epub');
  if (!isEpubMime && !isLooseEpub) {
    return { ok: false, error: 'EPUB files (.epub) only' };
  }
  return { ok: true };
}

/**
 * Stores a book asset in Supabase storage with a content-addressed path:
 * `${userId}/${sha256}.${ext}`. Re-uploading identical bytes reuses the
 * existing object (deduplicated), and a concurrent upload of the same
 * content (409 duplicate) is tolerated rather than treated as an error.
 */
export async function storeBookAsset(
  supabase: SupabaseClient,
  asset: BookAssetKind,
  userId: string,
  file: File
): Promise<StoredBookAsset> {
  const bucket = BOOK_ASSET_BUCKETS[asset];

  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const hash = createHash('sha256').update(fileBuffer).digest('hex');
  const fileExt = (file.name.split('.').pop() || 'bin').toLowerCase();
  const fileName = `${hash}.${fileExt}`;
  const filePath = `${userId}/${fileName}`;

  const { data: existing } = await supabase.storage.from(bucket).list(userId, { search: fileName });
  const deduplicated = existing?.some((obj) => obj.name === fileName) ?? false;

  if (!deduplicated) {
    // The published-epubs bucket only allows application/epub+zip; normalize
    // loose browser MIME types so valid .epub files are not rejected.
    const contentType =
      asset === 'epub' ? 'application/epub+zip' : file.type || 'application/octet-stream';

    const { error } = await supabase.storage.from(bucket).upload(filePath, fileBuffer, {
      cacheControl: '3600',
      upsert: false,
      contentType,
    });

    if (error && !/already exists|duplicate/i.test(error.message)) {
      throw error;
    }
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(filePath);

  return { url: publicUrl, filePath, hash, deduplicated };
}
