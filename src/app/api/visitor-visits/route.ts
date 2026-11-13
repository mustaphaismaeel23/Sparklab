import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { getAttendanceDayKey } from '@/lib/attendance-days';
import { jsonError } from '@/lib/http';
import { normalizeVisitorName } from '@/lib/visitor-names';
import { prisma } from '@/lib/prisma';

const schema = z.object({
  sessionToken: z.string().min(20).max(200).optional(),
  visitorName: z.string().trim().min(2).max(120),
  hostPersonId: z.string().min(1).max(32).optional(),
  otherHostName: z.string().trim().min(2).max(120).optional()
}).refine(data => Boolean(data.hostPersonId) !== Boolean(data.otherHostName), {
  message: 'Choose a host or enter a name for someone not listed.'
});

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

function isUniqueConstraintError(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function getErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) return 'unknown';
  if ('code' in error && typeof error.code === 'string') return error.code;
  return 'unknown';
}

export async function GET() {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);

  const visits = await prisma.visitorVisit.findMany({
    include: { session: { select: { title: true } } },
    orderBy: { checkedAt: 'desc' },
    take: 1000
  });
  return NextResponse.json({
    visits: visits.map(visit => ({
      id: visit.id,
      visitorName: visit.visitorName,
      hostName: visit.hostName,
      date: visit.checkedAt.toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }),
      time: visit.checkedAt.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit' }),
      session: visit.session.title
    }))
  });
}

export async function POST(request: Request) {
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return jsonError('Enter your name and choose who you are visiting.', 400);
  }

  try {
    const now = new Date();
    const session = input.sessionToken
      ? await prisma.attendanceSession.findUnique({ where: { tokenHash: hash(input.sessionToken) } })
      : await prisma.attendanceSession.findFirst({
          where: { active: true, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
          orderBy: { createdAt: 'desc' }
        });

    if (!session || !session.active || session.startsAt > now || (session.endsAt !== null && session.endsAt <= now)) {
      return jsonError('No active attendance session. Please ask SPARKLAB staff to open one.', 410);
    }

    let hostPersonId: string | null = null;
    let hostName: string;
    if (input.hostPersonId) {
      const host = await prisma.person.findFirst({
        where: { id: input.hostPersonId, active: true },
        select: { id: true, fullName: true }
      });
      if (!host) return jsonError('The selected host is not active. Choose another host.', 404);
      hostPersonId = host.id;
      hostName = host.fullName;
    } else if (input.otherHostName) {
      hostName = input.otherHostName;
    } else {
      return jsonError('Choose a host or enter a name for someone not listed.', 400);
    }

    const visit = await prisma.visitorVisit.create({
      data: {
        visitorName: input.visitorName,
        visitorNameKey: normalizeVisitorName(input.visitorName),
        visitDay: getAttendanceDayKey(now),
        hostName,
        hostPersonId,
        sessionId: session.id
      }
    });

    return NextResponse.json({
      message: 'VISITOR CHECK-IN RECORDED!',
      visit: {
        visitorName: visit.visitorName,
        hostName: visit.hostName,
        date: visit.checkedAt.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'long', year: 'numeric' }),
        time: visit.checkedAt.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: true })
      }
    }, { status: 201 });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return jsonError('A visitor with this name has already checked in today.', 409);
    }
    console.error('Visitor check-in failed:', getErrorCode(error));
    return jsonError('Visitor check-in could not be recorded. Please try again.', 500);
  }
}
