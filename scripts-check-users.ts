import { prisma } from "../lib/prisma";

async function main() {
  const users = await prisma.user.findMany({
    select: { username: true, name: true, pinHash: true, lockedUntil: true, failedLoginAttempts: true },
    orderBy: { username: "asc" },
  });
  for (const u of users) {
    console.log(`${u.username} (${u.name ?? "no name"}): pin=${u.pinHash ? "set" : "unset"} failedAttempts=${u.failedLoginAttempts} lockedUntil=${u.lockedUntil ?? "no"}`);
  }
  process.exit(0);
}
main();
