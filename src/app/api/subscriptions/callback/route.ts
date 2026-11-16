import { NextResponse } from 'next/server';
import { getAppBaseUrl } from '@/lib/app-url';
import { completeSubscriptionPayment } from '@/lib/paystack';

function getErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : 'unknown';
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const reference = requestUrl.searchParams.get('reference') ?? '';
  const destination = new URL('/attendance', getAppBaseUrl(request.url));
  if (!/^[0-9a-f-]{36}$/i.test(reference)) {
    destination.searchParams.set('payment', 'failed');
    return NextResponse.redirect(destination);
  }

  try {
    const result = await completeSubscriptionPayment(reference);
    destination.searchParams.set('payment', result.status);
    destination.searchParams.set('category', result.category);
  } catch (error) {
    console.error('Paystack callback verification failed:', getErrorCode(error));
    destination.searchParams.set('payment', 'pending');
  }
  return NextResponse.redirect(destination);
}
