import { NextResponse } from 'next/server';
import { completeSubscriptionPayment, isValidPaystackSignature } from '@/lib/paystack';

function getErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : 'unknown';
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    if (!isValidPaystackSignature(rawBody, request.headers.get('x-paystack-signature'))) {
      return NextResponse.json({ error: 'Invalid webhook signature.' }, { status: 401 });
    }
  } catch (error) {
    console.error('Paystack webhook configuration error:', getErrorCode(error));
    return NextResponse.json({ error: 'Webhook verification is not configured.' }, { status: 503 });
  }

  let event: { event?: unknown; data?: { reference?: unknown } };
  try {
    event = JSON.parse(rawBody) as typeof event;
  } catch {
    return NextResponse.json({ error: 'Invalid webhook payload.' }, { status: 400 });
  }
  if (event.event !== 'charge.success') return NextResponse.json({ received: true });
  if (typeof event.data?.reference !== 'string') {
    return NextResponse.json({ error: 'Webhook reference is missing.' }, { status: 400 });
  }

  try {
    const result = await completeSubscriptionPayment(event.data.reference);
    if (result.status === 'pending') {
      return NextResponse.json({ error: 'Payment verification is still pending.' }, { status: 503 });
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Paystack webhook processing failed:', getErrorCode(error));
    return NextResponse.json({ error: 'Could not verify the payment.' }, { status: 500 });
  }
}
