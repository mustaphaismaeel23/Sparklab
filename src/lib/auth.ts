import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const COOKIE = 'sparklab_admin';
function secret() {
  const value = process.env.JWT_SECRET;
  if (!value || value.length < 32) throw new Error('JWT_SECRET must contain at least 32 characters.');
  return new TextEncoder().encode(value);
}
export async function createAdminToken(adminId: string) {
  return new SignJWT({ role: 'admin' }).setProtectedHeader({ alg: 'HS256' }).setSubject(adminId).setIssuedAt().setExpirationTime('8h').sign(secret());
}
export async function setAdminCookie(token: string) {
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8 });
}
export async function clearAdminCookie() { (await cookies()).delete(COOKIE); }
export async function getAdmin() {
  try {
    const token = (await cookies()).get(COOKIE)?.value;
    if (!token) return null;
    const { payload } = await jwtVerify(token, secret());
    if (payload.role !== 'admin' || !payload.sub) return null;
    return await prisma.admin.findUnique({ where: { id: payload.sub }, select: { id: true, name: true, email: true } });
  } catch { return null; }
}
