import { equal } from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { test } from 'node:test';
import { getAttendanceDayKey, isSubscriptionActive } from './attendance-days';
import {
  discountAmount,
  getSubscriptionBaseDate,
  getSubscriptionDateFields,
  getSubscriptionExpiry
} from './subscriptions';
import { verifyPaystackSignature } from './paystack-signature';

test('uses the fixed 24-hour, 7-day, and 30-day pass durations', () => {
  const start = new Date('2026-03-10T12:00:00.000Z');
  equal(getSubscriptionExpiry(start, 'DAILY').toISOString(), '2026-03-11T12:00:00.000Z');
  equal(getSubscriptionExpiry(start, 'WEEKLY').toISOString(), '2026-03-17T12:00:00.000Z');
  equal(getSubscriptionExpiry(start, 'MONTHLY').toISOString(), '2026-04-09T12:00:00.000Z');
});

test('extends a future pass expiry and starts expired passes at payment time', () => {
  const now = new Date('2026-03-10T12:00:00.000Z');
  const currentExpiry = new Date('2026-03-20T12:00:00.000Z');
  equal(getSubscriptionBaseDate(currentExpiry, currentExpiry, now).toISOString(), currentExpiry.toISOString());
  equal(getSubscriptionBaseDate(new Date('2026-03-01T00:00:00.000Z'), null, now).toISOString(), now.toISOString());
});

test('keeps exact pass timestamps for access checks and legacy date displays', () => {
  const start = new Date('2026-03-10T12:00:00.000Z');
  const expiry = getSubscriptionExpiry(start, 'DAILY');
  const fields = getSubscriptionDateFields(start, expiry);
  equal(isSubscriptionActive(fields.subscriptionStartDate, fields.subscriptionExpiryDate, new Date('2026-03-11T11:59:59.999Z'), start, expiry), true);
  equal(isSubscriptionActive(fields.subscriptionStartDate, fields.subscriptionExpiryDate, expiry, start, expiry), false);
  equal(fields.subscriptionStartDate.toISOString().slice(0, 10), getAttendanceDayKey(start));
  equal(fields.subscriptionExpiryDate.toISOString().slice(0, 10), getAttendanceDayKey(expiry));
});

test('caps fixed-amount discounts at the pass price', () => {
  equal(discountAmount(100_000, 20_000), 20_000);
  equal(discountAmount(100_000, 150_000), 100_000);
  equal(discountAmount(100_000, -1), 0);
});

test('verifies Paystack webhook signatures and rejects malformed or changed signatures', () => {
  const body = '{"event":"charge.success"}';
  const secret = 'local-test-secret';
  const signature = createHmac('sha512', secret).update(body).digest('hex');
  equal(verifyPaystackSignature(body, signature, secret), true);
  equal(verifyPaystackSignature(`${body} `, signature, secret), false);
  equal(verifyPaystackSignature(body, 'not-a-signature', secret), false);
  equal(verifyPaystackSignature(body, null, secret), false);
});
