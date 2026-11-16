import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_PLAN_PRICES_KOBO, SUBSCRIPTION_PLANS } from '@/lib/subscriptions';

export async function GET() {
  const savedPrices = await prisma.subscriptionPlanPrice.findMany();
  const prices = Object.fromEntries(
    SUBSCRIPTION_PLANS.map(plan => [
      plan,
      (savedPrices.find(price => price.plan === plan)?.amountKobo ?? DEFAULT_PLAN_PRICES_KOBO[plan]) / 100
    ])
  );
  return NextResponse.json({ currency: 'NGN', prices });
}
