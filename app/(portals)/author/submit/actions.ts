'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { getAuthorForUser } from '@/lib/supabase/portal-queries';

const MAX_MANUSCRIPT_BYTES = 100 * 1024 * 1024;
const ALLOWED_MANUSCRIPT_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
]);

function sanitizeFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
}

export async function submitManuscript(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // authors has no RLS SELECT policy, so resolve the author row server-side.
  const author = await getAuthorForUser(user.id);

  if (!author) {
    return { error: 'Author profile not found' };
  }

  const title = formData.get('title') as string;
  const workingTitle = formData.get('workingTitle') as string | null;
  const genre = formData.get('genre') as string;
  const synopsis = formData.get('synopsis') as string | null;
  const wordCount = formData.get('wordCount')
    ? parseInt(formData.get('wordCount') as string)
    : null;
  const targetAudience = formData.get('targetAudience') as string | null;
  const manuscriptFile = formData.get('manuscriptFile');

  if (!title || !genre) {
    return { error: 'Title and genre are required' };
  }

  if (!(manuscriptFile instanceof File) || manuscriptFile.size === 0) {
    return { error: 'Please upload a manuscript file' };
  }

  if (manuscriptFile.size > MAX_MANUSCRIPT_BYTES) {
    return { error: 'Manuscript file must be 100MB or smaller' };
  }

  if (!ALLOWED_MANUSCRIPT_TYPES.has(manuscriptFile.type)) {
    return { error: 'Upload a PDF, Word document, or plain text manuscript' };
  }

  const admin = createAdminClient();
  const manuscriptPath = `${author.id}/${Date.now()}-${sanitizeFileName(manuscriptFile.name)}`;
  const { error: uploadError } = await admin.storage
    .from('manuscripts')
    .upload(manuscriptPath, await manuscriptFile.arrayBuffer(), {
      contentType: manuscriptFile.type,
      upsert: false,
    });

  if (uploadError) {
    return { error: `Manuscript upload failed: ${uploadError.message}` };
  }

  const { error } = await supabase.from('manuscripts').insert({
    author_id: author.id,
    title,
    working_title: workingTitle,
    genre,
    synopsis,
    word_count: wordCount,
    target_audience: targetAudience,
    manuscript_file_url: manuscriptPath,
    status: 'submitted',
    submission_date: new Date().toISOString(),
  });

  if (error) {
    await admin.storage.from('manuscripts').remove([manuscriptPath]);
    return { error: error.message };
  }

  return null;
}
