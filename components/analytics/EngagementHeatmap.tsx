'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { HeatmapData } from '@/types/analytics';

interface EngagementHeatmapProps {
  data: HeatmapData[];
}

export function EngagementHeatmap({ data }: EngagementHeatmapProps) {
  const chartData = data.map(item => ({
    chapter: `Ch ${item.chapter_number}`,
    engagement: item.avg_time_spent || 0,
    dropOff: item.drop_off_rate,
    completions: item.completions,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Chapter Engagement Heatmap</CardTitle>
        <CardDescription>Reader engagement by chapter</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="chapter" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="engagement" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            No engagement data available
          </div>
        )}
      </CardContent>
    </Card>
  );
}