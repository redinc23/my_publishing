'use client';

import type { AnalyticsEventType } from '@/types/analytics';

interface TrackEvent {
  book_id: string;
  event_type: AnalyticsEventType;
  session_id: string;
  event_data?: Record<string, any>;
  chapter_id?: string;
  chapter_number?: number;
  reading_progress?: number;
  time_spent?: number;
}

class AnalyticsTracker {
  private sessionId: string;
  private deviceId: string;
  private queue: TrackEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.sessionId = this.getOrCreateSessionId();
    this.deviceId = this.getOrCreateDeviceId();
    this.startFlushInterval();
  }

  private getOrCreateSessionId(): string {
    if (typeof window === 'undefined') return '';
    
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
  }

  private getOrCreateDeviceId(): string {
    if (typeof window === 'undefined') return '';
    
    let deviceId = localStorage.getItem('analytics_device_id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('analytics_device_id', deviceId);
    }
    return deviceId;
  }

  private startFlushInterval() {
    if (typeof window === 'undefined') return;
    
    this.flushInterval = setInterval(() => {
      this.flush();
    }, 10000); // Flush every 10 seconds
  }

  trackView(bookId: string, data?: Record<string, any>) {
    this.queue.push({
      book_id: bookId,
      event_type: 'view',
      session_id: this.sessionId,
      event_data: data,
    });
    
    this.flush(); // Immediate flush for views
  }

  trackRead(
    bookId: string,
    chapterId: string,
    chapterNumber: number,
    progress: number,
    timeSpent: number
  ) {
    this.queue.push({
      book_id: bookId,
      event_type: 'read',
      session_id: this.sessionId,
      chapter_id: chapterId,
      chapter_number: chapterNumber,
      reading_progress: progress,
      time_spent: timeSpent,
    });
  }

  trackPurchase(bookId: string, data?: Record<string, any>) {
    this.queue.push({
      book_id: bookId,
      event_type: 'purchase',
      session_id: this.sessionId,
      event_data: data,
    });
    
    this.flush(); // Immediate flush for purchases
  }

  trackDownload(bookId: string, data?: Record<string, any>) {
    this.queue.push({
      book_id: bookId,
      event_type: 'download',
      session_id: this.sessionId,
      event_data: data,
    });
    
    this.flush(); // Immediate flush for downloads
  }

  trackShare(bookId: string, platform: string) {
    this.queue.push({
      book_id: bookId,
      event_type: 'share',
      session_id: this.sessionId,
      event_data: { platform },
    });
    
    this.flush(); // Immediate flush for shares
  }

  private async flush() {
    if (this.queue.length === 0) return;
    
    const events = [...this.queue];
    this.queue = [];

    try {
      await fetch('/api/analytics/track', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events }),
      });
    } catch (error) {
      console.error('Failed to track analytics:', error);
      // Re-queue events on failure
      this.queue.unshift(...events);
    }
  }

  destroy() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flush(); // Final flush
  }
}

export const analyticsTracker = new AnalyticsTracker();

// Convenience functions
export const trackView = (bookId: string, data?: Record<string, any>) => {
  analyticsTracker.trackView(bookId, data);
};

export const trackRead = (
  bookId: string,
  chapterId: string,
  chapterNumber: number,
  progress: number,
  timeSpent: number
) => {
  analyticsTracker.trackRead(bookId, chapterId, chapterNumber, progress, timeSpent);
};

export const trackPurchase = (bookId: string, data?: Record<string, any>) => {
  analyticsTracker.trackPurchase(bookId, data);
};

export const trackDownload = (bookId: string, data?: Record<string, any>) => {
  analyticsTracker.trackDownload(bookId, data);
};

export const trackShare = (bookId: string, platform: string) => {
  analyticsTracker.trackShare(bookId, platform);
};