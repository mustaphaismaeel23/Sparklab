import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/auth';
import { jsonError } from '@/lib/http';
import { prisma } from '@/lib/prisma';

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  if (!(await getAdmin())) return jsonError('Unauthorized', 401);
  const { id } = await context.params;
  try {
    await prisma.visitorVisit.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2025') {
      return jsonError('Visitor record not found.', 404);
    }
    const code = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : 'unknown';
    console.error('Admin visitor-record deletion failed:', code);
    return jsonError('Could not delete the visitor record.', 500);
  }
}
