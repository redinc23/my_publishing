'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthorContext } from '@/lib/utils/author-context';

export async function submitManuscript(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { authorId } = await getAuthorContext(supabase, user.id);

  if (!authorId) {
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

  if (!title || !genre) {
    return { error: 'Title and genre are required' };
  }

  const { error } = await supabase.from('manuscripts').insert({
    author_id: authorId,
    title,
    working_title: workingTitle,
    genre,
    synopsis,
    word_count: wordCount,
    target_audience: targetAudience,
    status: 'submitted',
  });

  if (error) {
    return { error: error.message };
  }

  return null;
}
