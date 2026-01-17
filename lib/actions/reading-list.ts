'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type ReadingStatus = 'want_to_read' | 'currently_reading' | 'read' | 'dropped';

export async function addToReadingList(bookId: string, status: ReadingStatus = 'want_to_read') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('You must be logged in to add books to your reading list');
  }
  
  const now = new Date().toISOString();
  const data: any = {
    user_id: user.id,
    book_id: bookId,
    status,
    added_at: now
  };

  // Set timestamps based on status
  if (status === 'currently_reading') {
    data.started_at = now;
  } else if (status === 'read') {
    data.started_at = now;
    data.finished_at = now;
  }

  const { data: existing } = await supabase
    .from('reading_lists')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .single();
    
  let result;
  
  if (existing) {
    // Update existing entry
    result = await supabase
      .from('reading_lists')
      .update(data)
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    // Create new entry
    result = await supabase
      .from('reading_lists')
      .insert(data)
      .select()
      .single();
  }
  
  if (result.error) {
    throw new Error('Failed to update reading list');
  }
  
  // Log activity
  await logReadingActivity(user.id, bookId, status, existing?.status);
  
  revalidatePath(`/books/${bookId}`);
  revalidatePath('/dashboard/reading-list');
  revalidatePath(`/users/${user.id}/reading-list`);
  
  return result.data;
}

export async function updateReadingStatus(bookId: string, status: ReadingStatus) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('You must be logged in to update reading status');
  }
  
  const now = new Date().toISOString();
  const updateData: any = {
    status,
    updated_at: now
  };
  
  // Update timestamps based on status change
  if (status === 'currently_reading') {
    updateData.started_at = now;
  } else if (status === 'read') {
    updateData.finished_at = now;
    if (!updateData.started_at) {
      updateData.started_at = now;
    }
  }
  
  const { data: existing } = await supabase
    .from('reading_lists')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('book_id', bookId)
    .single();
    
  if (!existing) {
    throw new Error('Book not found in your reading list');
  }
  
  const { data, error } = await supabase
    .from('reading_lists')
    .update(updateData)
    .eq('id', existing.id)
    .select()
    .single();
    
  if (error) throw error;
  
  // Log activity
  await logReadingActivity(user.id, bookId, status, existing.status);
  
  revalidatePath(`/books/${bookId}`);
  revalidatePath('/dashboard/reading-list');
  
  return data;
}

export async function removeFromReadingList(bookId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) {
    throw new Error('You must be logged in to remove books from your reading list');
  }

  const { error } = await supabase
    .from('reading_lists')
    .delete()
    .eq('user_id', user.id)
    .eq('book_id', bookId);
    
  if (error) throw error;
  
  revalidatePath(`/books/${bookId}`);
  revalidatePath('/dashboard/reading-list');
  
  return { success: true };
}

export async function getReadingList(
  userId: string, 
  status?: ReadingStatus,
  page = 1, 
  limit = 20
) {
  const supabase = await createClient();
  
  let query = supabase
    .from('reading_lists')
    .select(`
      *,
      book:books (
        id,
        title,
        cover_url,
        author:users (
          id,
          username,
          full_name
        )
      )
    `, { count: 'exact' })
    .eq('user_id', userId)
    .order('added_at', { ascending: false });
    
  if (status) {
    query = query.eq('status', status);
  }
  
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);
  
  const { data, error, count } = await query;
  
  if (error) throw error;
  
  return {
    books: data?.map(item => ({
      ...item,
      book: {
        ...item.book,
        author_name: item.book.author?.full_name || item.book.author?.username || 'Unknown Author'
      }
    })) || [],
    total: count || 0,
    page,
    totalPages: Math.ceil((count || 0) / limit)
  };
}

export async function getReadingStats(userId: string) {
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from('reading_lists')
    .select('status', { count: 'exact' })
    .eq('user_id', userId);
    
  if (error) throw error;
  
  const stats = {
    want_to_read: 0,
    currently_reading: 0,
    read: 0,
    dropped: 0,
    total: data?.length || 0
  };
  
  data?.forEach(item => {
    stats[item.status as keyof typeof stats]++;
  });
  
  return stats;
}

async function logReadingActivity(
  userId: string, 
  bookId: string, 
  newStatus: ReadingStatus,
  oldStatus?: ReadingStatus
) {
  const supabase = await createClient();
  
  // Only log if status changed
  if (oldStatus === newStatus) return;
  
  const activityType = 'reading_update';
  let metadata: any = { status: newStatus };
  
  // Get book title for activity
  const { data: book } = await supabase
    .from('books')
    .select('title')
    .eq('id', bookId)
    .single();
    
  if (book) {
    metadata.book_title = book.title;
  }
  
  await supabase
    .from('user_activities')
    .insert({
      user_id: userId,
      activity_type: activityType,
      target_type: 'book',
      target_id: bookId,
      metadata
    });
}
