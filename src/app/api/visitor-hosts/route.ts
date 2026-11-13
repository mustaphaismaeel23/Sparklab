import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/http';

export async function GET() {
  const now = new Date();
  const session = await prisma.attendanceSession.findFirst({
    where: { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
    select: { id: true }
  });
  if (!session) return jsonError('No active attendance session. Please ask SPARKLAB staff to open one.', 410);

  const hosts = await prisma.person.findMany({
    where: { active: true },
    select: { id: true, fullName: true, category: true },
    orderBy: [{ category: 'asc' }, { fullName: 'asc' }]
  });
  return NextResponse.json({ hosts });
}
