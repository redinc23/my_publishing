/* eslint-disable */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';

const ALLOWED_FILE_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['application/msword', 'doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
  ['text/plain', 'txt'],
]);

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
    }
    const file = formData.get('file');

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type and size
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const fileExt = ALLOWED_FILE_TYPES.get(file.type);
    if (!fileExt) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload a PDF, Word document, or plain text file.' },
        { status: 400 }
      );
    }

    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const adminSupabase = createAdminClient();
    const { error } = await adminSupabase.storage.from('manuscripts').upload(fileName, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      console.error('[Upload] Failed to store file:', error);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = adminSupabase.storage.from('manuscripts').getPublicUrl(fileName);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    console.error('[Upload] Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
