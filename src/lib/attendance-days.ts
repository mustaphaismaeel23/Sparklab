export function getAttendanceDayKey(date: Date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
}

export function getAttendanceDayRange(date: Date) {
  const dayKey = getAttendanceDayKey(date);
  const start = new Date(`${dayKey}T00:00:00+01:00`);
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
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
