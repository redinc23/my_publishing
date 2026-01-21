/* eslint-disable */
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AnalyticsOverview } from './AnalyticsOverview';
import { ViewsChart } from './ViewsChart';
import LiveReaders from './LiveReaders';
import { GeographyMap } from './GeographyMap';
import { EngagementHeatmap } from './EngagementHeatmap';
import { RevenueStats } from './RevenueStats';
import AIInsightsPanel from './AIInsightsPanel';
import { dateRanges, type DateRange } from '@/lib/utils/date-ranges';
import { getBookAnalytics, getEngagementHeatmap, getGeographyData } from '@/lib/actions/analytics';
import type { BookStats, HeatmapData, GeographyData } from '@/types/analytics';
import { Skeleton } from '@/components/ui/skeleton';

interface AnalyticsDashboardProps {
  bookId: string;
}

export default function AnalyticsDashboard({ bookId }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>(dateRanges.last30Days());
  const [stats, setStats] = useState<BookStats[]>([]);
  const [heatmap, setHeatmap] = useState<HeatmapData[]>([]);
  const [geography, setGeography] = useState<GeographyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [bookId, dateRange]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [statsData, heatmapData, geographyData] = await Promise.all([
        getBookAnalytics(bookId, dateRange),
        getEngagementHeatmap(bookId),
        getGeographyData(bookId, dateRange),
      ]);

      setStats(statsData);
      setHeatmap(heatmapData);
      setGeography(geographyData);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Track your book's performance and reader engagement
          </p>
        </div>
      </div>

      <AnalyticsOverview
        bookId={bookId}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
      />

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="readers">Readers</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="revenue">Revenue</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ViewsChart stats={stats} />
            <LiveReaders bookId={bookId} />
          </div>
          <GeographyMap data={geography} />
          <AIInsightsPanel
            bookId={bookId}
            dateRange={dateRange}
            stats={stats}
            heatmap={heatmap}
          />
        </TabsContent>

        <TabsContent value="readers" className="space-y-6">
          <LiveReaders bookId={bookId} />
          <GeographyMap data={geography} />
        </TabsContent>

        <TabsContent value="engagement" className="space-y-6">
          <EngagementHeatmap data={heatmap} />
        </TabsContent>

        <TabsContent value="revenue" className="space-y-6">
          <RevenueStats bookId={bookId} dateRange={dateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}