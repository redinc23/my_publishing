/* eslint-disable */
'use server';

import { createClient } from '@/lib/supabase/server';
import { computeFileHash } from '@/lib/utils/file-utils';
import { UPLOAD_CONFIGS, type UploadResult } from '@/types/upload';

export async function uploadFile(
  file: File,
  bucket: 'book-covers' | 'manuscripts' | 'published-epubs',
  onProgress?: (progress: number) => void
): Promise<UploadResult> {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const config = UPLOAD_CONFIGS[bucket === 'book-covers' ? 'cover' : 
                     bucket === 'manuscripts' ? 'manuscript' : 'epub'];
    
    if (!config) {
      throw new Error('Invalid bucket');
    }

    if (file.size > config.maxSize) {
      throw new Error(`File size exceeds ${config.maxSize / (1024 * 1024)}MB limit`);
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `${user.id}/${fileName}`;

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    const hash = await computeFileHash(file);

    return {
      filePath,
      publicUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      hash,
      metadata: {},
    };
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
}

export async function deleteFile(bucket: string, filePath: string) {
  try {
    const supabase = await createClient();
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (error) throw error;

    return { success: true };
  } catch (error) {
    console.error('Delete file error:', error);
    throw error;
  }
}
