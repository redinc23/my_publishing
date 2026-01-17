/**
 * Resonance Engine types
 */

export interface ResonanceRecommendation {
  book_id: string;
  score: number;
  algorithm: 'vector_similarity' | 'collaborative' | 'trending' | 'featured';
  metadata?: Record<string, unknown>;
}

export interface ResonanceRequest {
  user_id?: string;
  limit?: number;
  genre?: string;
  exclude_book_ids?: string[];
}

export interface ResonanceResponse {
  data: ResonanceRecommendation[];
  meta: {
    algorithm: string;
    user_id?: string;
    total_results: number;
  };
}

export interface EngagementEvent {
  user_id?: string;
  book_id: string;
  event_type: 'view' | 'purchase' | 'read' | 'rating' | 'share' | 'wishlist';
  event_value?: Record<string, unknown>;
}

export interface ViralCoefficient {
  book_id: string;
  coefficient: number;
  factors: {
    shares: number;
    purchases: number;
    reads: number;
    ratings: number;
  };
}
