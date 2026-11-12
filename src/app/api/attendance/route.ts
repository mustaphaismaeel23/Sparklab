import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/http';
import { countAttendanceDaysByPerson } from '@/lib/attendance-days';
export async function GET(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  const { searchParams } = new URL(request.url); const date = searchParams.get('date'); const category = searchParams.get('category'); const q = searchParams.get('q')?.trim();
  const start = date ? new Date(`${date}T00:00:00+01:00`) : undefined; const end = date ? new Date(new Date(`${date}T00:00:00+01:00`).getTime() + 86400000) : undefined;
  const records = await prisma.attendance.findMany({ where: { ...(start && end ? { checkedAt: { gte: start, lt: end } } : {}), ...((category === 'STUDENT' || category === 'STAFF' || q) ? { person: { ...(category === 'STUDENT' || category === 'STAFF' ? { category } : {}), ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { username: { contains: q, mode: 'insensitive' } }] } : {}) } } : {}) }, include: { person: true, session: { select: { title: true } } }, orderBy: { checkedAt: 'desc' }, take: 1000 });
  const personIds = [...new Set(records.map(record => record.personId))];
  const checkins = personIds.length
    ? await prisma.attendance.findMany({ where: { personId: { in: personIds } }, select: { personId: true, checkedAt: true } })
    : [];
  const daysByPerson = countAttendanceDaysByPerson(checkins);
  return NextResponse.json({ records: records.map(r => ({ id: r.id, name: r.person.fullName, username: r.person.username ?? '', category: r.person.category, department: r.person.department, date: r.checkedAt.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }), time: r.checkedAt.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' }), daysAttended: daysByPerson.get(r.personId) ?? 0, status: 'Present', session: r.session.title })) });
}
