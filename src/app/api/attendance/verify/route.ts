import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/http';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const schema = z.object({ sessionToken: z.string().min(20).max(200), uniqueId: z.string().trim().regex(/^[ST]\d{3}$/i) });
export async function POST(request: Request) {
  try {
    const { sessionToken, uniqueId } = schema.parse(await request.json());
    const session = await prisma.attendanceSession.findUnique({ where: { tokenHash: hash(sessionToken) } });
    const now = new Date();
    if (!session || !session.active || session.startsAt > now || session.endsAt <= now) return jsonError('This attendance session is invalid, expired or closed.', 410);
    const person = await prisma.person.findUnique({ where: { uniqueId: uniqueId.toUpperCase() } });
    if (!person || !person.active) return jsonError('VERIFICATION FAILED. Your ID is not registered in the SPARKLAB system.', 404);
    try {
      const record = await prisma.attendance.create({ data: { personId: person.id, sessionId: session.id } });
      return NextResponse.json({ message: 'ATTENDANCE SUCCESSFUL!', attendance: { name: person.fullName, uniqueId: person.uniqueId, category: person.category, department: person.department, date: record.checkedAt.toLocaleDateString('en-NG', { timeZone: 'Africa/Lagos', day: '2-digit', month: 'long', year: 'numeric' }), time: record.checkedAt.toLocaleTimeString('en-NG', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hour12: true }), status: 'Present' } });
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return jsonError('ATTENDANCE ALREADY RECORDED. You have successfully marked your attendance for this session.', 409);
      throw error;
    }
  } catch (error) { return jsonError(error instanceof z.ZodError ? 'Please enter a valid attendance ID.' : 'Attendance could not be recorded. Please try again.', 400); }
}
