/* eslint-disable */
'use client';

import { useState } from 'react';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';
import { ReviewFilters } from './ReviewFilters';
import { ReviewStats } from './ReviewStats';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  MessageSquare,
  BarChart3,
  TrendingUp,
  Filter,
  PlusCircle
} from 'lucide-react';
interface ReviewSectionProps {
  bookId: string;
  initialReviews: any[];
  averageRating: number;
  totalReviews: number;
  ratingDistribution: Record<number, number>;
  userReview?: any;
  isAuthenticated?: boolean;
}

export function ReviewSection({
  bookId,
  initialReviews,
  averageRating,
  totalReviews,
  ratingDistribution,
  userReview,
  isAuthenticated = false
}: ReviewSectionProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'helpful' | 'highest' | 'lowest'>('helpful');
  const [filterSpoilers, setFilterSpoilers] = useState(true);
  
  const hasUserReviewed = !!userReview;

  const handleReviewSubmit = () => {
    setShowReviewForm(false);
    // Note: Ideally, the parent component should handle review refetching
    // using SWR/React Query or by passing a refresh callback prop.
    // For now, we avoid the expensive full page reload.
  };

  const renderEmptyState = () => (
    <div className="text-center py-12">
      <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 mb-2">
        No Reviews Yet
      </h3>
      <p className="text-gray-600 mb-6 max-w-md mx-auto">
        Be the first to share your thoughts about this book!
      </p>
      {isAuthenticated && !hasUserReviewed && (
        <Button onClick={() => setShowReviewForm(true)}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Write First Review
        </Button>
      )}
    </div>
  );

  const renderReviewStats = () => (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Reviews</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterSpoilers(!filterSpoilers)}
          >
            <Filter className="w-4 h-4 mr-2" />
            {filterSpoilers ? 'Show Spoilers' : 'Hide Spoilers'}
          </Button>
          {isAuthenticated && (
            <Button
              variant={hasUserReviewed ? "outline" : "default"}
              size="sm"
              onClick={() => setShowReviewForm(true)}
            >
              {hasUserReviewed ? 'Edit Your Review' : 'Write a Review'}
            </Button>
          )}
        </div>
      </div>
      
      <ReviewStats
        averageRating={averageRating}
        totalReviews={totalReviews}
        ratingDistribution={ratingDistribution}
      />
    </div>
  );

  return (
    <section className="py-8">
      {renderReviewStats()}

      <Tabs defaultValue="reviews" className="mb-8">
        <TabsList className="mb-6">
          <TabsTrigger value="reviews" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            All Reviews ({totalReviews})
          </TabsTrigger>
          <TabsTrigger value="helpful" className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Most Helpful
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Statistics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-6">
          <ReviewFilters
            sortBy={sortBy}
            onSortChange={setSortBy}
            filterSpoilers={filterSpoilers}
            onFilterSpoilersChange={setFilterSpoilers}
          />
          
          {showReviewForm && (
            <div className="mb-6">
              <ReviewForm
                bookId={bookId}
                existingReview={userReview}
                onClose={() => setShowReviewForm(false)}
              />
            </div>
          )}

          {reviews.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="space-y-6">
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  user={review.user}
                  book={{ id: bookId, title: '', cover_url: '' }}
                />
              ))}
              
              {reviews.length < totalReviews && (
                <div className="text-center pt-6">
                  <Button variant="outline" size="lg">
                    Load More Reviews
                  </Button>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="helpful">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-2">
              Most Helpful Reviews
            </h3>
            <p className="text-blue-700 mb-4">
              These reviews have been voted most helpful by the community.
            </p>
            {/* Add helpful reviews list */}
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="font-semibold mb-3">Rating Distribution</h4>
              {/* Add rating distribution chart */}
            </div>
            <div className="bg-gray-50 rounded-lg p-6">
              <h4 className="font-semibold mb-3">Review Trends</h4>
              {/* Add review timeline chart */}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
