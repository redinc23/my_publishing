import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/admin';
import { handleStripeWebhook } from '@/lib/stripe/webhooks';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 400 });
    }

    const event = await handleStripeWebhook(body, signature);

    const supabase = createClient();

    // Handle different event types
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const metadata = session.metadata;

      if (metadata?.book_id && metadata?.user_id) {
        // Create order
        const orderNumber = `ORD-${Date.now()}`;
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            order_number: orderNumber,
            user_id: metadata.user_id,
            total_amount: session.amount_total / 100, // Convert from cents
            status: 'completed',
            payment_intent_id: session.payment_intent,
          })
          .select()
          .single();

        if (!orderError && order) {
          // Create order item
          await supabase.from('order_items').insert({
            order_id: order.id,
            book_id: metadata.book_id,
            unit_price: session.amount_total / 100,
            license_key: `LIC-${Date.now()}-${metadata.user_id}`,
          });
        }
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 400 });
  }
}
