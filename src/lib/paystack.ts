import { prisma } from '@/lib/prisma';
import { verifyPaystackSignature } from '@/lib/paystack-signature';
import {
  getSubscriptionBaseDate,
  getSubscriptionDateFields,
  getSubscriptionExpiry
} from '@/lib/subscriptions';

type PaystackVerification = {
  status: boolean;
  data?: {
    amount?: number;
    currency?: string;
    paid_at?: string | null;
    reference?: string;
    status?: string;
  };
};

function getSecretKey() {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not configured.');
  return key;
}

export async function initializePaystackTransaction(input: {
  amountKobo: number;
  callbackUrl: string;
  email: string;
  metadata: Record<string, string>;
  reference: string;
}) {
  const response = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getSecretKey()}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      currency: 'NGN',
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000)
  });
  const result = await response.json().catch(() => null) as {
    status?: boolean;
    data?: { authorization_url?: string; reference?: string };
  } | null;
  if (!response.ok || !result?.status || !result.data?.authorization_url || result.data.reference !== input.reference) {
    throw new Error('Paystack could not initialize the transaction.');
  }
  return result.data.authorization_url;
}

export function isValidPaystackSignature(rawBody: string, signature: string | null) {
  return verifyPaystackSignature(rawBody, signature, getSecretKey());
}

async function verifyPaystackTransaction(reference: string) {
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: { Authorization: `Bearer ${getSecretKey()}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000)
    }
  );
  const result = await response.json().catch(() => null) as PaystackVerification | null;
  if (!response.ok || !result?.status || !result.data) {
    throw new Error('Paystack transaction verification failed.');
  }
  return result.data;
}

function getDatabaseErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : 'unknown';
}

export async function completeSubscriptionPayment(reference: string) {
  const payment = await prisma.subscriptionPayment.findUnique({ where: { reference } });
  if (!payment) throw new Error('Subscription payment not found.');
  if (payment.status === 'SUCCESS') {
    return { status: 'success' as const, category: payment.category };
  }
  if (payment.status === 'FAILED') {
    return { status: 'failed' as const, category: payment.category };
  }

  const verified = await verifyPaystackTransaction(reference);
  if (verified.reference !== reference) throw new Error('Paystack reference did not match.');
  if (verified.status !== 'success') {
    if (verified.status === 'failed' || verified.status === 'abandoned') {
      await prisma.subscriptionPayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED' }
      });
      return { status: 'failed' as const, category: payment.category };
    }
    return { status: 'pending' as const, category: payment.category };
  }
  if (verified.amount !== payment.amountKobo || verified.currency !== payment.currency) {
    throw new Error('Paystack payment amount or currency did not match.');
  }

  const verifiedPaidAt = verified.paid_at ? new Date(verified.paid_at) : new Date();
  const paidAt = Number.isNaN(verifiedPaidAt.getTime()) ? new Date() : verifiedPaidAt;

  return prisma.$transaction(async transaction => {
    const claimed = await transaction.subscriptionPayment.updateMany({
      where: { id: payment.id, status: 'PENDING' },
      data: { status: 'SUCCESS', paidAt }
    });
    if (claimed.count === 0) {
      const current = await transaction.subscriptionPayment.findUniqueOrThrow({
        where: { id: payment.id },
        select: { status: true }
      });
      return {
        status: current.status === 'SUCCESS' ? 'success' as const : 'failed' as const,
        category: payment.category
      };
    }

    const person = await transaction.person.findUniqueOrThrow({
      where: { id: payment.personId },
      select: {
        category: true,
        subscriptionStartDate: true,
        subscriptionExpiryDate: true,
        subscriptionStartsAt: true,
        subscriptionExpiresAt: true,
        studentAccessStartsAt: true,
        studentAccessExpiresAt: true
      }
    });
    let start: Date;
    let expiry: Date;
    if (payment.category === 'SUBSCRIBER' && person.category === 'SUBSCRIBER' && payment.plan) {
      start = getSubscriptionBaseDate(person.subscriptionExpiryDate, person.subscriptionExpiresAt, paidAt);
      expiry = getSubscriptionExpiry(start, payment.plan);
      await transaction.person.update({
        where: { id: payment.personId },
        data: {
          subscriptionPlan: payment.plan,
          ...getSubscriptionDateFields(start, expiry),
          subscriptionStartsAt: start,
          subscriptionExpiresAt: expiry
        }
      });
    } else if (payment.category === 'STUDENT' && person.category === 'STUDENT') {
      start = getSubscriptionBaseDate(null, person.studentAccessExpiresAt, paidAt);
      expiry = new Date(start.getTime() + payment.durationDays * 24 * 60 * 60 * 1000);
      await transaction.person.update({
        where: { id: payment.personId },
        data: { studentAccessStartsAt: start, studentAccessExpiresAt: expiry }
      });
    } else {
      throw new Error('Payment category does not match the user account.');
    }
    if (payment.discountId) {
      await transaction.subscriberDiscount.update({
        where: { id: payment.discountId },
        data: { redemptionCount: { increment: 1 } }
      });
    }

    return { status: 'success' as const, category: payment.category };
  }).catch(error => {
    console.error('Subscription payment finalization failed:', getDatabaseErrorCode(error));
    throw error;
  });
}
