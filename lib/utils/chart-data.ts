import type { BookStats } from '@/types/analytics';

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export function formatChartData(
  stats: BookStats[],
  metric: keyof BookStats
): ChartDataPoint[] {
  // Cache date locale formatter to avoid recreating on each iteration
  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  
  return stats.map(stat => ({
    date: stat.date,
    value: stat[metric] as number,
    label: dateFormatter.format(new Date(stat.date)),
  }));
}

export function aggregateByPeriod(
  data: ChartDataPoint[],
  period: 'day' | 'week' | 'month'
): ChartDataPoint[] {
  const grouped = new Map<string, number[]>();
  // Cache date formatter to avoid recreating on each iteration
  const dateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
  
  data.forEach(point => {
    const date = new Date(point.date);
    let key: string;
    
    if (period === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else if (period === 'month') {
      // Use first day of month for consistent date formatting
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
    } else {
      key = point.date;
    }
    
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(point.value);
  });
  
  return Array.from(grouped.entries()).map(([date, values]) => ({
    date,
    value: values.reduce((sum, val) => sum + val, 0) / values.length,
    label: dateFormatter.format(new Date(date)),
  }));
}

export function generateTimeSeries(
  startDate: Date,
  endDate: Date,
  period: 'day' | 'week' | 'month'
): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    dates.push(current.toISOString().split('T')[0]);
    
    if (period === 'day') {
      current.setDate(current.getDate() + 1);
    } else if (period === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
    }
  }
  
  return dates;
}