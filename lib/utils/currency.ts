export type Currency = 'usd' | 'eur' | 'gbp' | 'cad' | 'aud';

const currencySymbols: Record<Currency, string> = {
  usd: '$',
  eur: '€',
  gbp: '£',
  cad: 'C$',
  aud: 'A$',
};

const currencyFormatters: Record<Currency, Intl.NumberFormat> = {
  usd: new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }),
  eur: new Intl.NumberFormat('en-EU', { style: 'currency', currency: 'EUR' }),
  gbp: new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }),
  cad: new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }),
  aud: new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }),
};

export function formatCurrency(amount: number, currency: Currency = 'usd'): string {
  // Amount is in cents, convert to dollars
  const dollars = amount / 100;
  return currencyFormatters[currency].format(dollars);
}

export function formatCurrencyCompact(amount: number, currency: Currency = 'usd'): string {
  const dollars = amount / 100;
  const symbol = currencySymbols[currency];
  
  if (dollars >= 1000000) {
    return `${symbol}${(dollars / 1000000).toFixed(1)}M`;
  }
  if (dollars >= 1000) {
    return `${symbol}${(dollars / 1000).toFixed(1)}K`;
  }
  
  return formatCurrency(amount, currency);
}

export function parseCurrency(value: string, currency: Currency = 'usd'): number {
  // Remove currency symbols and parse
  const cleaned = value.replace(/[^0-9.-]/g, '');
  const dollars = parseFloat(cleaned) || 0;
  return Math.round(dollars * 100); // Convert to cents
}