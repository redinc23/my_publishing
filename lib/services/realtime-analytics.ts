
import { createClient } from '@/lib/supabase/client';

interface RealtimeEvent {
  type: 'view' | 'read' | 'purchase' | 'download';
  bookId: string;
  userId?: string;
  sessionId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  timestamp: string;
}

export class RealtimeAnalytics {
  private supabase;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private channel: any;
  private subscribers: Map<string, ((event: RealtimeEvent) => void)[]> = new Map();

  constructor() {
    this.supabase = createClient();
  }

  async connect() {
    this.channel = this.supabase.channel('analytics-realtime')
      .on('broadcast', { event: 'analytics_event' }, (payload) => {
        this.notifySubscribers(payload.payload);
      })
      .subscribe();

    return this.channel;
  }

  subscribe(bookId: string, callback: (event: RealtimeEvent) => void) {
    if (!this.subscribers.has(bookId)) {
      this.subscribers.set(bookId, []);
    }
    this.subscribers.get(bookId)!.push(callback);

    return () => this.unsubscribe(bookId, callback);
  }

  private unsubscribe(bookId: string, callback: (event: RealtimeEvent) => void) {
    const callbacks = this.subscribers.get(bookId);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) callbacks.splice(index, 1);
    }
  }

  private notifySubscribers(event: RealtimeEvent) {
    const callbacks = this.subscribers.get(event.bookId);
    if (callbacks) {
      callbacks.forEach(callback => callback(event));
    }
  }

  async broadcastEvent(event: RealtimeEvent) {
    if (this.channel) {
      await this.channel.send({
        type: 'broadcast',
        event: 'analytics_event',
        payload: event,
      });
    }
  }

  disconnect() {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
    }
  }
}

// Singleton instance
export const realtimeAnalytics = new RealtimeAnalytics();