'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { 
  MessageSquare,
  Star,
  ThumbsUp,
  UserPlus,
  BookOpen,
  RefreshCw,
  MoreHorizontal
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  type: 'review' | 'comment' | 'vote' | 'follow' | 'reading_update';
  user: {
    id: string;
    username: string;
    avatar_url?: string;
  };
  target?: {
    id: string;
    type: 'book' | 'review' | 'user';
    title?: string;
    name?: string;
  };
  metadata?: {
    rating?: number;
    status?: string;
    book_title?: string;
  };
  created_at: string;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  compact?: boolean;
  showFilters?: boolean;
  maxItems?: number;
}

export function ActivityFeed({ 
  activities, 
  compact = false, 
  showFilters = true,
  maxItems = 20 
}: ActivityFeedProps) {
  const [filter, setFilter] = useState<string>('all');
  const [visibleItems, setVisibleItems] = useState(maxItems);

  const filteredActivities = activities.filter(activity => {
    if (filter === 'all') return true;
    return activity.type === filter;
  });

  const visibleActivities = filteredActivities.slice(0, visibleItems);

  const getActivityIcon = (type: string) => {
    const icons = {
      review: Star,
      comment: MessageSquare,
      vote: ThumbsUp,
      follow: UserPlus,
      reading_update: BookOpen
    };
    
    const Icon = icons[type as keyof typeof icons] || MessageSquare;
    return <Icon className="w-4 h-4" />;
  };

  const getActivityColor = (type: string) => {
    const colors = {
      review: 'text-yellow-600 bg-yellow-50 border-yellow-200',
      comment: 'text-blue-600 bg-blue-50 border-blue-200',
      vote: 'text-green-600 bg-green-50 border-green-200',
      follow: 'text-purple-600 bg-purple-50 border-purple-200',
      reading_update: 'text-orange-600 bg-orange-50 border-orange-200'
    };
    
    return colors[type as keyof typeof colors] || 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getActivityText = (activity: ActivityItem) => {
    const userLink = (
      <Link 
        href={`/users/${activity.user.id}`}
        className="font-medium hover:text-blue-600"
      >
        {activity.user.username}
      </Link>
    );

    const targetLink = activity.target ? (
      <Link 
        href={`/${activity.target.type}s/${activity.target.id}`}
        className="font-medium hover:text-blue-600"
      >
        {activity.target.title || activity.target.name}
      </Link>
    ) : null;

    const metadata = activity.metadata;

    switch (activity.type) {
      case 'review':
        return (
          <>
            {userLink} reviewed {targetLink} 
            {metadata?.rating && (
              <span className="ml-1">
                with {metadata.rating}★
              </span>
            )}
          </>
        );
      case 'comment':
        return <>{userLink} commented on {targetLink}</>;
      case 'vote':
        return <>{userLink} found a review helpful</>;
      case 'follow':
        return <>{userLink} started following {targetLink}</>;
      case 'reading_update':
        return (
          <>
            {userLink} {metadata?.status === 'read' ? 'finished reading' : 'started reading'} 
            {metadata?.book_title && (
              <span className="font-medium ml-1">{metadata.book_title}</span>
            )}
          </>
        );
      default:
        return <>{userLink} performed an activity</>;
    }
  };

  const renderActivityItem = (activity: ActivityItem) => (
    <div 
      key={activity.id}
      className={cn(
        'flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors group',
        compact && 'p-2'
      )}
    >
      {/* User Avatar */}
      <Link href={`/users/${activity.user.id}`} className="flex-shrink-0">
        <div className={cn(
          'relative rounded-full border-2 border-white shadow-sm',
          compact ? 'w-8 h-8' : 'w-10 h-10'
        )}>
          {activity.user.avatar_url ? (
            <Image
              src={activity.user.avatar_url}
              alt={activity.user.username}
              fill
              className="rounded-full object-cover"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
              <span className="font-bold text-blue-600">
                {activity.user.username.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>
      </Link>

      {/* Activity Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <Badge 
            variant="outline" 
            className={cn(
              'text-xs font-normal',
              getActivityColor(activity.type)
            )}
          >
            <span className="flex items-center gap-1">
              {getActivityIcon(activity.type)}
              {activity.type.replace('_', ' ')}
            </span>
          </Badge>
          <span className="text-xs text-gray-500">
            {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
          </span>
        </div>
        
        <p className="text-sm text-gray-700">
          {getActivityText(activity)}
        </p>
      </div>
    </div>
  );

  return (
    <div className={cn(
      'bg-white border rounded-lg',
      !compact && 'p-6'
    )}>
      {!compact && (
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold">Recent Activity</h2>
          <Button variant="ghost" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      )}

      {showFilters && (
        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="grid grid-cols-5">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="review">Reviews</TabsTrigger>
            <TabsTrigger value="reading_update">Reading</TabsTrigger>
            <TabsTrigger value="comment">Comments</TabsTrigger>
            <TabsTrigger value="follow">Follows</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {visibleActivities.length > 0 ? (
        <div className="space-y-1">
          {visibleActivities.map(renderActivityItem)}
          
          {visibleItems < filteredActivities.length && (
            <div className="pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVisibleItems(prev => prev + 10)}
                className="w-full"
              >
                Load More Activities
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12">
          <MessageSquare className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No activities to show</p>
        </div>
      )}
    </div>
  );
}
