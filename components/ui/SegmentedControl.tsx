"use client";

type Option<T extends string> = { value: T; label: string; activeClassName?: string };

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  name,
  size = "md",
  className = "",
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: Option<T>[];
  name?: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={`inline-flex flex-wrap gap-1 rounded-lg border border-border bg-card p-1 ${className}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={`rounded-md font-display tracking-wide transition-colors ${
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"
            } ${active ? (opt.activeClassName ?? "bg-accent text-accent-foreground") : "text-muted hover:text-foreground"}`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
