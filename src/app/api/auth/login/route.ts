import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { createAdminToken, setAdminCookie } from '@/lib/auth';
import { jsonError } from '@/lib/http';
const schema = z.object({ email: z.email().trim().toLowerCase(), password: z.string().min(1).max(200) });
export async function POST(request: Request) {
  try {
    const body = schema.parse(await request.json());
    const admin = await prisma.admin.findUnique({ where: { email: body.email } });
    if (!admin || !(await bcrypt.compare(body.password, admin.passwordHash))) return jsonError('Invalid email or password.', 401);
    await setAdminCookie(await createAdminToken(admin.id));
    return NextResponse.json({ admin: { id: admin.id, name: admin.name, email: admin.email } });
  } catch (error) {
    if (error instanceof z.ZodError) return jsonError('Please enter a valid email and password.', 400);
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'unknown';
    console.error('Admin login failed:', code);
    return jsonError('Sign-in is temporarily unavailable. Please try again shortly.', 503);
  }
}
