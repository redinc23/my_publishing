import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { rateLimitMiddleware } from '@/lib/middleware/rate-limit';

export async function POST(request: NextRequest) {
  // Apply rate limiting
  const rateLimitResponse = rateLimitMiddleware(request, 20, 60000);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type - only allow specific document formats
    const allowedExtensions = ['pdf', 'doc', 'docx', 'txt', 'epub'];
    const allowedMimeTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'application/epub+zip',
    ];

    const fileExt = file.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PDF, DOC, DOCX, TXT, and EPUB files are allowed.' },
        { status: 400 }
      );
    }

    if (!allowedMimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file MIME type.' },
        { status: 400 }
      );
    }

    // Validate file type and size
    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    // Sanitize filename to prevent path traversal
    const sanitizedExt = fileExt.replace(/[^a-z0-9]/gi, '');
    const fileName = `${user.id}/${Date.now()}.${sanitizedExt}`;

    const { data, error } = await supabase.storage
      .from('manuscripts')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('manuscripts').getPublicUrl(fileName);

    return NextResponse.json({ url: publicUrl });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
