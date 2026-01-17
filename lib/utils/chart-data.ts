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
  return stats.map(stat => ({
    date: stat.date,
    value: stat[metric] as number,
    label: new Date(stat.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  }));
}

export function aggregateByPeriod(
  data: ChartDataPoint[],
  period: 'day' | 'week' | 'month'
): ChartDataPoint[] {
  const grouped = new Map<string, number[]>();
  
  data.forEach(point => {
    const date = new Date(point.date);
    let key: string;
    
    if (period === 'week') {
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      key = weekStart.toISOString().split('T')[0];
    } else if (period === 'month') {
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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
    label: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
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