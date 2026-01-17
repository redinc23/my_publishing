'use server';

import { createClient } from '@/lib/supabase/server';
import Stripe from 'stripe';
import type { AuthorPayout } from '@/types/revenue';

function getStripeInstance() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16',
  });
}

const payoutRequests = new Map<string, { count: number; lastRequest: number }>();

export async function getPayoutStatus(): Promise<AuthorPayout[]> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) throw new Error('Not authenticated');

    const { data: payouts, error } = await supabase
      .from('author_payouts')
      .select('*')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return payouts || [];
  } catch (error) {
    console.error('Error fetching payout status:', error);
    return [];
  }
}

export async function requestPayout(): Promise<{
  success: boolean;
  payoutId?: string;
  amount?: number;
  error?: string;
  requiresReview?: boolean;
}> {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Rate limiting: max 3 payout requests per hour
    const userId = user.id;
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    
    const userRequests = payoutRequests.get(userId) || { count: 0, lastRequest: 0 };
    
    if (userRequests.lastRequest > oneHourAgo && userRequests.count >= 3) {
      return {
        success: false,
        error: 'Too many payout requests. Please try again in an hour.',
      };
    }

    payoutRequests.set(userId, {
      count: userRequests.lastRequest > oneHourAgo ? userRequests.count + 1 : 1,
      lastRequest: now,
    });

    // Check if user has a connected Stripe account
    const { data: author } = await supabase
      .from('users')
      .select('stripe_connected_account_id, email')
      .eq('id', user.id)
      .single();

    if (!author?.stripe_connected_account_id) {
      return {
        success: false,
        error: 'Please connect your Stripe account to receive payouts',
      };
    }

    // Calculate pending earnings
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: pendingSales, error: salesError } = await supabase
      .from('book_sales')
      .select('id, amount, author_earnings, platform_fee, book_id, purchased_at, user_id, status')
      .eq('status', 'completed')
      .gte('purchased_at', thirtyDaysAgo.toISOString())
      .order('purchased_at', { ascending: false });

    if (salesError) throw salesError;

    const totalEarnings = pendingSales?.reduce((sum, sale) => sum + sale.author_earnings, 0) || 0;
    const totalFees = pendingSales?.reduce((sum, sale) => sum + sale.platform_fee, 0) || 0;
    const netAmount = totalEarnings - totalFees;

    const MINIMUM_PAYOUT = 1000; // $10.00

    if (netAmount < MINIMUM_PAYOUT) {
      return {
        success: false,
        error: `Minimum payout amount is $${(MINIMUM_PAYOUT / 100).toFixed(2)}. You have $${(netAmount / 100).toFixed(2)} available.`,
      };
    }

    // Create payout record
    const { data: payout, error: payoutError } = await supabase
      .from('author_payouts')
      .insert({
        author_id: user.id,
        stripe_connected_account_id: author.stripe_connected_account_id,
        period_start_date: thirtyDaysAgo.toISOString().split('T')[0],
        period_end_date: new Date().toISOString().split('T')[0],
        total_earnings: totalEarnings,
        platform_fee: totalFees,
        net_amount: netAmount,
        status: 'processing',
      })
      .select()
      .single();

    if (payoutError) throw payoutError;

    // Process payout via Stripe
    try {
      const stripe = getStripeInstance();
      const transfer = await stripe.transfers.create({
        amount: netAmount,
        currency: 'usd',
        destination: author.stripe_connected_account_id,
        metadata: {
          payout_id: payout.id,
          author_id: user.id,
        },
      });

      await supabase
        .from('author_payouts')
        .update({
          stripe_payout_id: transfer.id,
          status: 'paid',
          paid_at: new Date().toISOString(),
        })
        .eq('id', payout.id);

      return {
        success: true,
        payoutId: payout.id,
        amount: netAmount / 100,
      };
    } catch (stripeError) {
      await supabase
        .from('author_payouts')
        .update({
          status: 'failed',
          failure_reason: stripeError instanceof Error ? stripeError.message : 'Stripe transfer failed',
        })
        .eq('id', payout.id);

      throw stripeError;
    }
  } catch (error) {
    console.error('Error requesting payout:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to process payout',
    };
  }
}