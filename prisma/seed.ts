import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
const prisma = new PrismaClient();
async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME || 'SPARKLAB Administrator';
  if (!email || !password?.trim()) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before seeding the administrator.');
  }
  await prisma.admin.upsert({
    where: { email },
    update: {},
    create: { name, email, passwordHash: await bcrypt.hash(password, 12) }
  });
  console.log(`Admin ready: ${email}`);
}
main().finally(() => prisma.$disconnect());
