import Stripe from 'stripe';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const stripe = process.env.STRIPE_SECRET_KEY 
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2026-01-28.clover' })
  : null;

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: 'Stripe is not configured on this server.' }, { status: 500 });
  }
  try {
    const body = await request.json();
    const { leadId, customerEmail, customerName } = body;
    
    // Ensure amount is a clean number, defaulting to 0 if invalid
    const amount = parseFloat(body.amount) || 0;

    if (amount <= 0) {
      return NextResponse.json({ error: 'Job total must be greater than $0 to process card payment.' }, { status: 400 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://clearviewllc.vercel.app';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Service for ${customerName || 'Valued Customer'}`,
              description: `Job Ref: ${leadId}`,
            },
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      customer_email: customerEmail,
      metadata: {
        leadId: leadId,
      },
      success_url: `${baseUrl}/admin/payment-success?session_id={CHECKOUT_SESSION_ID}&leadId=${leadId}`,
      cancel_url: `${baseUrl}/admin/dashboard`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe Checkout Session creation failed:', error);
    return NextResponse.json({ error: error.message || 'Check your Stripe Secret Key configuration.' }, { status: 500 });
  }
}
