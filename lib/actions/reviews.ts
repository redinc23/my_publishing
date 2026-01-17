'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function voteOnReview(reviewId: string, helpful: boolean) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to vote');
  }

  const { error } = await supabase
    .from('review_votes')
    .upsert({
      review_id: reviewId,
      user_id: user.id,
      is_helpful: helpful,
    });

  if (error) {
    throw new Error('Failed to submit vote');
  }

  revalidatePath('/');
  return { success: true };
}

export async function reportReview(reviewId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to report reviews');
  }

  // In a real implementation, this would create a moderation report
  console.log(`Review ${reviewId} reported by user ${user.id}`);

  return { success: true };
}

export async function createReview(reviewData: {
  book_id: string;
  rating: number;
  title?: string;
  content: string;
  is_spoiler: boolean;
  is_public: boolean;
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to write reviews');
  }

  // Check if user already has a review for this book
  const { data: existingReview } = await supabase
    .from('reviews')
    .select('id')
    .eq('user_id', user.id)
    .eq('book_id', reviewData.book_id)
    .single();

  if (existingReview) {
    // Update existing review
    const { error } = await supabase
      .from('reviews')
      .update({
        rating: reviewData.rating,
        title: reviewData.title,
        content: reviewData.content,
        is_spoiler: reviewData.is_spoiler,
        is_public: reviewData.is_public,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingReview.id);

    if (error) throw error;
  } else {
    // Create new review
    const { error } = await supabase
      .from('reviews')
      .insert({
        user_id: user.id,
        book_id: reviewData.book_id,
        rating: reviewData.rating,
        title: reviewData.title,
        content: reviewData.content,
        is_spoiler: reviewData.is_spoiler,
        is_public: reviewData.is_public,
      });

    if (error) throw error;
  }

  revalidatePath('/');
  return { success: true };
}

export async function deleteReview(reviewId: string) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to delete reviews');
  }

  // Check if the review belongs to the user
  const { data: review } = await supabase
    .from('reviews')
    .select('user_id')
    .eq('id', reviewId)
    .single();

  if (!review || review.user_id !== user.id) {
    throw new Error('You can only delete your own reviews');
  }

  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (error) {
    throw new Error('Failed to delete review');
  }

  revalidatePath('/dashboard/my-reviews');
  return { success: true };
}