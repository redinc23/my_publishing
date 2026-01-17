'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, TrendingUp, Users, Download, DollarSign, Globe } from 'lucide-react';
import { dateRanges, formatDateRange, type DateRange } from '@/lib/utils/date-ranges';
import { formatLargeNumber } from '@/lib/utils/analytics-helpers';
import { formatCurrency } from '@/lib/utils/currency';
import { getBookAnalytics, getLiveReaders } from '@/lib/actions/analytics';
import { getBookRevenue } from '@/lib/actions/revenue';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface AnalyticsOverviewProps {
  bookId: string;
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export function AnalyticsOverview({
  bookId,
  dateRange,
  onDateRangeChange
}: AnalyticsOverviewProps) {
  const [stats, setStats] = useState({
    totalViews: 0,
    uniqueReaders: 0,
    totalDownloads: 0,
    completionRate: 0,
    avgReadTime: 0,
    revenue: 0,
    countriesReached: 0,
    growthRate: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOverview();
  }, [bookId, dateRange]);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const [analytics, readers, revenue] = await Promise.all([
        getBookAnalytics(bookId, dateRange),
        getLiveReaders(bookId),
        getBookRevenue(bookId, dateRange),
      ]);

      const totalViews = analytics.reduce((sum, day) => sum + day.views, 0);
      const uniqueReaders = analytics.reduce((sum, day) => sum + day.unique_users, 0);
      const totalDownloads = analytics.reduce((sum, day) => sum + day.downloads, 0);
      const avgCompletionRate = analytics.length > 0
        ? analytics.reduce((sum, day) => sum + day.completion_rate, 0) / analytics.length
        : 0;
      const avgReadTime = analytics.length > 0
        ? analytics.reduce((sum, day) => sum + day.avg_read_time, 0) / analytics.length
        : 0;

      setStats({
        totalViews,
        uniqueReaders,
        totalDownloads,
        completionRate: avgCompletionRate,
        avgReadTime,
        revenue: revenue.total * 100, // Convert to cents for formatCurrency
        countriesReached: 0, // TODO: Calculate from geography data
        growthRate: 0, // TODO: Calculate growth rate
      });
    } catch (error) {
      console.error('Error loading overview:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          <span className="text-sm font-medium">{formatDateRange(dateRange)}</span>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateRangeChange(dateRanges.last7Days())}
          >
            7D
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateRangeChange(dateRanges.last30Days())}
          >
            30D
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateRangeChange(dateRanges.last90Days())}
          >
            90D
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Views</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(stats.totalViews)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.growthRate > 0 ? '+' : ''}{stats.growthRate}% from last period
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unique Readers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(stats.uniqueReaders)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.completionRate.toFixed(1)}% completion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatLargeNumber(stats.totalDownloads)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round(stats.avgReadTime / 60)}m avg read time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.revenue * 100)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.countriesReached} countries reached
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}