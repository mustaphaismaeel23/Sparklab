import { equal } from 'node:assert/strict';
import { test } from 'node:test';
import { countAttendanceDays, countAttendanceDaysByPerson, getAttendanceDayRange, isSubscriptionActive, uniqueAttendanceCheckinsByPersonAndDay } from './attendance-days';

test('counts distinct Africa/Lagos attendance dates rather than check-ins', () => {
  equal(countAttendanceDays([
    { checkedAt: new Date('2026-03-10T23:30:00Z') },
    { checkedAt: new Date('2026-03-11T08:30:00Z') },
    { checkedAt: new Date('2026-03-12T00:30:00Z') }
  ]), 2);
});

test('counts distinct attendance dates separately for each person', () => {
  const counts = countAttendanceDaysByPerson([
    { personId: 'one', checkedAt: new Date('2026-03-10T23:30:00Z') },
    { personId: 'one', checkedAt: new Date('2026-03-11T08:30:00Z') },
    { personId: 'two', checkedAt: new Date('2026-03-11T08:30:00Z') }
  ]);
  equal(counts.get('one'), 1);
  equal(counts.get('two'), 1);
});

test('builds the attendance-day range in Africa/Lagos time', () => {
  const { start, end } = getAttendanceDayRange(new Date('2026-03-10T23:30:00Z'));
  equal(start.toISOString(), '2026-03-10T23:00:00.000Z');
  equal(end.toISOString(), '2026-03-11T23:00:00.000Z');
});

test('keeps only the newest attendance check-in per person and Lagos day', () => {
  const checkins = uniqueAttendanceCheckinsByPersonAndDay([
    { id: 'newest', personId: 'one', checkedAt: new Date('2026-03-11T08:30:00Z') },
    { id: 'older-same-day', personId: 'one', checkedAt: new Date('2026-03-10T23:30:00Z') },
    { id: 'another-person', personId: 'two', checkedAt: new Date('2026-03-11T08:30:00Z') },
    { id: 'another-day', personId: 'one', checkedAt: new Date('2026-03-12T00:30:00Z') }
  ]);
  equal(checkins.map(checkin => checkin.id).join(','), 'newest,another-person,another-day');
});

test('allows subscriber check-ins on inclusive start and expiry dates', () => {
  const start = new Date('2026-03-10T00:00:00.000Z');
  const expiry = new Date('2026-03-16T00:00:00.000Z');
  equal(isSubscriptionActive(start, expiry, new Date('2026-03-10T23:30:00Z')), true);
  equal(isSubscriptionActive(start, expiry, new Date('2026-03-16T22:30:00Z')), true);
  equal(isSubscriptionActive(start, expiry, new Date('2026-03-16T23:30:00Z')), false);
  equal(isSubscriptionActive(null, expiry, new Date('2026-03-12T12:00:00Z')), false);
});
