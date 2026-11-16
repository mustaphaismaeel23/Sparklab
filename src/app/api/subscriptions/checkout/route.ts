import { createHash, randomUUID } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAppBaseUrl } from '@/lib/app-url';
import { jsonError } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { initializePaystackTransaction } from '@/lib/paystack';
import {
  DEFAULT_PLAN_PRICES_KOBO,
  DEFAULT_STUDENT_MONTHLY_PRICE_KOBO,
  discountAmount
} from '@/lib/subscriptions';

const schema = z.object({
  username: z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  sessionToken: z.string().min(20).max(200).optional(),
  email: z.email().optional(),
  plan: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
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
    if (!person || !person.active || (person.category !== 'SUBSCRIBER' && person.category !== 'STUDENT')) {
      return jsonError('An active, registered student or subscriber account is required to pay.', 403);
    }
    const email = input.email ?? person.email;
    if (!email) return jsonError('Enter an email address to continue to Paystack.', 400);

    const category = person.category;
    let baseAmountKobo: number;
    if (category === 'SUBSCRIBER') {
      if (!input.plan) return jsonError('Choose a subscriber pass to continue.', 400);
      const savedPrice = await prisma.subscriptionPlanPrice.findUnique({ where: { plan: input.plan } });
      baseAmountKobo = savedPrice?.amountKobo ?? DEFAULT_PLAN_PRICES_KOBO[input.plan];
    } else {
      if (input.plan) return jsonError('Students use the monthly student fee.', 400);
      const savedPrice = await prisma.studentMonthlyPrice.findUnique({ where: { id: 'student-monthly' } });
      baseAmountKobo = savedPrice?.amountKobo ?? DEFAULT_STUDENT_MONTHLY_PRICE_KOBO;
    }
    let discountId: string | null = null;
    let discountKobo = 0;
    if (input.discountCode) {
      const discount = await prisma.subscriberDiscount.findUnique({
        where: { code: input.discountCode.toUpperCase() }
      });
      if (
        !discount ||
        !discount.active ||
        discount.category !== category ||
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
        category,
        plan: input.plan ?? null,
        durationDays: category === 'STUDENT'
          ? 30
          : input.plan === 'DAILY'
            ? 1
            : input.plan === 'WEEKLY'
              ? 7
              : 30,
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
          category: payment.category,
          plan: payment.plan ?? 'STUDENT_MONTHLY'
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
