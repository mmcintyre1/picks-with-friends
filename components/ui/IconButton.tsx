import type { ButtonHTMLAttributes, ReactNode } from "react";

import { Button } from "./Button";

type Size = "sm" | "md";

// Adds height/width on top of Button's own "sm" padding rather than overriding padding --
// stacking a second, conflicting padding utility risks losing depending on Tailwind's
// generated CSS order, not source order (a real gotcha already hit once in this project).
// Fixed height/width plus Button's own flex-centering keeps the icon centered regardless.
const sizeClass: Record<Size, string> = {
  sm: "h-9 w-9",
  md: "h-10 w-10",
};

// A square, icon-only wrapper around Button -- replaces the hand-rolled
// `rounded-md border border-border-strong p-2` icon buttons scattered across the pick flow
// (change-game/clear-bet-details, edit-pick) with one consistent hover/lift treatment and a
// tap target that comfortably clears ~40px on mobile regardless of the icon's own size.
export function IconButton({
  icon,
  size = "md",
  variant = "secondary",
  title,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: ReactNode;
  size?: Size;
  variant?: "secondary" | "ghost";
}) {
  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      title={title}
      aria-label={title}
      className={`${sizeClass[size]} ${className}`}
      {...props}
    >
      {icon}
    </Button>
  );
}
