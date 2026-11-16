import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateUniqueId } from '@/lib/ids';
import { jsonError } from '@/lib/http';
import { normalizeUsername } from '@/lib/usernames';
import { countAttendanceDays } from '@/lib/attendance-days';

const personFields = {
  fullName: z.string().trim().min(2).max(120),
  username: z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  phone: z.string().trim().min(5).max(30),
  email: z.union([z.email(), z.literal('')]).optional(),
  department: z.string().trim().min(2).max(120)
};
const schema = z.discriminatedUnion('category', [
  z.object({ ...personFields, category: z.literal('STUDENT') }),
  z.object({ ...personFields, category: z.literal('STAFF') }),
  z.object({ ...personFields, category: z.literal('VISITOR') }),
  z.object({
    ...personFields,
    category: z.literal('SUBSCRIBER'),
    subscriptionPlan: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']),
    subscriptionStartDate: z.iso.date(),
    subscriptionExpiryDate: z.iso.date()
  }).refine(data => data.subscriptionStartDate <= data.subscriptionExpiryDate, {
    path: ['subscriptionExpiryDate'],
    message: 'Expiry date must be on or after the start date.'
  })
]);

export async function GET(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  const { searchParams } = new URL(request.url); const q = searchParams.get('q')?.trim(); const category = searchParams.get('category'); const status = searchParams.get('status');
  const people = await prisma.person.findMany({ where: { ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { username: { contains: q, mode: 'insensitive' as const } }] } : {}), ...(category === 'STUDENT' || category === 'STAFF' || category === 'VISITOR' || category === 'GUEST' || category === 'SUBSCRIBER' ? { category } : {}), ...(status === 'active' ? { active: true } : status === 'inactive' ? { active: false } : {}) }, include: { attendance: { select: { checkedAt: true } } }, orderBy: { registeredAt: 'desc' } });
  return NextResponse.json({ people: people.map(({ attendance, ...person }) => ({ ...person, daysAttended: countAttendanceDays(attendance) })) });
}
export async function POST(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  try {
    const data = schema.parse(await request.json());
    const username = normalizeUsername(data.username);
    const uniqueId = await generateUniqueId(data.category);
    const subscription = data.category === 'SUBSCRIBER'
      ? {
          subscriptionPlan: data.subscriptionPlan,
          subscriptionStartDate: new Date(`${data.subscriptionStartDate}T00:00:00.000Z`),
          subscriptionExpiryDate: new Date(`${data.subscriptionExpiryDate}T00:00:00.000Z`)
        }
      : { subscriptionPlan: null, subscriptionStartDate: null, subscriptionExpiryDate: null };
    const person = await prisma.person.create({ data: { ...data, ...subscription, username, email: data.email || null, uniqueId } });
    return NextResponse.json({ person }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError(error.issues.map(issue => issue.message).join(' ') || 'Please check the required fields, category, and subscription dates.', 400);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return jsonError('That username is already taken. Choose another username.', 409);
    return jsonError('Could not register this person. Check for duplicate information and try again.', 400);
  }
}
