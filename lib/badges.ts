import { Badge } from "@/app/generated/prisma/enums";

export const BADGE_EMOJI: Record<Badge, string> = {
  [Badge.NONE]: "",
  [Badge.MONEYBAG]: "💰",
  [Badge.POO]: "💩",
  [Badge.TOILET]: "🚽",
  [Badge.CROSS]: "✝️",
};

export const BADGE_LABEL: Record<Badge, string> = {
  [Badge.NONE]: "",
  [Badge.MONEYBAG]: "Money bag",
  [Badge.POO]: "Poo",
  [Badge.TOILET]: "Toilet",
  [Badge.CROSS]: "Jesus cross",
};
