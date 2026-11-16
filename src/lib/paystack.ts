import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getAttendanceDayKey, getAttendanceDayRange } from '@/lib/attendance-days';
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
    return { status: 'success' as const, checkedIn: payment.attendanceRecorded };
  }
  if (payment.status === 'FAILED') {
    return { status: 'failed' as const, checkedIn: false };
  }

  const verified = await verifyPaystackTransaction(reference);
  if (verified.reference !== reference) throw new Error('Paystack reference did not match.');
  if (verified.status !== 'success') {
    if (verified.status === 'failed' || verified.status === 'abandoned') {
      await prisma.subscriptionPayment.updateMany({
        where: { id: payment.id, status: 'PENDING' },
        data: { status: 'FAILED' }
      });
      return { status: 'failed' as const, checkedIn: false };
    }
    return { status: 'pending' as const, checkedIn: false };
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
        select: { status: true, attendanceRecorded: true }
      });
      return {
        status: current.status === 'SUCCESS' ? 'success' as const : 'failed' as const,
        checkedIn: current.attendanceRecorded
      };
    }

    const person = await transaction.person.findUniqueOrThrow({
      where: { id: payment.personId },
      select: {
        active: true,
        category: true,
        subscriptionExpiryDate: true,
        subscriptionExpiresAt: true
      }
    });
    if (person.category !== 'SUBSCRIBER') throw new Error('Payment user is not a subscriber.');

    const start = getSubscriptionBaseDate(person.subscriptionExpiryDate, person.subscriptionExpiresAt, paidAt);
    const expiry = getSubscriptionExpiry(start, payment.plan);
    await transaction.person.update({
      where: { id: payment.personId },
      data: {
        subscriptionPlan: payment.plan,
        ...getSubscriptionDateFields(start, expiry),
        subscriptionStartsAt: start,
        subscriptionExpiresAt: expiry
      }
    });
    if (payment.discountId) {
      await transaction.subscriberDiscount.update({
        where: { id: payment.discountId },
        data: { redemptionCount: { increment: 1 } }
      });
    }

    let checkedIn = false;
    const now = new Date();
    const session = await transaction.attendanceSession.findUnique({
      where: { id: payment.sessionId }
    });
    if (
      person.active &&
      start <= now &&
      now < expiry &&
      session?.active &&
      session.startsAt <= now &&
      (session.endsAt === null || session.endsAt > now)
    ) {
      const day = getAttendanceDayKey(now);
      const dayRange = getAttendanceDayRange(now);
      const dailySession = await transaction.attendanceSession.upsert({
        where: { tokenHash: createDailySessionToken(day) },
        update: {},
        create: {
          tokenHash: createDailySessionToken(day),
          title: `${session.title} (${day})`,
          active: false,
          startsAt: now,
          endsAt: dayRange.end
        }
      });
      await transaction.attendance.upsert({
        where: {
          personId_sessionId: { personId: payment.personId, sessionId: dailySession.id }
        },
        update: {},
        create: { personId: payment.personId, sessionId: dailySession.id }
      });
      checkedIn = true;
    }

    await transaction.subscriptionPayment.update({
      where: { id: payment.id },
      data: { attendanceRecorded: checkedIn }
    });
    return { status: 'success' as const, checkedIn };
  }).catch(error => {
    console.error('Subscription payment finalization failed:', getDatabaseErrorCode(error));
    throw error;
  });
}

function createDailySessionToken(day: string) {
  return createHash('sha256').update(`daily:${day}`).digest('hex');
}
