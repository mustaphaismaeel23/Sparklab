export function getAttendanceDayKey(date: Date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
}

export function countAttendanceDays(checkins: readonly { checkedAt: Date }[]) {
  return new Set(checkins.map(({ checkedAt }) => getAttendanceDayKey(checkedAt))).size;
}
