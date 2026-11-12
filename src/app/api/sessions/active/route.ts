import { NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getAdmin } from '@/lib/auth';
import { jsonError } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);

  const session = await prisma.attendanceSession.findFirst({
    where: { active: true, endsAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' }
  });
  const origin = process.env.APP_URL || new URL(request.url).origin;
  const attendanceUrl = new URL('/attendance', origin).toString();
  const qrDataUrl = await QRCode.toDataURL(attendanceUrl, { width: 420, margin: 2, errorCorrectionLevel: 'H' });

  return NextResponse.json({
    session: session ? { id: session.id, title: session.title, startsAt: session.startsAt, endsAt: session.endsAt } : null,
    attendanceUrl,
    qrDataUrl
  });
}
