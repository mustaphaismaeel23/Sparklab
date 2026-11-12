import { NextResponse } from 'next/server';
import { getAdmin } from '@/lib/auth';
export async function GET() { const admin = await getAdmin(); return admin ? NextResponse.json({ admin }) : NextResponse.json({ admin: null }, { status: 401 }); }
