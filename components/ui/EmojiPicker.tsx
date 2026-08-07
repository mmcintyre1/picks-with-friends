"use client";

// A fixed grid rather than free text entry -- guarantees flair always renders as one
// glyph and keeps the picker fun/fast to use, matching the "roast your friends" intent.
const EMOJI_OPTIONS = [
  "🤡", "💀", "🐐", "🔥", "🧊", "🤦", "🐍", "🦃",
  "🍀", "😅", "🎯", "💰", "💩", "🚽", "🐢", "🦥",
  "🎲", "🃏", "🏈", "🧠", "🫠", "🙈", "🥴", "😬",
];

const cellClass = (active: boolean) =>
  `flex h-10 w-10 items-center justify-center rounded-lg border text-lg transition-colors ${
    active ? "border-accent bg-accent/15" : "border-border hover:border-border-strong"
  }`;

export function EmojiPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (emoji: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button type="button" title="No flair" onClick={() => onChange(null)} className={cellClass(!value)}>
        <span className="text-sm text-muted">∅</span>
      </button>
      {EMOJI_OPTIONS.map((emoji) => (
        <button key={emoji} type="button" onClick={() => onChange(emoji)} className={cellClass(value === emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
