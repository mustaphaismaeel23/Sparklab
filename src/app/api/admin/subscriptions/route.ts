import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { getAttendanceDayKey } from '@/lib/attendance-days';
import { jsonError } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_PLAN_PRICES_KOBO,
  DEFAULT_STUDENT_MONTHLY_PRICE_KOBO,
  SUBSCRIPTION_PLANS
} from '@/lib/subscriptions';

const planPriceSchema = z.object({
  plan: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
  amountNgn: z.number().int().min(1).max(10_000_000)
});
const pricesSchema = z.object({
  prices: z.array(planPriceSchema).length(3),
  studentMonthlyAmountNgn: z.number().int().min(1).max(10_000_000)
}).superRefine(({ prices }, context) => {
  if (new Set(prices.map(price => price.plan)).size !== SUBSCRIPTION_PLANS.length) {
    context.addIssue({ code: 'custom', message: 'Provide each pass price exactly once.' });
  }
});
const discountSchema = z.object({
  code: z.string().trim().min(3).max(40).regex(/^[A-Z0-9][A-Z0-9_-]*$/i),
  label: z.string().trim().min(2).max(100),
  amountNgn: z.number().int().min(1).max(10_000_000),
  category: z.enum(['STUDENT', 'SUBSCRIBER']).default('SUBSCRIBER'),
  plan: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).nullable().optional(),
  startsOn: z.iso.date().optional(),
  expiresOn: z.iso.date().optional()
}).superRefine((data, context) => {
  if (data.startsOn && data.expiresOn && data.expiresOn < data.startsOn) {
    context.addIssue({ code: 'custom', path: ['expiresOn'], message: 'Expiry date must be on or after the start date.' });
  }
  if (data.category === 'STUDENT' && data.plan) {
    context.addIssue({ code: 'custom', path: ['plan'], message: 'Student discounts apply to the monthly student fee, not a subscriber pass.' });
  }
});

function getErrorCode(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : 'unknown';
}

export async function GET() {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);

  const [savedPrices, studentPrice, discounts, payments] = await Promise.all([
    prisma.subscriptionPlanPrice.findMany(),
    prisma.studentMonthlyPrice.findUnique({ where: { id: 'student-monthly' } }),
    prisma.subscriberDiscount.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.subscriptionPayment.findMany({
      include: {
        person: { select: { fullName: true, username: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    })
  ]);
  const prices = SUBSCRIPTION_PLANS.map(plan => ({
    plan,
    amountNgn: (savedPrices.find(price => price.plan === plan)?.amountKobo ?? DEFAULT_PLAN_PRICES_KOBO[plan]) / 100
  }));
  return NextResponse.json({
    prices,
    studentMonthlyAmountNgn: (studentPrice?.amountKobo ?? DEFAULT_STUDENT_MONTHLY_PRICE_KOBO) / 100,
    discounts: discounts.map(discount => ({
      id: discount.id,
      code: discount.code,
      label: discount.label,
      amountNgn: discount.amountKobo / 100,
      category: discount.category,
      plan: discount.plan,
      redemptionCount: discount.redemptionCount,
      startsOn: discount.startsAt ? getAttendanceDayKey(discount.startsAt) : null,
      expiresOn: discount.expiresAt ? getAttendanceDayKey(discount.expiresAt) : null,
      active: discount.active
    })),
    payments: payments.map(payment => ({
      id: payment.id,
      reference: payment.reference,
      name: payment.person.fullName,
      username: payment.person.username,
      category: payment.category,
      plan: payment.plan,
      status: payment.status,
      amountNgn: payment.amountKobo / 100,
      discountNgn: payment.discountKobo / 100,
      discountCode: payment.discountCode,
      createdAt: payment.createdAt.toISOString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
      attendanceRecorded: payment.attendanceRecorded
    }))
  });
}

export async function PUT(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  try {
    const { prices, studentMonthlyAmountNgn } = pricesSchema.parse(await request.json());
    await prisma.$transaction([
      ...prices.map(({ plan, amountNgn }) =>
      prisma.subscriptionPlanPrice.upsert({
        where: { plan },
        update: { amountKobo: amountNgn * 100 },
        create: { plan, amountKobo: amountNgn * 100 }
      })),
      prisma.studentMonthlyPrice.upsert({
        where: { id: 'student-monthly' },
        update: { amountKobo: studentMonthlyAmountNgn * 100 },
        create: { id: 'student-monthly', amountKobo: studentMonthlyAmountNgn * 100 }
      })
    ]);
    return NextResponse.json({ saved: true });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError(error.issues.map(issue => issue.message).join(' '), 400);
    console.error('Subscriber plan price update failed:', getErrorCode(error));
    return jsonError('Could not update subscriber pass prices.', 500);
  }
}

export async function POST(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  try {
    const data = discountSchema.parse(await request.json());
    const discount = await prisma.subscriberDiscount.create({
      data: {
        code: data.code.toUpperCase(),
        label: data.label,
        amountKobo: data.amountNgn * 100,
        category: data.category,
        plan: data.plan ?? null,
        ...(data.startsOn ? { startsAt: new Date(`${data.startsOn}T00:00:00+01:00`) } : {}),
        ...(data.expiresOn ? { expiresAt: new Date(`${data.expiresOn}T23:59:59.999+01:00`) } : {})
      }
    });
    return NextResponse.json({ id: discount.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError(error.issues.map(issue => issue.message).join(' '), 400);
    if (getErrorCode(error) === 'P2002') return jsonError('That discount code already exists.', 409);
    console.error('Subscriber discount creation failed:', getErrorCode(error));
    return jsonError('Could not create the discount code.', 500);
  }
}

export async function PATCH(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  const schema = z.object({ id: z.string().min(1), active: z.boolean() });
  try {
    const data = schema.parse(await request.json());
    await prisma.subscriberDiscount.update({ where: { id: data.id }, data: { active: data.active } });
    return NextResponse.json({ updated: true });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError(error.issues.map(issue => issue.message).join(' '), 400);
    if (getErrorCode(error) === 'P2025') return jsonError('Discount code not found.', 404);
    console.error('Subscriber discount update failed:', getErrorCode(error));
    return jsonError('Could not update the discount code.', 500);
  }
}

export async function DELETE(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  const schema = z.object({ id: z.string().min(1) });
  try {
    const { id } = schema.parse(await request.json());
    await prisma.subscriberDiscount.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError(error.issues.map(issue => issue.message).join(' '), 400);
    if (getErrorCode(error) === 'P2025') return jsonError('Discount code not found.', 404);
    console.error('Subscriber discount deletion failed:', getErrorCode(error));
    return jsonError('Could not delete the discount code.', 500);
  }
}
