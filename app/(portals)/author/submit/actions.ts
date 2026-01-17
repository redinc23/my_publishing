'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function submitManuscript(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: author } = await supabase
    .from('authors')
    .select('id')
    .eq('profile_id', user.id)
    .single();

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

  if (!title || !genre) {
    return { error: 'Title and genre are required' };
  }

  const { error } = await supabase.from('manuscripts').insert({
    author_id: author.id,
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
