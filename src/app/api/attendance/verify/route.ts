import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { isWithinGeofence } from '@/lib/geofence';
import { jsonError } from '@/lib/http';
import { prisma } from '@/lib/prisma';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const schema = z.object({
  sessionToken: z.string().min(20).max(200).optional(),
  uniqueId: z.string().trim().regex(/^[ST]\d{3}$/i),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  accuracy: z.number().finite().nonnegative()
});

function getOfficeGeofence() {
  const latitudeValue = process.env.OFFICE_LATITUDE;
  const longitudeValue = process.env.OFFICE_LONGITUDE;
  const radiusValue = process.env.OFFICE_RADIUS_METERS;
  if (!latitudeValue || !longitudeValue || !radiusValue) return null;

  const latitude = Number(latitudeValue);
  const longitude = Number(longitudeValue);
  const radiusMeters = Number(radiusValue);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  if (!Number.isFinite(radiusMeters) || radiusMeters <= 0) return null;
  return { latitude, longitude, radiusMeters };
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
    return jsonError('Enter a valid attendance ID and allow location access.', 400);
  }

  const geofence = getOfficeGeofence();
  if (!geofence) return jsonError('Office location is not configured. Please contact an administrator.', 503);

  try {
    const now = new Date();
    const session = input.sessionToken
      ? await prisma.attendanceSession.findUnique({ where: { tokenHash: hash(input.sessionToken) } })
      : await prisma.attendanceSession.findFirst({
          where: { active: true, startsAt: { lte: now }, endsAt: { gt: now } },
          orderBy: { createdAt: 'desc' }
        });

    if (!session || !session.active || session.startsAt > now || session.endsAt <= now) {
      return jsonError('No active attendance session. Please ask SPARKLAB staff to open one.', 410);
    }

    if (!isWithinGeofence({
      latitude: input.latitude,
      longitude: input.longitude,
      accuracy: input.accuracy,
      officeLatitude: geofence.latitude,
      officeLongitude: geofence.longitude,
      radiusMeters: geofence.radiusMeters
    })) {
      return jsonError('Your location could not be verified within the office area. Enable precise location and try again.', 403);
    }

    const person = await prisma.person.findUnique({ where: { uniqueId: input.uniqueId.toUpperCase() } });
    if (!person || !person.active) {
      return jsonError('VERIFICATION FAILED. Your ID is not registered in the SPARKLAB system.', 404);
    }

    try {
      const record = await prisma.attendance.create({ data: { personId: person.id, sessionId: session.id } });
      return NextResponse.json({
        message: 'ATTENDANCE SUCCESSFUL!',
        attendance: {
          name: person.fullName,
          uniqueId: person.uniqueId,
          category: person.category,
          department: person.department,
          date: record.checkedAt.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'long', year: 'numeric' }),
          time: record.checkedAt.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: true }),
          status: 'Present'
        }
      });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        return jsonError('ATTENDANCE ALREADY RECORDED. You have successfully marked your attendance for this session.', 409);
      }
      throw error;
    }
  } catch (error) {
    console.error('Attendance verification database error:', getDatabaseErrorCode(error));
    return jsonError('Attendance could not be recorded. Please try again.', 500);
  }
}
