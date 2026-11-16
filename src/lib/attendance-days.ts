export function getAttendanceDayKey(date: Date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
}

export function getAttendanceDayRange(date: Date) {
  const dayKey = getAttendanceDayKey(date);
  const start = new Date(`${dayKey}T00:00:00+01:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function isSubscriptionActive(startDate: Date | null, expiryDate: Date | null, now: Date) {
  if (!startDate || !expiryDate) return false;
  const today = getAttendanceDayKey(now);
  return startDate.toISOString().slice(0, 10) <= today && expiryDate.toISOString().slice(0, 10) >= today;
}

export function uniqueAttendanceCheckinsByPersonAndDay<T extends { personId: string; checkedAt: Date }>(checkins: readonly T[]) {
  const seen = new Set<string>();
  return checkins.filter(checkin => {
    const key = `${checkin.personId}:${getAttendanceDayKey(checkin.checkedAt)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countAttendanceDays(checkins: readonly { checkedAt: Date }[]) {
  return new Set(checkins.map(({ checkedAt }) => getAttendanceDayKey(checkedAt))).size;
}

export function countAttendanceDaysByPerson(checkins: readonly { personId: string; checkedAt: Date }[]) {
  const datesByPerson = new Map<string, Date[]>();
  for (const checkin of checkins) {
    const dates = datesByPerson.get(checkin.personId) ?? [];
    dates.push(checkin.checkedAt);
    datesByPerson.set(checkin.personId, dates);
  }
  return new Map([...datesByPerson].map(([personId, dates]) => [
    personId,
    countAttendanceDays(dates.map(checkedAt => ({ checkedAt })))
  ]));
}
