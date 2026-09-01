"use client";

type Option<T extends string> = { value: T; label: string; activeClassName?: string };

export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  name,
  size = "md",
  scroll = false,
  className = "",
}: {
  value: T | null;
  onChange: (value: T) => void;
  options: Option<T>[];
  name?: string;
  size?: "sm" | "md";
  // Swaps wrapping for horizontal scrolling -- for a tab bar that can grow past what fits
  // on one line (e.g. a game's category tabs), matching a real sportsbook's scrollable top
  // tab row instead of wrapping into uneven extra lines.
  scroll?: boolean;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      className={`gap-1 rounded-lg border border-border bg-card p-1 ${
        // inline-flex sizes to its content, so overflow-x-auto never actually engages --
        // scroll mode needs `flex w-full`, and *also* min-w-0: a flex item's min-width
        // defaults to `auto` (its content's intrinsic width), which silently overrides
        // `w-full` and lets it grow past its flex-col parent's bounds anyway unless
        // min-w-0 explicitly permits shrinking below that.
        // The mask-image edge-fade is the missing "more tabs this way" cue -- without it,
        // scrollable content just hard-clips at the container's rounded border with zero
        // sign anything is off-screen, which read as an abrupt/unpolished cutoff.
        scroll
          ? "flex w-full min-w-0 max-w-full flex-nowrap overflow-x-auto [mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]"
          : "inline-flex flex-wrap"
      } ${className}`}
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
            className={`rounded-md border font-display tracking-wide transition-colors ${
              scroll ? "shrink-0 whitespace-nowrap" : ""
            } ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm"} ${
              active
                ? `border-transparent ${opt.activeClassName ?? "bg-accent text-accent-foreground"}`
                : "border-transparent text-muted hover:border-accent hover:bg-accent/10 hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
