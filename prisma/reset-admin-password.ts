import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || 'admin@sparklab.local').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!password?.trim()) {
    throw new Error('Set ADMIN_PASSWORD in .env to the new admin password before running this command.');
  }

  const admin = await prisma.admin.findUnique({ where: { email }, select: { id: true } });
  if (!admin) {
    throw new Error(`No admin found for ${email}. Set ADMIN_EMAIL to the existing admin email.`);
  }

  await prisma.admin.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(password, 12) }
  });

  console.log(`Admin password reset for ${email}`);
}

main().finally(() => prisma.$disconnect());
