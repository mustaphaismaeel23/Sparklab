import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/http';
export async function GET() {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  const session = await prisma.attendanceSession.findFirst({ where: { active: true, endsAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json({ session: session ? { id: session.id, title: session.title, startsAt: session.startsAt, endsAt: session.endsAt } : null });
}
