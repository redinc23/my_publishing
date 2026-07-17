/* eslint-disable */
import { notFound } from 'next/navigation';
import { createClient as createAdminClient } from '@/lib/supabase/admin';
import { ReviewCard } from '@/components/books/ReviewCard';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Star, TrendingUp, Calendar, Filter } from 'lucide-react';

interface UserReviewsPageProps {
  params: {
    userId: string;
  };
  searchParams: {
    page?: string;
    sort?: string;
  };
}

export default async function UserReviewsPage({ params, searchParams }: UserReviewsPageProps) {
  const admin = createAdminClient();
  const { userId } = params;
  const page = parseInt(searchParams.page || '1');
  const sort = searchParams.sort || 'recent';
  const limit = 10;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId)) {
    notFound();
  }

  // Get user info
  const { data: profile } = await admin
    .from('profiles')
    .select('user_id, full_name')
    .eq('user_id', userId)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const publicUser = {
    id: profile.user_id,
    username: profile.full_name || 'Reader',
    full_name: profile.full_name || undefined,
  };

  // Get user's reviews with pagination
  let query = admin
    .from('reviews')
    .select(
      `
      id,
      book_id,
      user_id,
      rating,
      title,
      content,
      is_spoiler,
      is_public,
      helpful_count,
      created_at,
      updated_at,
      book:books (
        id,
        slug,
        title,
        cover_url
      )
    `,
      { count: 'exact' }
    )
    .eq('user_id', userId)
    .eq('is_public', true);

  // Apply sorting
  switch (sort) {
    case 'recent':
      query = query.order('created_at', { ascending: false });
      break;
    case 'rating':
      query = query.order('rating', { ascending: false });
      break;
    case 'helpful':
      query = query.order('helpful_count', { ascending: false });
      break;
  }

  // Pagination
  const from = (page - 1) * limit;
  const to = from + limit - 1;
  query = query.range(from, to);

  const { data: reviews, error, count } = await query;

  if (error) {
    console.error('Error fetching public reviews:', error);
    notFound();
  }

  // Get review stats
  const { data: stats } = await admin
    .from('reviews')
    .select('rating, helpful_count')
    .eq('user_id', userId)
    .eq('is_public', true);

  const averageRating = stats?.length
    ? stats.reduce((acc, r) => acc + r.rating, 0) / stats.length
    : 0;
  const totalHelpfulVotes = stats?.reduce((acc, r) => acc + r.helpful_count, 0) || 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {publicUser.full_name || publicUser.username}&apos;s Reviews
            </h1>
            <p className="mt-2 text-gray-600">
              {count || 0} reviews • Average rating: {averageRating.toFixed(1)}/5
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2">
                <Star className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{averageRating.toFixed(1)}</p>
                <p className="text-sm text-gray-600">Average Rating</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-green-100 p-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalHelpfulVotes}</p>
                <p className="text-sm text-gray-600">Helpful Votes</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-100 p-2">
                <Calendar className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">{count || 0}</p>
                <p className="text-sm text-gray-600">Total Reviews</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-lg border bg-white p-4">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <Tabs defaultValue={sort} className="w-full md:w-auto">
            <TabsList>
              <TabsTrigger value="recent" className="flex items-center gap-2" asChild>
                <a href={`/users/${userId}/reviews?sort=recent`}>
                <Calendar className="h-4 w-4" />
                Most Recent
                </a>
              </TabsTrigger>
              <TabsTrigger value="rating" className="flex items-center gap-2" asChild>
                <a href={`/users/${userId}/reviews?sort=rating`}>
                <Star className="h-4 w-4" />
                Highest Rated
                </a>
              </TabsTrigger>
              <TabsTrigger value="helpful" className="flex items-center gap-2" asChild>
                <a href={`/users/${userId}/reviews?sort=helpful`}>
                <TrendingUp className="h-4 w-4" />
                Most Helpful
                </a>
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">Filter by:</span>
            {/* Add filter options */}
          </div>
        </div>
      </div>

      {/* Reviews */}
      <div className="space-y-6">
        {reviews && reviews.length > 0 ? (
          <>
            {reviews.map((review) => (
              <div key={review.id}>
                {(() => {
                  const book = Array.isArray(review.book) ? review.book[0] : review.book;
                  return (
                    <ReviewCard
                      review={review}
                      user={publicUser}
                      book={
                        book
                          ? { id: book.slug || book.id, title: book.title, cover_url: book.cover_url }
                          : undefined
                      }
                      showBookInfo
                    />
                  );
                })()}
              </div>
            ))}

            {/* Pagination */}
            {count && count > limit && (
              <div className="mt-8">
                <Pagination
                  currentPage={page}
                  totalPages={Math.ceil(count / limit)}
                  basePath={`/users/${userId}/reviews`}
                  queryParams={{ sort }}
                />
              </div>
            )}
          </>
        ) : (
          <div className="rounded-lg border bg-white py-12 text-center">
            <Star className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h3 className="mb-2 text-lg font-semibold text-gray-900">No Reviews Yet</h3>
            <p className="text-gray-600">This user hasn&apos;t written any reviews yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
