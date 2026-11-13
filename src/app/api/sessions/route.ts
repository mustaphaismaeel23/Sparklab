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
    const body = z.object({
      title: z.string().trim().min(2).max(100).default('SPARKLAB Attendance'),
      durationMinutes: z.number().int().min(5).max(720).nullable().default(null),
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
      accuracy: z.number().finite().nonnegative()
    }).parse(await request.json());
    const radiusMeters = Number(process.env.OFFICE_RADIUS_METERS);
    if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) {
      return jsonError('Attendance location radius is not configured. Please contact an administrator.', 503);
    }
    if (body.accuracy > radiusMeters) {
      return jsonError(`Administrator GPS accuracy is ±${Math.round(body.accuracy)} m. It must be within ${radiusMeters} m to start this session.`, 422);
    }

    await prisma.attendanceSession.updateMany({ where: { active: true }, data: { active: false } });
    const token = randomBytes(32).toString('base64url');
    const endsAt = body.durationMinutes === null ? null : new Date(Date.now() + body.durationMinutes * 60_000);
    const session = await prisma.attendanceSession.create({
      data: {
        tokenHash: hash(token),
        title: body.title,
        endsAt,
        locationLatitude: body.latitude,
        locationLongitude: body.longitude,
        locationAccuracy: body.accuracy
      }
    });
    const origin = process.env.APP_URL || new URL(request.url).origin;
    const attendanceUrl = new URL('/attendance', origin).toString();
    const qrDataUrl = await QRCode.toDataURL(attendanceUrl, { width: 420, margin: 2, errorCorrectionLevel: 'H' });
    return NextResponse.json({
      session: { id: session.id, title: session.title, endsAt: session.endsAt, locationAccuracy: session.locationAccuracy },
      attendanceUrl,
      qrDataUrl
    }, { status: 201 });
  } catch (error) {
    console.error('Attendance session creation failed:', error instanceof Error ? error.message : 'unknown error');
    return jsonError('Could not create attendance session.', 400);
  }
}
