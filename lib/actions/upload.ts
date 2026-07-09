/* eslint-disable */
'use server';

import { createHash } from 'crypto';
import { createClient } from '@/lib/supabase/server';
import { UPLOAD_CONFIGS, type UploadResult } from '@/types/upload';

export async function uploadFile(
  file: File,
  bucket: 'book-covers' | 'manuscripts' | 'published-epubs',
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const config =
      UPLOAD_CONFIGS[
        bucket === 'book-covers' ? 'cover' : bucket === 'manuscripts' ? 'manuscript' : 'epub'
      ];

    if (!config) {
      throw new Error('Invalid bucket');
    }

    if (file.size > config.maxSize) {
      throw new Error(`File size exceeds ${config.maxSize / (1024 * 1024)}MB limit`);
    }

    // Content-addressed path: SHA-256 of the file bytes (Fix C7).
    // Identical uploads by the same user map to the same object.
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const hash = createHash('sha256').update(fileBuffer).digest('hex');
    const fileExt = file.name.split('.').pop();
    const fileName = `${hash}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    // Deduplication: reuse the existing object when present.
    const { data: existing } = await supabase.storage
      .from(bucket)
      .list(user.id, { search: fileName });
    const alreadyUploaded = existing?.some((obj) => obj.name === fileName) ?? false;

    if (!alreadyUploaded) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, fileBuffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

      // A concurrent upload of the same content is not an error (409 duplicate).
      if (error && !/already exists|duplicate/i.test(error.message)) {
        throw error;
      }
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(filePath);

    return {
      filePath,
      publicUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      hash,
      metadata: { deduplicated: alreadyUploaded },
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

export async function deleteFile(bucket: string, filePath: string) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { error } = await supabase.storage.from(bucket).remove([filePath]);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Delete file error:', error);
    throw error;
  }
}
