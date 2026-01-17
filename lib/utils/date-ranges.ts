import { startOfDay, endOfDay, subDays, subWeeks, subMonths, startOfWeek, startOfMonth } from 'date-fns';

export interface DateRange {
  from?: Date;
  to?: Date;
}

export const dateRanges = {
  today: (): DateRange => ({
    from: startOfDay(new Date()),
    to: endOfDay(new Date()),
  }),
  
  yesterday: (): DateRange => {
    const yesterday = subDays(new Date(), 1);
    return {
      from: startOfDay(yesterday),
      to: endOfDay(yesterday),
    };
  },
  
  last7Days: (): DateRange => ({
    from: startOfDay(subDays(new Date(), 7)),
    to: endOfDay(new Date()),
  }),
  
  last30Days: (): DateRange => ({
    from: startOfDay(subDays(new Date(), 30)),
    to: endOfDay(new Date()),
  }),
  
  thisWeek: (): DateRange => ({
    from: startOfWeek(new Date(), { weekStartsOn: 1 }),
    to: endOfDay(new Date()),
  }),
  
  thisMonth: (): DateRange => ({
    from: startOfMonth(new Date()),
    to: endOfDay(new Date()),
  }),
  
  lastMonth: (): DateRange => {
    const lastMonth = subMonths(new Date(), 1);
    return {
      from: startOfMonth(lastMonth),
      to: endOfDay(startOfMonth(new Date())),
    };
  },
  
  last90Days: (): DateRange => ({
    from: startOfDay(subDays(new Date(), 90)),
    to: endOfDay(new Date()),
  }),
  
  lastYear: (): DateRange => ({
    from: startOfDay(subDays(new Date(), 365)),
    to: endOfDay(new Date()),
  }),
  
  custom: (from: Date, to: Date): DateRange => ({
    from: startOfDay(from),
    to: endOfDay(to),
  }),
};

export function formatDateRange(range: DateRange): string {
  if (!range.from || !range.to) return 'All time';
  
  const fromStr = range.from.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const toStr = range.to.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  
  return `${fromStr} - ${toStr}`;
}