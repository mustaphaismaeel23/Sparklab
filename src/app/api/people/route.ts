import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateUniqueId } from '@/lib/ids';
import { jsonError } from '@/lib/http';
const schema = z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(5).max(30), email: z.union([z.email(), z.literal('')]).optional(), category: z.enum(['STUDENT','STAFF']), department: z.string().trim().min(2).max(120) });
export async function GET(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  const { searchParams } = new URL(request.url); const q = searchParams.get('q')?.trim(); const category = searchParams.get('category'); const status = searchParams.get('status');
  const people = await prisma.person.findMany({ where: { ...(q ? { OR: [{ fullName: { contains: q, mode: 'insensitive' as const } }, { uniqueId: { contains: q, mode: 'insensitive' as const } }] } : {}), ...(category === 'STUDENT' || category === 'STAFF' ? { category } : {}), ...(status === 'active' ? { active: true } : status === 'inactive' ? { active: false } : {}) }, orderBy: { registeredAt: 'desc' } });
  return NextResponse.json({ people });
}
export async function POST(request: Request) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  try {
    const data = schema.parse(await request.json());
    const uniqueId = await generateUniqueId(data.category);
    const person = await prisma.person.create({ data: { ...data, email: data.email || null, uniqueId } });
    return NextResponse.json({ person }, { status: 201 });
  } catch (error) { return jsonError(error instanceof z.ZodError ? 'Please check all required fields.' : 'Could not register this person. Check for duplicate information and try again.', 400); }
}
