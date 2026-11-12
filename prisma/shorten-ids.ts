import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const people = await prisma.person.findMany({
    orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
    select: { id: true, category: true, uniqueId: true }
  });
  const sequence = { STUDENT: 0, STAFF: 0 };
  const updates = people.map(person => {
    sequence[person.category] += 1;
    if (sequence[person.category] > 999) {
      throw new Error(`Cannot assign short IDs: ${person.category.toLowerCase()} limit is 999.`);
    }

    const prefix = person.category === 'STUDENT' ? 'S' : 'T';
    return {
      id: person.id,
      currentId: person.uniqueId,
      uniqueId: `${prefix}${String(sequence[person.category]).padStart(3, '0')}`
    };
  });

  const changes = updates.filter(person => person.currentId !== person.uniqueId);
  if (changes.length === 0) {
    console.log('All registered people already have short IDs.');
    return;
  }

  await prisma.$transaction(async tx => {
    for (const person of changes) {
      await tx.person.update({
        where: { id: person.id },
        data: { uniqueId: `TEMP-${randomUUID()}` }
      });
    }
    for (const person of changes) {
      await tx.person.update({
        where: { id: person.id },
        data: { uniqueId: person.uniqueId }
      });
    }
  }, { timeout: 120_000 });

  console.log(`Updated ${changes.length} IDs (${sequence.STUDENT} students and ${sequence.STAFF} staff registered).`);
}

main().finally(() => prisma.$disconnect());
