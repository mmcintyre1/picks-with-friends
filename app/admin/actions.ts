"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireUserAndGroup } from "@/lib/session";

export type ActionResult = { error: string } | undefined;

// Open to any signed-in member (confirmed with the user) -- the only check is that the
// target is actually in your group, not a random user id from elsewhere.
async function assertGroupMember(userId: string) {
  const { group } = await requireUserAndGroup();
  const target = await prisma.groupMember.findFirst({ where: { groupId: group.id, userId } });
  if (!target) throw new Error("That person isn't in your group.");
}

export async function updateName(userId: string, name: string): Promise<ActionResult> {
  await assertGroupMember(userId);
  const trimmed = name.trim();
  if (!trimmed) return { error: "Name can't be empty." };

  await prisma.user.update({ where: { id: userId }, data: { name: trimmed } });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/leaderboard");
}

export async function updateFlair(userId: string, flair: string | null): Promise<void> {
  await assertGroupMember(userId);

  await prisma.user.update({ where: { id: userId }, data: { flair } });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/leaderboard");
}

// Deliberately does not accept a new PIN from the caller -- clearing pinHash routes the
// person back through the existing claimPin flow (app/login/actions.ts) next sign-in, so
// nobody but the account owner ever sets or sees their own PIN.
export async function resetPin(userId: string): Promise<void> {
  await assertGroupMember(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { pinHash: null, failedLoginAttempts: 0, lockedUntil: null },
  });
  revalidatePath("/admin");
}

export async function unlockUser(userId: string): Promise<void> {
  await assertGroupMember(userId);

  await prisma.user.update({
    where: { id: userId },
    data: { failedLoginAttempts: 0, lockedUntil: null },
  });
  revalidatePath("/admin");
}
