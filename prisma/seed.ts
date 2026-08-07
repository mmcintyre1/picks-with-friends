import "dotenv/config";

import type { User } from "../app/generated/prisma/client";
import { prisma } from "../lib/prisma";

async function main() {
  const group = await prisma.group.upsert({
    where: { id: "seed-group" },
    update: {},
    create: { id: "seed-group", name: "The Group" },
  });

  const friendEmails = [
    "friend1@example.com",
    "friend2@example.com",
    "friend3@example.com",
    "friend4@example.com",
  ];

  const users = await Promise.all(
    friendEmails.map((email, i) =>
      prisma.user.upsert({
        where: { email },
        update: {},
        create: { email, name: `Friend ${i + 1}` },
      }),
    ),
  );

  await Promise.all(
    users.map((user: User, i: number) =>
      prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: user.id } },
        update: {},
        create: {
          groupId: group.id,
          userId: user.id,
          role: i === 0 ? "ADMIN" : "MEMBER",
        },
      }),
    ),
  );

  console.log(`Seeded group "${group.name}" with ${users.length} members.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
