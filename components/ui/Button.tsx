import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md";

const base =
  "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50";

const variantClass: Record<Variant, string> = {
  primary: "bg-accent text-accent-foreground hover:brightness-110",
  secondary: "border border-border-strong text-foreground hover:bg-card-elevated",
  ghost: "text-muted hover:text-foreground",
  destructive: "border border-loss/40 text-loss hover:bg-loss/10",
};

const sizeClass: Record<Size, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-4 py-2 text-sm",
};

// Exposed so non-<button> elements (e.g. a Next.js <Link> styled as a primary CTA) can
// share the exact same look without nesting an actual <button> inside an <a>.
export function buttonClassName(variant: Variant = "primary", size: Size = "md", className = "") {
  return `${base} ${variantClass[variant]} ${sizeClass[size]} ${className}`;
}

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClassName(variant, size, className)} {...props} />;
}
