import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/http';
const schema = z.object({ fullName: z.string().trim().min(2).max(120), phone: z.string().trim().min(5).max(30), email: z.union([z.email(), z.literal('')]).optional(), department: z.string().trim().min(2).max(120), active: z.boolean() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  try { const { id } = await context.params; const data = schema.parse(await request.json()); const person = await prisma.person.update({ where: { id }, data: { ...data, email: data.email || null } }); return NextResponse.json({ person }); }
  catch (error) { return jsonError(error instanceof z.ZodError ? 'Invalid user details.' : 'User not found or update failed.', 400); }
}
