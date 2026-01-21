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
  Book
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { voteOnReview, reportReview } from '@/lib/actions/reviews';
import { formatDistanceToNow } from 'date-fns';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
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
  onVoteChange 
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
      const delta = newVoteState === null 
        ? (userVote ? -1 : 0) // Removing vote
        : (userVote === null ? (helpful ? 1 : 0) : (helpful ? 0 : -1)); // Changing vote
      
      setHelpfulCount(prev => Math.max(0, prev + delta));
      setUserVote(newVoteState);
      
      await voteOnReview(review.id, helpful);
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
    <Link 
      href={`/users/${user.id}`}
      className="flex-shrink-0 hover:opacity-80 transition-opacity"
    >
      <div className="relative">
        {user.avatar_url ? (
          <Image
            src={user.avatar_url}
            alt={user.username}
            width={compact ? 32 : 40}
            height={compact ? 32 : 40}
            className="rounded-full border-2 border-white shadow-sm"
          />
        ) : (
          <div className={cn(
            'rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center border-2 border-white shadow-sm',
            compact ? 'w-8 h-8' : 'w-10 h-10'
          )}>
            <User className={cn(
              'text-blue-600',
              compact ? 'w-4 h-4' : 'w-5 h-5'
            )} />
          </div>
        )}
      </div>
    </Link>
  );

  const renderBookInfo = () => (
    <Link 
      href={`/books/${book?.id}`}
      className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
    >
      {book?.cover_url ? (
        <Image
          src={book.cover_url}
          alt={book.title}
          width={40}
          height={60}
          className="rounded object-cover"
        />
      ) : (
        <div className="w-10 h-12 bg-gradient-to-br from-gray-200 to-gray-300 rounded flex items-center justify-center">
          <Book className="w-5 h-5 text-gray-500" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {book?.title}
        </p>
        <p className="text-xs text-gray-500">Book Review</p>
      </div>
    </Link>
  );

  return (
    <article className={cn(
      'bg-white border rounded-lg p-4 transition-all hover:shadow-sm',
      compact ? 'p-3' : 'p-4'
    )}>
      {/* Header */}
      <div className="flex gap-3 mb-3">
        {renderUserAvatar()}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <div>
              <Link 
                href={`/users/${user.id}`}
                className="font-medium text-gray-900 hover:text-blue-600 transition-colors"
              >
                {user.full_name || user.username}
              </Link>
              <span className="text-gray-500 text-sm ml-2">
                {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
              </span>
              {review.updated_at !== review.created_at && (
                <span className="text-gray-400 text-xs ml-2">
                  (edited)
                </span>
              )}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleReport} disabled={isReported}>
                  <Flag className="h-4 w-4 mr-2" />
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
      {review.title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {review.title}
        </h3>
      )}

      {/* Spoiler Warning */}
      {review.is_spoiler && !showSpoiler && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-800 mb-2">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">Spoiler Alert</span>
          </div>
          <p className="text-sm text-yellow-700 mb-3">
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
      <div className={cn(
        'prose prose-sm max-w-none mb-4',
        !showSpoiler && review.is_spoiler && 'blur-sm select-none'
      )}>
        <p className="whitespace-pre-wrap text-gray-700">
          {review.content}
        </p>
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
              className={cn(
                'h-8 px-2',
                userVote === true && 'text-blue-600 bg-blue-50'
              )}
            >
              <ThumbsUp className="h-4 w-4 mr-1" />
              <span className="font-medium">{helpfulCount}</span>
            </Button>
            
            {!compact && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleVote(false)}
                disabled={isLoading}
                className={cn(
                  'h-8 px-2',
                  userVote === false && 'text-gray-600 bg-gray-100'
                )}
              >
                <ThumbsDown className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          {!compact && (
            <Button variant="ghost" size="sm" className="h-8">
              <MessageCircle className="h-4 w-4 mr-1" />
              Comment
            </Button>
          )}
        </div>

        {/* Status Badges */}
        <div className="flex items-center gap-2">
          {review.is_spoiler && (
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
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
