import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppBaseUrl } from '@/lib/app-url';
import { isSubscriptionActive } from '@/lib/attendance-days';
import { jsonError } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { initializePaystackTransaction } from '@/lib/paystack';
import {
  DEFAULT_PLAN_PRICES_KOBO,
  discountAmount,
} from '@/lib/subscriptions';

const schema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sessionToken: z.string().min(20).max(200).optional(),
  email: z.email().optional(),
  plan: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  discountCode: z.string().trim().max(40).optional()
});

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function getErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : 'unknown';
}

export async function POST(request: Request) {
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return jsonError('Enter your username, a pass plan, and a valid email address.', 400);
  }

  const now = new Date();
  try {
    const session = input.sessionToken
      ? await prisma.attendanceSession.findUnique({
          where: { tokenHash: hash(input.sessionToken) }
        })
      : await prisma.attendanceSession.findFirst({
          where: { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          orderBy: { createdAt: 'desc' }
        });
    if (!session || !session.active || session.startsAt > now || (session.endsAt && session.endsAt <= now)) {
      return jsonError('No active attendance session. Please scan the current attendance QR code.', 410);
    }
    if (!process.env.PAYSTACK_SECRET_KEY) {
      return jsonError('Online payments are not configured. Please contact staff.', 503);
    }
    let callbackUrl: string;
    try {
      callbackUrl = `${getAppBaseUrl(request.url)}/api/subscriptions/callback`;
    } catch {
      return jsonError('Online payments are not configured. Please contact staff.', 503);
    }

    const person = await prisma.person.findUnique({ where: { username: input.username } });
    if (!person || !person.active || person.category !== 'SUBSCRIBER') {
      return jsonError('An active, registered subscriber account is required to purchase a pass.', 403);
    }
    if (isSubscriptionActive(
      person.subscriptionStartDate,
      person.subscriptionExpiryDate,
      now,
      person.subscriptionStartsAt,
      person.subscriptionExpiresAt
    )) {
      return jsonError('Your subscriber pass is already active. Return to check-in.', 409);
    }

    const email = input.email ?? person.email;
    if (!email) return jsonError('Enter an email address to continue to Paystack.', 400);

    const savedPrice = await prisma.subscriptionPlanPrice.findUnique({
      where: { plan: input.plan }
    });
    const baseAmountKobo = savedPrice?.amountKobo ?? DEFAULT_PLAN_PRICES_KOBO[input.plan];
    let discountId: string | null = null;
    let discountKobo = 0;
    if (input.discountCode) {
      const discount = await prisma.subscriberDiscount.findUnique({
        where: { code: input.discountCode.toUpperCase() }
      });
      if (
        !discount ||
        !discount.active ||
        (discount.plan && discount.plan !== input.plan) ||
        (discount.startsAt && discount.startsAt > now) ||
        (discount.expiresAt && discount.expiresAt <= now)
      ) {
        return jsonError('That discount code is not valid for this pass.', 400);
      }
      discountKobo = discountAmount(baseAmountKobo, discount.amountKobo);
      if (discountKobo >= baseAmountKobo) {
        return jsonError('The discount must be less than the pass price.', 400);
      }
      discountId = discount.id;
    }

    const reference = randomUUID();
    const payment = await prisma.subscriptionPayment.create({
      data: {
        reference,
        personId: person.id,
        sessionId: session.id,
        plan: input.plan,
        currency: 'NGN',
        baseAmountKobo,
        discountKobo,
        amountKobo: baseAmountKobo - discountKobo,
        discountId,
        discountCode: input.discountCode?.toUpperCase() ?? null
      }
    });

    try {
      const authorizationUrl = await initializePaystackTransaction({
        amountKobo: payment.amountKobo,
        callbackUrl,
        email,
        reference,
        metadata: {
          paymentId: payment.id,
          personId: person.id,
          plan: payment.plan
        }
      });
      return NextResponse.json({
        authorizationUrl,
        reference: payment.reference,
        amountNgn: payment.amountKobo / 100
      }, { status: 201 });
    } catch (error) {
      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' }
      });
      console.error('Paystack checkout initialization failed:', getErrorCode(error));
      return jsonError('Could not start the Paystack payment. Please try again.', 502);
    }
  } catch (error) {
    console.error('Subscriber checkout failed:', getErrorCode(error));
    return jsonError('Could not prepare your subscriber payment. Please try again.', 500);
  }
}
