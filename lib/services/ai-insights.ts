
// Note: This service should be called from server actions, not client components
import type { BookStats, HeatmapData } from '@/types/analytics';

export class AIInsightsService {
  constructor() {}

  async generateInsights(bookId: string, stats: BookStats[], heatmap: HeatmapData[]) {
    // Generate AI-powered insights based on analytics data
    const insights = {
      performance: await this.analyzePerformance(stats),
      engagement: await this.analyzeEngagement(heatmap),
      recommendations: await this.generateRecommendations(stats, heatmap),
      predictions: await this.generatePredictions(stats),
    };

    return insights;
  }

  private async analyzePerformance(stats: BookStats[]) {
    const trends = this.calculateTrends(stats);
    const patterns = this.identifyPatterns(stats);

    return {
      trends,
      patterns,
      bestPerformingDay: this.findBestDay(stats),
      worstPerformingDay: this.findWorstDay(stats),
    };
  }

  private async analyzeEngagement(heatmap: HeatmapData[]) {
    const engagementZones = this.identifyEngagementZones(heatmap);
    const dropOffPoints = this.identifyDropOffPoints(heatmap);
    const retentionRate = this.calculateRetentionRate(heatmap);

    return {
      engagementZones,
      dropOffPoints,
      retentionRate,
      suggestedImprovements: this.suggestContentImprovements(heatmap),
    };
  }

  private async generateRecommendations(stats: BookStats[], heatmap: HeatmapData[]) {
    const recommendations = [];

    // Content recommendations based on heatmap
    if (heatmap.length > 0) {
      const highDropOffChapter = heatmap.find(h => h.drop_off_rate > 50);
      if (highDropOffChapter) {
        recommendations.push({
          type: 'content_improvement',
          priority: 'high',
          message: `Chapter ${highDropOffChapter.chapter_number} has a ${highDropOffChapter.drop_off_rate}% drop-off rate. Consider revising this section.`,
          action: `/dashboard/books/${stats[0]?.book_id}/chapters/${highDropOffChapter.chapter_number}/edit`,
        });
      }
    }

    // Marketing recommendations based on stats
    const bestDay = this.findBestDay(stats);
    if (bestDay) {
      recommendations.push({
        type: 'marketing_timing',
        priority: 'medium',
        message: `Your book performs best on ${bestDay}. Schedule promotions around this time.`,
        action: `/dashboard/promotions/schedule`,
      });
    }

    // Pricing recommendations
    const conversionRate = this.calculateConversionRate(stats);
    if (conversionRate < 0.05) {
      recommendations.push({
        type: 'pricing_strategy',
        priority: 'medium',
        message: `Low conversion rate (${(conversionRate * 100).toFixed(1)}%). Consider running a limited-time discount.`,
        action: `/dashboard/books/${stats[0]?.book_id}/pricing`,
      });
    }

    return recommendations;
  }

  private async generatePredictions(stats: BookStats[]) {
    if (stats.length < 7) return null;

    const lastWeek = stats.slice(-7);
    const avgViews = lastWeek.reduce((sum, day) => sum + day.views, 0) / 7;
    const trend = this.calculateTrend(lastWeek.map(d => d.views));

    return {
      nextWeekViews: Math.round(avgViews * (1 + trend)),
      growthProjection: trend * 100,
      revenueForecast: this.forecastRevenue(stats),
      peakPeriod: this.predictPeakPeriod(stats),
    };
  }

  // Helper methods
  private calculateTrends(stats: BookStats[]) {
    // Implementation for trend analysis
    return {
      views: this.calculateTrend(stats.map(s => s.views)),
      readers: this.calculateTrend(stats.map(s => s.unique_users)),
      revenue: this.calculateTrend(stats.map(s => s.purchases * 10)), // Simplified
    };
  }

  private calculateTrend(data: number[]): number {
    if (data.length < 2) return 0;
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    const avg1 = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avg2 = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    return (avg2 - avg1) / avg1;
  }

