"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPin, PIN_PATTERN } from "@/lib/pin";

export type ActionState = { error: string } | null;

// `callbackUrl` comes from a query param on the login page (see lib/session.ts's
// requireUserAndGroup), so it's attacker-controllable -- someone could craft a link like
// /login?callbackUrl=https://evil.example and use this app to redirect a signed-in
// session somewhere else (open redirect). Only ever trust it as a same-origin relative
// path: must start with a single "/", never "//" (protocol-relative) or contain "://".
function safeRedirectTarget(callbackUrl: string | undefined): string {
  if (callbackUrl && callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") && !callbackUrl.includes("://")) {
    return callbackUrl;
  }
  return "/";
}

export async function loginWithPin(
  username: string,
  callbackUrl: string | undefined,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const pin = String(formData.get("pin") ?? "");

  // Pre-check purely for a friendlier message -- auth.ts's authorize() is the actual
  // enforcement boundary and will refuse the sign-in regardless of what happens here.
  const user = await prisma.user.findUnique({ where: { username } });
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000);
    return { error: `Too many wrong guesses. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.` };
  }

  try {
    await signIn("credentials", { username, pin, redirectTo: safeRedirectTarget(callbackUrl) });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Wrong PIN. Try again." };
    }
    throw error;
  }
  return null;
}

export async function claimPin(
  username: string,
  callbackUrl: string | undefined,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const pin = String(formData.get("pin") ?? "");
  const confirmPin = String(formData.get("confirmPin") ?? "");

  if (!PIN_PATTERN.test(pin)) {
    return { error: "PIN must be 6-8 digits." };
  }
  if (pin !== confirmPin) {
    return { error: "PINs don't match." };
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || user.pinHash) {
    return { error: "Someone already claimed that username." };
  }

  await prisma.user.update({
    where: { username },
    data: { pinHash: await hashPin(pin) },
  });

  try {
    await signIn("credentials", { username, pin, redirectTo: safeRedirectTarget(callbackUrl) });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "PIN's saved, but sign-in hiccuped — try again." };
    }
    throw error;
  }
  return null;
}
