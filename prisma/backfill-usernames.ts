import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createUsername } from '../src/lib/usernames';

const prisma = new PrismaClient();

async function main() {
  const people = await prisma.person.findMany({
    orderBy: [{ registeredAt: 'asc' }, { id: 'asc' }],
    select: { id: true, fullName: true, username: true }
  });
  const usedUsernames = new Set(
    people.flatMap(person => person.username ? [person.username.toLowerCase()] : [])
  );
  const updates = people
    .filter(person => !person.username)
    .map(person => {
      const username = createUsername(person.fullName, usedUsernames);
      usedUsernames.add(username);
      return { id: person.id, username };
    });

  if (updates.length === 0) {
    console.log('All registered people already have usernames.');
    return;
  }

  await prisma.$transaction(updates.map(person =>
    prisma.person.update({ where: { id: person.id }, data: { username: person.username } })
  ));

  console.log(`Generated usernames for ${updates.length} existing people.`);
}

main().finally(() => prisma.$disconnect());
