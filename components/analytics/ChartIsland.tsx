// PERF-PHASE2-4
'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';

const ChartFallback = () => <Skeleton className="h-64 w-full" />;

// PERF-PHASE2-4 — Dynamic imports with ssr: false to keep charts out of the main bundle
const AnalyticsOverview = dynamic(() => import('./AnalyticsOverview').then(m => ({ default: m.AnalyticsOverview })), { ssr: false, loading: ChartFallback });
const ViewsChart = dynamic(() => import('./ViewsChart').then(m => ({ default: m.ViewsChart })), { ssr: false, loading: ChartFallback });
const LiveReaders = dynamic(() => import('./LiveReaders'), { ssr: false, loading: ChartFallback });
const GeographyMap = dynamic(() => import('./GeographyMap').then(m => ({ default: m.GeographyMap })), { ssr: false, loading: ChartFallback });
const EngagementHeatmap = dynamic(() => import('./EngagementHeatmap').then(m => ({ default: m.EngagementHeatmap })), { ssr: false, loading: ChartFallback });
const RevenueStats = dynamic(() => import('./RevenueStats').then(m => ({ default: m.RevenueStats })), { ssr: false, loading: ChartFallback });
const AIInsightsPanel = dynamic(() => import('./AIInsightsPanel'), { ssr: false, loading: ChartFallback });

export {
  AnalyticsOverview,
  ViewsChart,
  LiveReaders,
  GeographyMap,
  EngagementHeatmap,
  RevenueStats,
  AIInsightsPanel,
};
