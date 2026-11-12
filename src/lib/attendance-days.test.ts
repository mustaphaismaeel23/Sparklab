import { equal } from 'node:assert/strict';
import { test } from 'node:test';
import { countAttendanceDays } from './attendance-days';

test('counts distinct Africa/Lagos attendance dates rather than check-ins', () => {
  equal(countAttendanceDays([
    { checkedAt: new Date('2026-03-10T23:30:00Z') },
    { checkedAt: new Date('2026-03-11T08:30:00Z') },
    { checkedAt: new Date('2026-03-12T00:30:00Z') }
  ]), 2);
});
