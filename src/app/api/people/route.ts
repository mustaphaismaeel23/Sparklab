import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateUniqueId } from '@/lib/ids';
import { jsonError } from '@/lib/http';
import { normalizeUsername } from '@/lib/usernames';
import { countAttendanceDays } from '@/lib/attendance-days';
const schema = z.object({ fullName: z.string().trim().min(2).max(120), username: z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), phone: z.string().trim().min(5).max(30), email: z.union([z.email(), z.literal('')]).optional(), category: z.enum(['STUDENT','STAFF']), department: z.string().trim().min(2).max(120) });
export async function GET(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  const { searchParams } = new URL(request.url); const q = searchParams.get('q')?.trim(); const category = searchParams.get('category'); const status = searchParams.get('status');
  const people = await prisma.person.findMany({ where: { ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { username: { contains: q, mode: 'insensitive' as const } }] } : {}), ...(category === 'STUDENT' || category === 'STAFF' ? { category } : {}), ...(status === 'active' ? { active: true } : status === 'inactive' ? { active: false } : {}) }, include: { attendance: { select: { checkedAt: true } } }, orderBy: { registeredAt: 'desc' } });
  return NextResponse.json({ people: people.map(({ attendance, ...person }) => ({ ...person, daysAttended: countAttendanceDays(attendance) })) });
}
export async function POST(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  try {
    const data = schema.parse(await request.json());
    const username = normalizeUsername(data.username);
    const uniqueId = await generateUniqueId(data.category);
    const person = await prisma.person.create({ data: { ...data, username, email: data.email || null, uniqueId } });
    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError('Please check all required fields. Usernames must be 3–24 characters using letters, numbers, and hyphens.', 400);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return jsonError('That username is already taken. Choose another username.', 409);
    return jsonError('Could not register this person. Check for duplicate information and try again.', 400);
  }
}
