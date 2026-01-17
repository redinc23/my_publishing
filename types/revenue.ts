export type Currency = 'usd' | 'eur' | 'gbp' | 'cad' | 'aud';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type PayoutStatus = 'pending' | 'processing' | 'paid' | 'failed';

export interface BookSale {
  id: string;
  book_id: string;
  user_id: string;
  
  amount: number;
  currency: Currency;
  
  stripe_payment_intent_id: string;
  stripe_customer_id?: string;
  
  base_price: number;
  discount_amount: number;
  tax_amount: number;
  
  platform_fee: number;
  author_earnings: number;
  
  status: PaymentStatus;
  refund_reason?: string;
  
  purchased_at: string;
  created_at: string;
  updated_at: string;
}

export interface AuthorPayout {
  id: string;
  author_id: string;
  stripe_connected_account_id: string;
  
  period_start_date: string;
  period_end_date: string;
  
  total_earnings: number;
  platform_fee: number;
  net_amount: number;
  
  status: PayoutStatus;
  stripe_payout_id?: string;
  
  paid_at?: string;
  failure_reason?: string;
  
  created_at: string;
  updated_at: string;
}

export interface PayoutItem {
  id: string;
  payout_id: string;
  sale_id: string;
  book_id: string;
  
  amount: number;
  fee: number;
  
  created_at: string;
}

export interface BookPricing {
  id: string;
  book_id: string;
  
  base_price: number;
  currency: Currency;
  
  regional_prices: Array<{
    country_code: string;
    price: number;
    currency: Currency;
  }>;
  
  discount_percentage?: number;
  discount_until?: string;
  
  is_free: boolean;
  allow_pay_what_you_want: boolean;
  minimum_price?: number;
  
  created_at: string;
  updated_at: string;
}