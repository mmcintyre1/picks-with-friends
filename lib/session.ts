import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Every current user belongs to exactly one group in practice (the schema supports more,
// but there's no multi-group UI in v1) -- this resolves "the" group for the signed-in user.
//
// `currentPath` (the page's own route, e.g. "/parlays/abc123") gets carried through the
// login flow as `?callbackUrl=...` so signing in lands back where the person was actually
// headed -- without this, clicking a shared parlay link while logged out dumps you on the
// dashboard after signing in, and you have to go find that parlay again by hand.
export async function requireUserAndGroup(currentPath?: string) {
  const session = await auth();
  const loginUrl = currentPath ? `/login?callbackUrl=${encodeURIComponent(currentPath)}` : "/login";
  if (!session?.user) redirect(loginUrl);

  const membership = await prisma.groupMember.findFirst({
    where: { userId: session.user.id },
    include: { group: true },
  });
  if (!membership) redirect(loginUrl);

  return { user: session.user, group: membership.group };
}
