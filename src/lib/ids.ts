import { prisma } from '@/lib/prisma';
import type { UserCategory } from '@prisma/client';
export async function generateUniqueId(category: UserCategory) {
  const prefixByCategory: Record<UserCategory, string> = {
    STUDENT: 'S',
    STAFF: 'T',
    VISITOR: 'V',
    GUEST: 'G',
    SUBSCRIBER: 'B'
  };
  const prefix = prefixByCategory[category];
  const people = await prisma.person.findMany({ where: { category }, select: { uniqueId: true } });
  const usedIds = new Set(people.map(person => person.uniqueId));
  for (let sequence = 1; sequence <= 999; sequence++) {
    const candidate = `${prefix}${String(sequence).padStart(3, '0')}`;
    if (!usedIds.has(candidate)) return candidate;
  }
  throw new Error(`No short IDs remain for ${category.toLowerCase()}s.`);
}
