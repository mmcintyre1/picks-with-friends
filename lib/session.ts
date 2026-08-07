import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Every current user belongs to exactly one group in practice (the schema supports more,
// but there's no multi-group UI in v1) -- this resolves "the" group for the signed-in user.
export async function requireUserAndGroup() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
    include: { group: true },
  });
  if (!membership) redirect("/login");

  return { user: session.user, group: membership.group };
}
