import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ReviewCard } from '@/components/books/ReviewCard';
import { Pagination } from '@/components/ui/pagination';
import { ReviewFilters } from '@/components/books/ReviewFilters';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Star,
  TrendingUp,
  Calendar,
  Filter
} from 'lucide-react';

interface UserReviewsPageProps {
  params: {
    userId: string;
  };
  searchParams: {
    page?: string;
    sort?: string;
  };
}

export default async function UserReviewsPage({ 
  params, 
  searchParams 
}: UserReviewsPageProps) {
  const supabase = await createClient();
  const { userId } = params;
  const page = parseInt(searchParams.page || '1');
  const sort = searchParams.sort || 'recent';
  const limit = 10;
  
  // Get user info
  const { data: user } = await supabase
    .from('users')
    .select('id, username, full_name, avatar_url')
    .eq('id', userId)
    .single();
    
  if (!user) {
    notFound();
  }
  
  // Get user's reviews with pagination
  let query = supabase
    .from('reviews')
    .select(`
      *,
      book:books (
        id,
        title,
        cover_url,
        author:users (
          username,
          full_name
        )
      )
    `, { count: 'exact' })
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
    console.error('Error fetching reviews:', error);
    notFound();
  }
  
  // Get review stats
  const { data: stats } = await supabase
    .from('reviews')
    .select('rating, helpful_count')
    .eq('user_id', userId)
    .eq('is_public', true);
    
  const averageRating = stats?.length 
    ? stats.reduce((acc, r) => acc + r.rating, 0) / stats.length 
    : 0;
  const totalHelpfulVotes = stats?.reduce((acc, r) => acc + r.helpful_count, 0) || 0;
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {user.full_name || user.username}'s Reviews
            </h1>
            <p className="text-gray-600 mt-2">
              {count || 0} reviews • Average rating: {averageRating.toFixed(1)}/5
            </p>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Star className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {averageRating.toFixed(1)}
                </p>
                <p className="text-sm text-gray-600">Average Rating</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {totalHelpfulVotes}
                </p>
                <p className="text-sm text-gray-600">Helpful Votes</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Calendar className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900">
                  {count || 0}
                </p>
                <p className="text-sm text-gray-600">Total Reviews</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Filters */}
      <div className="mb-6 bg-white border rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <Tabs defaultValue={sort} className="w-full md:w-auto">
            <TabsList>
              <TabsTrigger value="recent" className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Most Recent
              </TabsTrigger>
              <TabsTrigger value="rating" className="flex items-center gap-2">
                <Star className="w-4 h-4" />
                Highest Rated
              </TabsTrigger>
              <TabsTrigger value="helpful" className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Most Helpful
              </TabsTrigger>
            </TabsList>
          </Tabs>
          
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
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
              <ReviewCard
                key={review.id}
                review={review}
                user={user}
                book={review.book}
                showBookInfo
              />
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
          <div className="text-center py-12 bg-white border rounded-lg">
            <Star className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Reviews Yet
            </h3>
            <p className="text-gray-600">
              This user hasn't written any reviews yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
