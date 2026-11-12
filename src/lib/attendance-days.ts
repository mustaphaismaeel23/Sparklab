export function countAttendanceDays(checkins: readonly { checkedAt: Date }[]) {
  return new Set(checkins.map(({ checkedAt }) =>
    checkedAt.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
  )).size;
}
