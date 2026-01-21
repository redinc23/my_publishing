/* eslint-disable */
'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getLiveReaders } from '@/lib/actions/analytics';
import { realtimeAnalytics } from '@/lib/services/realtime-analytics';
import type { LiveReader } from '@/types/analytics';

interface LiveReadersProps {
  bookId: string;
}

export default function LiveReaders({ bookId }: LiveReadersProps) {
  const [readers, setReaders] = useState<LiveReader[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalReaders, setTotalReaders] = useState(0);

  useEffect(() => {
    // Initial load
    loadLiveReaders();

    // Connect to real-time updates
    realtimeAnalytics.connect().catch(console.error);

    // Subscribe to real-time events
    const unsubscribe = realtimeAnalytics.subscribe(bookId, (event) => {
      if (event.type === 'read') {
        // Update reader activity
        setReaders(prev => {
          const updated = [...prev];
          const existingIndex = updated.findIndex(r => r.session_id === event.sessionId);

          if (existingIndex > -1) {
            // Update existing reader
            updated[existingIndex] = {
              ...updated[existingIndex],
              last_activity_at: event.timestamp,
              time_in_session: Math.floor(
                (new Date(event.timestamp).getTime() -
                 new Date(updated[existingIndex].created_at).getTime()) / 60000
              ),
              current_chapter: event.data.chapter_title,
              reading_progress: event.data.progress,
            };
          } else {
            // Add new reader
            updated.push({
              id: event.sessionId,
              session_id: event.sessionId,
              book_id: bookId,
              user_id: event.userId,
              current_chapter: event.data.chapter_title,
              reading_progress: event.data.progress,
              total_events: 1,
              total_duration: 0,
              is_active: true,
              last_activity_at: event.timestamp,
              created_at: event.timestamp,
            } as LiveReader);
          }

          // Keep only active readers (last 15 minutes)
          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
          return updated.filter(r => new Date(r.last_activity_at) > fifteenMinutesAgo);
        });

        setTotalReaders(prev => Math.max(prev, readers.length));
      }
    });

    // Refresh every 30 seconds for fallback
    const interval = setInterval(loadLiveReaders, 30000);

    return () => {
      unsubscribe();
      clearInterval(interval);
      realtimeAnalytics.disconnect();
    };
  }, [bookId]);

  const loadLiveReaders = async () => {
    try {
      const data = await getLiveReaders(bookId);
      setReaders(data.readers);
      setTotalReaders(data.total);
      setLoading(false);
    } catch (error) {
      console.error('Error loading live readers:', error);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Live Readers</CardTitle>
          <CardDescription>Currently reading your book</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24 mt-1" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Live Readers</CardTitle>
            <CardDescription>
              {totalReaders} readers currently active
            </CardDescription>
          </div>
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {readers.length > 0 ? (
          <div className="space-y-3">
            {readers.slice(0, 5).map((reader) => (
              <div key={reader.session_id} className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={reader.user?.avatar_url} />
                  <AvatarFallback>
                    {reader.user?.name?.charAt(0) || 'R'}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {reader.user?.name || 'Anonymous Reader'}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {reader.current_chapter || 'Reading'}
                      {reader.reading_progress && ` (${reader.reading_progress}%)`}
                    </span>
                    {reader.time_in_session && (
                      <>
                        <span>•</span>
                        <span>{reader.time_in_session}m active</span>
                      </>
                    )}
                  </div>
                </div>

                <Badge variant="secondary" className="bg-green-100 text-green-700">
                  Active
                </Badge>
              </div>
            ))}

            {readers.length > 5 && (
              <p className="text-xs text-muted-foreground text-center pt-2">
                And {readers.length - 5} more readers...
              </p>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <div className="text-muted-foreground">
              No active readers at the moment
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}