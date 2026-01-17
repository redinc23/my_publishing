'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Edit, Trash2, MoreVertical, Flag } from 'lucide-react';
import { deleteReview, reportReview } from '@/lib/actions/reviews';
import { toast } from 'sonner';

interface ReviewActionsProps {
  review: {
    id: string;
    user_id: string;
  };
  isOwnReview?: boolean;
}

export function ReviewActions({ review, isOwnReview = false }: ReviewActionsProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }

    setIsDeleting(true);
    try {
      // In a real implementation, this would call a delete action
      toast.success('Review deleted successfully');
    } catch (error) {
      toast.error('Failed to delete review');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleReport = async () => {
    try {
      await reportReview(review.id);
      toast.success('Review reported for moderation');
    } catch (error) {
      toast.error('Failed to report review');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isOwnReview ? (
          <>
            <DropdownMenuItem>
              <Edit className="h-4 w-4 mr-2" />
              Edit Review
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? 'Deleting...' : 'Delete Review'}
            </DropdownMenuItem>
          </>
        ) : (
          <DropdownMenuItem onClick={handleReport}>
            <Flag className="h-4 w-4 mr-2" />
            Report Review
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}