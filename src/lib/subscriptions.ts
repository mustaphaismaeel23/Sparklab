import { getAttendanceDayKey } from '@/lib/attendance-days';

export type SubscriptionPlan = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type PayableCategory = 'STUDENT' | 'SUBSCRIBER';

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = ['DAILY', 'WEEKLY', 'MONTHLY'];
export const DEFAULT_STUDENT_MONTHLY_PRICE_KOBO = 3_500_000;
export const DEFAULT_PLAN_PRICES_KOBO: Record<SubscriptionPlan, number> = {
  DAILY: 250_000,
  WEEKLY: 1_000_000,
  MONTHLY: 3_500_000
};

const PLAN_DURATIONS_MS: Record<SubscriptionPlan, number> = {
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000
};

export function getSubscriptionBaseDate(
  currentExpiry: Date | null,
  currentExpiryAt: Date | null,
  now: Date
) {
  if (currentExpiryAt) return currentExpiryAt > now ? currentExpiryAt : now;
  const legacyExpiry = currentExpiry
    ? new Date(`${currentExpiry.toISOString().slice(0, 10)}T23:59:59.999+01:00`)
    : null;
  return legacyExpiry && legacyExpiry > now ? legacyExpiry : now;
}

export function getSubscriptionExpiry(start: Date, plan: SubscriptionPlan) {
  return new Date(start.getTime() + PLAN_DURATIONS_MS[plan]);
}

export function getSubscriptionDateFields(start: Date, expiry: Date) {
  return {
    subscriptionStartDate: new Date(`${getAttendanceDayKey(start)}T00:00:00.000Z`),
    subscriptionExpiryDate: new Date(`${getAttendanceDayKey(expiry)}T00:00:00.000Z`)
  };
}

export function discountAmount(priceKobo: number, discountKobo: number) {
  return Math.min(Math.max(0, discountKobo), priceKobo);
}
