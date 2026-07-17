/* eslint-disable */
'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  ThumbsUp,
  ThumbsDown,
  MessageCircle,
  Flag,
  MoreVertical,
  Star,
  AlertTriangle,
  User,
  Book,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { voteOnReview, reportReview } from '@/lib/actions/reviews';
import { formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StarRating } from './StarRating';
import { toast } from 'sonner';

interface ReviewCardProps {
  review: {
    id: string;
    rating: number;
    title?: string;
    content: string;
    is_spoiler: boolean;
    helpful_count: number;
    created_at: string;
    updated_at: string;
    user_vote?: boolean | null;
  };
  user: {
    id: string;
    username: string;
    avatar_url?: string;
    full_name?: string;
  };
  book?: {
    id: string;
    title: string;
    cover_url?: string;
  };
  compact?: boolean;
  showBookInfo?: boolean;
  onVoteChange?: () => void;
}

export function ReviewCard({
  review,
  user,
  book,
  compact = false,
  showBookInfo = false,
  onVoteChange,
}: ReviewCardProps) {
  const [helpfulCount, setHelpfulCount] = useState(review.helpful_count);
  const [userVote, setUserVote] = useState<boolean | null>(review.user_vote || null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSpoiler, setShowSpoiler] = useState(!review.is_spoiler);
  const [isReported, setIsReported] = useState(false);

  const handleVote = async (helpful: boolean) => {
    if (isLoading) return;

    setIsLoading(true);
    try {
      const newVoteState = userVote === helpful ? null : helpful;

      // Optimistic update
      const delta =
        newVoteState === null
          ? userVote
            ? -1
            : 0 // Removing vote
          : userVote === null
            ? helpful
              ? 1
              : 0
            : helpful
              ? 0
              : -1; // Changing vote

      setHelpfulCount((prev) => Math.max(0, prev + delta));
      setUserVote(newVoteState);

      await voteOnReview(review.id, newVoteState);
      onVoteChange?.();
    } catch (error) {
      toast.error('Failed to submit vote');
      // Revert optimistic update
      setHelpfulCount(review.helpful_count);
      setUserVote(review.user_vote || null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReport = async () => {
    try {
      await reportReview(review.id);
      setIsReported(true);
      toast.success('Review reported for moderation');
    } catch (error) {
      toast.error('Failed to report review');
    }
  };

  const renderUserAvatar = () => (
    <Link href={`/users/${user.id}`} className="flex-shrink-0 transition-opacity hover:opacity-80">
      <div className="relative">
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={`Avatar for ${user.full_name || user.username}`}
            width={compact ? 32 : 40}
            height={compact ? 32 : 40}
            className="rounded-full border-2 border-white shadow-sm"
          />
        ) : (
          <div
            className={cn(
              'flex items-center justify-center rounded-full border-2 border-white bg-gradient-to-br from-blue-100 to-purple-100 shadow-sm',
              compact ? 'h-8 w-8' : 'h-10 w-10'
            )}
          >
            <User
              className={cn('text-blue-600', compact ? 'h-4 w-4' : 'h-5 w-5')}
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </Link>
  );

  const renderBookInfo = () => (
    <Link
      href={`/books/${book?.id}`}
      className="flex items-center gap-2 rounded-lg bg-gray-50 p-2 transition-colors hover:bg-gray-100"
    >
      {book?.cover_url ? (
        <Image
          src={book.cover_url}
          alt={`Cover of ${book.title}`}
          width={40}
          height={60}
          className="rounded object-cover"
        />
      ) : (
        <div className="flex h-12 w-10 items-center justify-center rounded bg-gradient-to-br from-gray-200 to-gray-300">
          <Book className="h-5 w-5 text-gray-500" aria-hidden="true" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{book?.title}</p>
        <p className="text-xs text-gray-500">Book Review</p>
      </div>
    </Link>
  );

  return (
    <article
      className={cn(
        'rounded-lg border bg-white p-4 transition-all hover:shadow-sm',
        compact ? 'p-3' : 'p-4'
      )}
    >
      {/* Header */}
      <div className="mb-3 flex gap-3">
        {renderUserAvatar()}

        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between">
            <div>
              <Link
                href={`/users/${user.id}`}
                className="font-medium text-gray-900 transition-colors hover:text-blue-600"
              >
                {user.full_name || user.username}
              </Link>
              <span className="ml-2 text-sm text-gray-500">
                {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
              </span>
              {review.updated_at !== review.created_at && (
                <span className="ml-2 text-xs text-gray-400">(edited)</span>
              )}
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Review actions">
                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleReport} disabled={isReported}>
                  <Flag className="mr-2 h-4 w-4" aria-hidden="true" />
                  {isReported ? 'Reported' : 'Report Review'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <StarRating rating={review.rating} size={compact ? 'sm' : 'md'} />
        </div>
      </div>

      {/* Book info (optional) */}
      {showBookInfo && book && renderBookInfo()}

      {/* Review Title */}
      {review.title && <h3 className="mb-2 text-lg font-semibold text-gray-900">{review.title}</h3>}

      {/* Spoiler Warning */}
      {review.is_spoiler && !showSpoiler && (
        <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3">
          <div className="mb-2 flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            <span className="font-medium">Spoiler Alert</span>
          </div>
          <p className="mb-3 text-sm text-yellow-700">
            This review contains spoilers for the book.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSpoiler(true)}
            className="border-yellow-300 text-yellow-700 hover:bg-yellow-100"
          >
            Show Review Anyway
          </Button>
        </div>
      )}

      {/* Review Content */}
      <div
        className={cn(
          'prose prose-sm mb-4 max-w-none',
          !showSpoiler && review.is_spoiler && 'select-none blur-sm'
        )}
      >
        <p className="whitespace-pre-wrap text-gray-700">{review.content}</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t pt-3">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleVote(true)}
              disabled={isLoading}
              className={cn('h-8 px-2', userVote === true && 'bg-blue-50 text-blue-600')}
            >
              <ThumbsUp className="mr-1 h-4 w-4" />
              <span className="font-medium">{helpfulCount}</span>
            </Button>

            {!compact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote(false)}
                disabled={isLoading}
                className={cn('h-8 px-2', userVote === false && 'bg-gray-100 text-gray-600')}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            )}
          </div>

          {!compact && (
            <Button variant="ghost" size="sm" className="h-8">
              <MessageCircle className="mr-1 h-4 w-4" />
              Comment
            </Button>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {review.is_spoiler && (
            <Badge variant="outline" className="border-yellow-200 bg-yellow-50 text-yellow-700">
              Spoiler
            </Badge>
          )}
          {review.helpful_count > 10 && (
            <Badge variant="secondary" className="bg-green-50 text-green-700">
              Helpful
            </Badge>
          )}
        </div>
      </div>
    </article>
  );
}
