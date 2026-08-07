import "dotenv/config";

import type { User } from "../app/generated/prisma/client";
import { prisma } from "../lib/prisma";

async function main() {
  const group = await prisma.group.upsert({
    where: { id: "seed-group" },
    update: {},
    create: { id: "seed-group", name: "The Group" },
  });

  // Usernames only -- no PIN is set here. Each friend claims their PIN on first
  // sign-in via the login screen's claim step. Rename these to real usernames
  // whenever you're ready (re-running this script is safe, it upserts by username).
  const usernames = ["friend1", "friend2", "friend3", "friend4"];

  const users = await Promise.all(
    usernames.map((username) =>
      prisma.user.upsert({
        where: { username },
        update: {},
        create: { username },
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
