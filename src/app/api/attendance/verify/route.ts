import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getGeofenceCheck } from '@/lib/geofence';
import { jsonError } from '@/lib/http';
import { prisma } from '@/lib/prisma';
import { getAttendanceDayKey, getAttendanceDayRange } from '@/lib/attendance-days';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const schema = z.object({
  sessionToken: z.string().min(20).max(200).optional(),
  username: z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative()
});

function getOfficeRadiusMeters() {
  const radiusValue = process.env.OFFICE_RADIUS_METERS;
  if (!radiusValue) return null;
  const radiusMeters = Number(radiusValue);
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return null;
  return radiusMeters;
}

function getDatabaseErrorCode(error: unknown) {
  if (typeof error !== 'object' || error === null) return 'unknown';
  if ('code' in error && typeof error.code === 'string') return error.code;
  if ('errorCode' in error && typeof error.errorCode === 'string') return error.errorCode;
  return 'unknown';
}

export async function POST(request: Request) {
  let input: z.infer<typeof schema>;
  try {
    input = schema.parse(await request.json());
  } catch {
    return jsonError('Enter a valid username and allow location access.', 400);
  }

  const radiusMeters = getOfficeRadiusMeters();
  if (!radiusMeters) return jsonError('Attendance location radius is not configured. Please contact an administrator.', 503);

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
    if (session.locationLatitude === null || session.locationLongitude === null || session.locationAccuracy === null) {
      return jsonError('This QR session has no captured location. Please ask an administrator to start a new session.', 410);
    }

    const geofenceCheck = getGeofenceCheck({
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      centerLatitude: session.locationLatitude,
      centerLongitude: session.locationLongitude,
      radiusMeters
    });
    if (!geofenceCheck.accepted) {
      const distance = Math.round(geofenceCheck.distanceMeters * 10) / 10;
      const accuracy = Math.round(input.accuracy * 10) / 10;
      const reasons = [];
      if (!geofenceCheck.withinRadius) reasons.push(`GPS estimates you are ${distance} m from the session location`);
      if (!geofenceCheck.accuracyWithinLimit) reasons.push(`GPS accuracy is ±${accuracy} m`);
      const message = `${reasons.join('; ')}. Both must be within ${radiusMeters} m of the location captured when this QR session started. `
        + 'If you are at the check-in point, check Precise Location on your phone and ask an administrator to restart the session there.';
      return jsonError(message, 403);
    }

    const person = await prisma.person.findUnique({ where: { username: input.username } });
    if (!person || !person.active) {
      return jsonError('VERIFICATION FAILED. That username is not registered in the SPARKLAB system.', 404);
    }

    try {
      const attendanceDay = getAttendanceDayKey(now);
      const attendanceDayRange = getAttendanceDayRange(now);
      const existingToday = await prisma.attendance.findFirst({
        where: {
          personId: person.id,
          checkedAt: { gte: attendanceDayRange.start, lt: attendanceDayRange.end }
        },
        select: { id: true }
      });
      if (existingToday) return jsonError('ATTENDANCE ALREADY RECORDED. You have already checked in today.', 409);

      const attendanceSession = await prisma.attendanceSession.upsert({
        where: { tokenHash: hash(`daily:${attendanceDay}`) },
        update: {},
        create: {
          tokenHash: hash(`daily:${attendanceDay}`),
          title: `${session.title} (${attendanceDay})`,
          active: false,
          startsAt: now,
          endsAt: attendanceDayRange.end
        }
      });
      const record = await prisma.attendance.create({ data: { personId: person.id, sessionId: attendanceSession.id } });
      return NextResponse.json({
        message: 'ATTENDANCE SUCCESSFUL!',
        attendance: {
          name: person.fullName,
          username: person.username ?? input.username,
          category: person.category,
          department: person.department,
          date: record.checkedAt.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'long', year: 'numeric' }),
          time: record.checkedAt.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: true }),
          status: 'Present'
        }
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        return jsonError('ATTENDANCE ALREADY RECORDED. You have already checked in today.', 409);
      }
      throw error;
    }
  } catch (error) {
    console.error('Attendance verification database error:', getDatabaseErrorCode(error));
    return jsonError('Attendance could not be recorded. Please try again.', 500);
  }
}
