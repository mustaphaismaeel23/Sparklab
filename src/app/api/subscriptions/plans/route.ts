import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  DEFAULT_PLAN_PRICES_KOBO,
  DEFAULT_STUDENT_MONTHLY_PRICE_KOBO,
  SUBSCRIPTION_PLANS
} from '@/lib/subscriptions';

export async function GET() {
  const [savedPrices, savedStudentPrice] = await Promise.all([
    prisma.subscriptionPlanPrice.findMany(),
    prisma.studentMonthlyPrice.findUnique({ where: { id: 'student-monthly' } })
  ]);
  const prices = Object.fromEntries(
    SUBSCRIPTION_PLANS.map(plan => [
      plan,
      (savedPrices.find(price => price.plan === plan)?.amountKobo ?? DEFAULT_PLAN_PRICES_KOBO[plan]) / 100
    ])
  );
  return NextResponse.json({
    currency: 'NGN',
    prices,
    studentMonthlyAmountNgn: (savedStudentPrice?.amountKobo ?? DEFAULT_STUDENT_MONTHLY_PRICE_KOBO) / 100
  });
}