  private identifyPatterns(stats: BookStats[]) {
    // Identify weekly patterns
    const patterns = [];
    const dayOfWeek = stats.map(s => new Date(s.date).getDay());

    // Check for weekend spikes
    const weekendDays = [0, 6]; // Sunday, Saturday
    const weekendAvg = stats
      .filter((_, i) => weekendDays.includes(dayOfWeek[i]))
      .reduce((sum, s) => sum + s.views, 0) / stats.filter((_, i) => weekendDays.includes(dayOfWeek[i])).length;

    const weekdayAvg = stats
      .filter((_, i) => !weekendDays.includes(dayOfWeek[i]))
      .reduce((sum, s) => sum + s.views, 0) / stats.filter((_, i) => !weekendDays.includes(dayOfWeek[i])).length;

    if (weekendAvg > weekdayAvg * 1.2) {
      patterns.push('weekend_peak');
    }

    return patterns;
  }

  private findBestDay(stats: BookStats[]): string | null {
    if (stats.length === 0) return null;
    const best = stats.reduce((prev, current) =>
      prev.views > current.views ? prev : current
    );
    return new Date(best.date).toLocaleDateString('en-US', { weekday: 'long' });
  }

  private findWorstDay(stats: BookStats[]): string | null {
    if (stats.length === 0) return null;
    const worst = stats.reduce((prev, current) =>
      prev.views < current.views ? prev : current
    );
    return new Date(worst.date).toLocaleDateString('en-US', { weekday: 'long' });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private identifyEngagementZones(heatmap: HeatmapData[]): any[] {
    const zones = [];

    for (let i = 0; i < heatmap.length; i += 3) {
      const chunk = heatmap.slice(i, i + 3);
      const avgDropOff = chunk.reduce((sum, h) => sum + h.drop_off_rate, 0) / chunk.length;

      if (avgDropOff < 20) {
        zones.push({
          chapters: chunk.map(h => h.chapter_number),
          type: 'high_engagement',
          score: 5,
        });
      } else if (avgDropOff > 50) {
        zones.push({
          chapters: chunk.map(h => h.chapter_number),
          type: 'low_engagement',
          score: 1,
        });
      }
    }

    return zones;
  }

  private identifyDropOffPoints(heatmap: HeatmapData[]): number[] {
    const dropOffs = [];
    for (let i = 0; i < heatmap.length - 1; i++) {
      const current = heatmap[i];
      const next = heatmap[i + 1];
      const dropOff = ((current.views - next.views) / current.views) * 100;
      if (dropOff > 30) {
        dropOffs.push(current.chapter_number);
      }
    }
    return dropOffs;
  }

  private calculateRetentionRate(heatmap: HeatmapData[]): number {
    if (heatmap.length === 0) return 0;
    const startViews = heatmap[0].views;
    const endViews = heatmap[heatmap.length - 1].views;
    return startViews > 0 ? (endViews / startViews) * 100 : 0;
  }

  private suggestContentImprovements(heatmap: HeatmapData[]): string[] {
    const suggestions: string[] = [];

    // Find chapters with high drop-off
    const highDropOff = heatmap.filter(h => h.drop_off_rate > 50);
    highDropOff.forEach(chapter => {
      suggestions.push(`Chapter ${chapter.chapter_number} might be too long or complex. Consider breaking it into smaller sections.`);
    });

    // Find chapters with low time spent
    const lowTime = heatmap.filter(h => h.avg_time_spent < 60); // Less than 1 minute
    lowTime.forEach(chapter => {
      suggestions.push(`Readers are skimming Chapter ${chapter.chapter_number}. Add more engaging content or visuals.`);
    });

    return suggestions;
  }

  private calculateConversionRate(stats: BookStats[]): number {
    const totalViews = stats.reduce((sum, day) => sum + day.views, 0);
    const totalPurchases = stats.reduce((sum, day) => sum + day.purchases, 0);
    return totalViews > 0 ? totalPurchases / totalViews : 0;
  }

  private forecastRevenue(stats: BookStats[]): number {
    if (stats.length < 14) return 0;

    const recentRevenue = stats.slice(-14).reduce((sum, day) => sum + (day.purchases * 9.99), 0);
    const dailyAvg = recentRevenue / 14;

    // Simple linear projection
    return dailyAvg * 30; // Next 30 days
  }

  private predictPeakPeriod(stats: BookStats[]): { day: string; hour: number } | null {
    if (stats.length < 7) return null;

    // Simplified - in production, analyze hourly data
    const bestDay = this.findBestDay(stats);

    return {
      day: bestDay || 'Friday',
      hour: 19, // 7 PM based on typical reading patterns
    };
  }
}

export const aiInsightsService = new AIInsightsService();