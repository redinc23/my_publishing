/* eslint-disable */
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, TrendingUp } from 'lucide-react';
import { getBookRevenue } from '@/lib/actions/revenue';
import { formatCurrency } from '@/lib/utils/currency';
import { useEffect, useState } from 'react';
import type { DateRange } from '@/types/analytics';
import type { BookSale } from '@/types/revenue';
import { Skeleton } from '@/components/ui/skeleton';

interface RevenueStatsProps {
  bookId: string;
  dateRange: DateRange;
}

export function RevenueStats({ bookId, dateRange }: RevenueStatsProps) {
  const [revenue, setRevenue] = useState<{ total: number; sales: BookSale[] }>({ total: 0, sales: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRevenue();
  }, [bookId, dateRange]);

  const loadRevenue = async () => {
    setLoading(true);
    try {
      const data = await getBookRevenue(bookId, dateRange);
      setRevenue(data);
    } catch (error) {
      console.error('Error loading revenue:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Skeleton className="h-64 w-full" />;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          <CardTitle>Revenue Statistics</CardTitle>
        </div>
        <CardDescription>Earnings and sales breakdown</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <div className="text-sm text-muted-foreground">Total Revenue</div>
              <div className="text-3xl font-bold">{formatCurrency(revenue.total * 100)}</div>
            </div>
            <TrendingUp className="h-8 w-8 text-green-500" />
          </div>

          <div className="text-sm text-muted-foreground">
            {revenue.sales.length} sales in selected period
          </div>
        </div>
      </CardContent>
    </Card>
  );
}