import { equal } from 'node:assert/strict';
import { test } from 'node:test';
import { countAttendanceDays, countAttendanceDaysByPerson, getAttendanceDayRange } from './attendance-days';

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
