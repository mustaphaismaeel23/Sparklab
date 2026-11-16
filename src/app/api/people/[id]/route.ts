import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdmin } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { jsonError } from '@/lib/http';
import { normalizeUsername } from '@/lib/usernames';
const schema = z.object({
  fullName: z.string().trim().min(2).max(120),
  username: z.string().trim().toLowerCase().min(3).max(24).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  phone: z.string().trim().min(5).max(30),
  email: z.union([z.email(), z.literal('')]).optional(),
  department: z.string().trim().min(2).max(120),
  active: z.boolean(),
  subscriptionPlan: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  subscriptionStartDate: z.iso.date().optional(),
  subscriptionExpiryDate: z.iso.date().optional()
}).superRefine((data, context) => {
  const hasSubscriptionDetails = data.subscriptionPlan !== undefined ||
    data.subscriptionStartDate !== undefined ||
    data.subscriptionExpiryDate !== undefined;
  if (hasSubscriptionDetails && (!data.subscriptionPlan || !data.subscriptionStartDate || !data.subscriptionExpiryDate)) {
    context.addIssue({ code: 'custom', message: 'Provide a plan, start date, and expiry date together.' });
  }
  if (data.subscriptionStartDate && data.subscriptionExpiryDate && data.subscriptionStartDate > data.subscriptionExpiryDate) {
    context.addIssue({ code: 'custom', path: ['subscriptionExpiryDate'], message: 'Expiry date must be on or after the start date.' });
  }
});
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  try {
    const { id } = await context.params;
    const data = schema.parse(await request.json());
    const hasSubscriptionDetails = data.subscriptionPlan !== undefined ||
      data.subscriptionStartDate !== undefined ||
      data.subscriptionExpiryDate !== undefined;
    const existingPerson = await prisma.person.findUnique({ where: { id }, select: { category: true } });
    if (!existingPerson) return jsonError('User not found.', 404);
    if (hasSubscriptionDetails && existingPerson.category !== 'SUBSCRIBER') {
      return jsonError('Subscription details can only be updated for subscribers.', 400);
    }
    const subscription = data.subscriptionPlan && data.subscriptionStartDate && data.subscriptionExpiryDate
      ? {
          subscriptionPlan: data.subscriptionPlan,
          subscriptionStartDate: new Date(`${data.subscriptionStartDate}T00:00:00.000Z`),
          subscriptionExpiryDate: new Date(`${data.subscriptionExpiryDate}T00:00:00.000Z`)
        }
      : {};
    const person = await prisma.person.update({
      where: { id },
      data: { ...data, ...subscription, username: normalizeUsername(data.username), email: data.email || null }
    });
    return NextResponse.json({ person });
  }
  catch (error) {
    if (error instanceof z.ZodError) return jsonError(error.issues.map(issue => issue.message).join(' ') || 'Invalid user details.', 400);
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return jsonError('That username is already taken. Choose another username.', 409);
    return jsonError('User not found or update failed.', 400);
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  const { id } = await context.params;
  try {
    await prisma.$transaction(async transaction => {
      await transaction.attendance.deleteMany({ where: { personId: id } });
      await transaction.person.delete({ where: { id } });
    });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return jsonError('User not found.', 404);
    }
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'unknown';
    console.error('Admin person deletion failed:', code);
    return jsonError('Could not delete the user and attendance history.', 500);
  }
}
