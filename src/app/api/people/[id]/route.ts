import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/http';
import { normalizeUsername } from '@/lib/usernames';
const schema = z.object({ fullName: z.string().trim().min(2).max(120), username: z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/), phone: z.string().trim().min(5).max(30), email: z.union([z.email(), z.literal('')]).optional(), department: z.string().trim().min(2).max(120), active: z.boolean() });
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  try { const { id } = await context.params; const data = schema.parse(await request.json()); const person = await prisma.person.update({ where: { id }, data: { ...data, username: normalizeUsername(data.username), email: data.email || null } }); return NextResponse.json({ person }); }
  catch (error) {
    if (error instanceof z.ZodError) return jsonError('Invalid user details. Usernames must be 3–24 characters using letters, numbers, and hyphens.', 400);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return jsonError('That username is already taken. Choose another username.', 409);
    return jsonError('User not found or update failed.', 400);
  }
}
