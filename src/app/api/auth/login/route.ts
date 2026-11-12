import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createAdminToken, setAdminCookie } from '@/lib/auth';
import { jsonError } from '@/lib/http';
const schema = z.object({ email: z.email(), password: z.string().min(1).max(200) });
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const admin = await prisma.admin.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!admin || !(await bcrypt.compare(body.password, admin.passwordHash))) return jsonError('Invalid email or password.', 401);
    await setAdminCookie(await createAdminToken(admin.id));
    return NextResponse.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (error) { return jsonError(error instanceof z.ZodError ? 'Please enter a valid email and password.' : 'Unable to sign in.', 400); }
}
