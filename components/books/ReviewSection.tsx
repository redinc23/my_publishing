/* eslint-disable */
'use client';

import { useState } from 'react';
import { ReviewCard } from './ReviewCard';
import { ReviewForm } from './ReviewForm';
import { ReviewFilters } from './ReviewFilters';
import { ReviewStats } from './ReviewStats';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, BarChart3, TrendingUp, Filter, PlusCircle } from 'lucide-react';
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
  isAuthenticated = false,
}: ReviewSectionProps) {
  const [reviews, setReviews] = useState(initialReviews);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sortBy, setSortBy] = useState<'recent' | 'helpful' | 'highest' | 'lowest'>('helpful');
  const [filterSpoilers, setFilterSpoilers] = useState(true);

  const hasUserReviewed = !!userReview;
  const visibleReviews = reviews
    .filter((review) => !filterSpoilers || !review.is_spoiler)
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case 'highest':
          return b.rating - a.rating;
        case 'lowest':
          return a.rating - b.rating;
        case 'helpful':
        default:
          return (b.helpful_count || 0) - (a.helpful_count || 0);
      }
    });

  const handleReviewSubmit = () => {
    setShowReviewForm(false);
    // Refresh reviews
    window.location.reload();
  };

  const renderEmptyState = () => (
    <div className="py-12 text-center">
      <MessageSquare className="mx-auto mb-4 h-12 w-12 text-gray-300" />
      <h3 className="mb-2 text-lg font-semibold text-gray-900">No Reviews Yet</h3>
      <p className="mx-auto mb-6 max-w-md text-gray-600">
        Be the first to share your thoughts about this book!
      </p>
      {isAuthenticated && !hasUserReviewed && (
        <Button onClick={() => setShowReviewForm(true)}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Write First Review
        </Button>
      )}
    </div>
  );

  const renderReviewStats = () => (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Reviews</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setFilterSpoilers(!filterSpoilers)}>
            <Filter className="mr-2 h-4 w-4" />
            {filterSpoilers ? 'Show Spoilers' : 'Hide Spoilers'}
          </Button>
          {isAuthenticated && (
            <Button
              variant={hasUserReviewed ? 'outline' : 'default'}
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
            <MessageSquare className="h-4 w-4" />
            All Reviews ({totalReviews})
          </TabsTrigger>
          <TabsTrigger value="helpful" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Most Helpful
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
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

          {visibleReviews.length === 0 ? (
            renderEmptyState()
          ) : (
            <div className="space-y-6">
              {visibleReviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  user={review.user}
                  book={{ id: bookId, title: '', cover_url: '' }}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="helpful">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-6">
            <h3 className="mb-2 text-lg font-semibold text-blue-900">Most Helpful Reviews</h3>
            <p className="mb-4 text-blue-700">
              These reviews have been voted most helpful by the community.
            </p>
            {/* Add helpful reviews list */}
          </div>
        </TabsContent>

        <TabsContent value="stats">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-6">
              <h4 className="mb-3 font-semibold">Rating Distribution</h4>
              {/* Add rating distribution chart */}
            </div>
            <div className="rounded-lg bg-gray-50 p-6">
              <h4 className="mb-3 font-semibold">Review Trends</h4>
              {/* Add review timeline chart */}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
