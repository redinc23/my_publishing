'use server';

import { createClient } from '@/lib/supabase/server';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

async function updateBookReviewStats(bookId: string) {
  const admin = createAdminClient();
  const { data: reviews, error } = await admin
    .from('reviews')
    .select('rating')
    .eq('book_id', bookId)
    .eq('is_public', true);

  if (error) throw error;

  const total = reviews?.length ?? 0;
  const average = total ? reviews.reduce((sum, review) => sum + review.rating, 0) / total : 0;

  const { error: updateError } = await admin
    .from('books')
    .update({
      average_rating: Number(average.toFixed(2)),
      total_reviews: total,
      review_count: total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bookId);

  if (updateError) throw updateError;
}

async function updateReviewHelpfulCount(reviewId: string) {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from('review_votes')
    .select('review_id', { count: 'exact', head: true })
    .eq('review_id', reviewId)
    .eq('is_helpful', true);

  if (error) throw error;

  const { error: updateError } = await admin
    .from('reviews')
    .update({ helpful_count: count ?? 0 })
    .eq('id', reviewId);

  if (updateError) throw updateError;
}

export async function voteOnReview(reviewId: string, helpful: boolean | null) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to vote');
  }

  const { data: review } = await admin.from('reviews').select('id').eq('id', reviewId).maybeSingle();
  if (!review) {
    throw new Error('Review not found');
  }

  const { error } =
    helpful === null
      ? await admin.from('review_votes').delete().eq('review_id', reviewId).eq('user_id', user.id)
      : await admin
          .from('review_votes')
          .upsert(
            {
              review_id: reviewId,
              user_id: user.id,
              is_helpful: helpful,
            },
            { onConflict: 'review_id,user_id' }
          );

  if (error) {
    throw new Error('Failed to submit vote');
  }

  await updateReviewHelpfulCount(reviewId);
  revalidatePath('/');
  return { success: true };
}

export async function reportReview(reviewId: string) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
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
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to write reviews');
  }

  // Check if user already has a review for this book
  const { data: existingReview } = await admin
    .from('reviews')
    .select('id')
    .eq('user_id', user.id)
    .eq('book_id', reviewData.book_id)
    .single();

  if (existingReview) {
    // Update existing review
    const { error } = await admin
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
    const { error } = await admin.from('reviews').insert({
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

  await updateBookReviewStats(reviewData.book_id);
  revalidatePath('/');
  revalidatePath('/dashboard/my-reviews');
  return { success: true };
}

export async function deleteReview(reviewId: string) {
  const supabase = await createClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error('You must be logged in to delete reviews');
  }

  // Check if the review belongs to the user
  const { data: review } = await admin
    .from('reviews')
    .select('user_id, book_id')
    .eq('id', reviewId)
    .single();

  if (!review || review.user_id !== user.id) {
    throw new Error('You can only delete your own reviews');
  }

  const { error } = await admin.from('reviews').delete().eq('id', reviewId);

  if (error) {
    throw new Error('Failed to delete review');
  }

  await updateBookReviewStats(review.book_id);
  revalidatePath('/dashboard/my-reviews');
  return { success: true };
}
