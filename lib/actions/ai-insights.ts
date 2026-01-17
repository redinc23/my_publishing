'use server';

import { aiInsightsService } from '@/lib/services/ai-insights';
import type { BookStats, HeatmapData } from '@/types/analytics';

export async function getAIInsights(
  bookId: string,
  stats: BookStats[],
  heatmap: HeatmapData[]
) {
  try {
    return await aiInsightsService.generateInsights(bookId, stats, heatmap);
  } catch (error) {
    console.error('Error generating AI insights:', error);
    return {
      performance: { trends: { views: 0, readers: 0, revenue: 0 }, patterns: [], bestPerformingDay: null, worstPerformingDay: null },
      engagement: { engagementZones: [], dropOffPoints: [], retentionRate: 0, suggestedImprovements: [] },
      recommendations: [],
      predictions: null,
    };
  }
}