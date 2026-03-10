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
    const { amount, customerEmail, contactName, serviceType } = body;

    if (!amount || typeof amount !== 'number') {
      return NextResponse.json({ error: 'Invalid amount provided' }, { status: 400 });
    }

    // Convert amount to cents (Stripe expects amount in the smallest currency unit)
    const amountInCents = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      metadata: { 
        customerEmail,
        contactName,
        serviceType,
        depositAmount: amount,
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Stripe PaymentIntent creation failed:', error);
    return NextResponse.json({ error: 'Failed to create PaymentIntent' }, { status: 500 });
  }
}
