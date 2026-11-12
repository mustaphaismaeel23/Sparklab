import { NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { z } from 'zod';
import QRCode from 'qrcode';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/http';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export async function POST(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  try {
    const body = z.object({ title: z.string().trim().min(2).max(100).default('SPARKLAB Attendance'), durationMinutes: z.number().int().min(5).max(720).nullable().default(null) }).parse(await request.json());
    await prisma.attendanceSession.updateMany({ where: { active: true }, data: { active: false } });
    const token = randomBytes(32).toString('base64url');
    const endsAt = body.durationMinutes === null ? null : new Date(Date.now() + body.durationMinutes * 60_000);
    const session = await prisma.attendanceSession.create({ data: { tokenHash: hash(token), title: body.title, endsAt } });
    const origin = process.env.APP_URL || new URL(request.url).origin;
    const attendanceUrl = new URL('/attendance', origin).toString();
    const qrDataUrl = await QRCode.toDataURL(attendanceUrl, { width: 420, margin: 2, errorCorrectionLevel: 'H' });
    return NextResponse.json({ session: { id: session.id, title: session.title, endsAt: session.endsAt }, attendanceUrl, qrDataUrl }, { status: 201 });
  } catch (error) {
    console.error('Attendance session creation failed:', error instanceof Error ? error.message : 'unknown error');
    return jsonError('Could not create attendance session.', 400);
  }
}
