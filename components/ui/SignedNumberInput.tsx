"use client";

// A +/- toggle next to a plain numeric input, so the regular numpad keyboard works on every
// device -- phone numeric keypads (iOS especially) often have no minus key at all, which
// made typing negative odds or spreads impossible or forced a full text keyboard.
//
// The value stays one signed string ("-110", "150", "-3.5") so callers/servers keep parsing it
// with plain Number(). "+" alone is the one extra state: an empty magnitude with a positive
// sign chosen, only needed when `defaultNegative` would otherwise read an empty value as
// negative.
export function SignedNumberInput({
  value,
  onChange,
  placeholder,
  decimal = false,
  defaultNegative = false,
  required = false,
  inputClassName,
  toggleClassName,
  label,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  decimal?: boolean;
  // What sign an untouched empty field shows -- odds default negative (-110 is the norm),
  // a spread line does too since favorites are the common case.
  defaultNegative?: boolean;
  required?: boolean;
  inputClassName?: string;
  toggleClassName?: string;
  // Accessible name for the field, e.g. "Odds" -- the toggle announces it too.
  label: string;
}) {
  const negative = value.startsWith("-") || (value === "" && defaultNegative);
  const magnitude = value.replace(/^[+-]/, "");

  function emit(nextNegative: boolean, nextMagnitude: string) {
    if (nextNegative) onChange(`-${nextMagnitude}`);
    else onChange(nextMagnitude === "" && defaultNegative ? "+" : nextMagnitude);
  }

  function handleInput(raw: string) {
    // A typed "-"/"+" (desktop keyboards) flips the sign instead of being rejected.
    const nextNegative = raw.includes("-") ? true : raw.includes("+") ? false : negative;
    let digits = raw.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, "");
    if (decimal) {
      const firstDot = digits.indexOf(".");
      if (firstDot !== -1) digits = digits.slice(0, firstDot + 1) + digits.slice(firstDot + 1).replace(/\./g, "");
    }
    emit(nextNegative, digits);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => emit(!negative, magnitude)}
        aria-label={`${label}: ${negative ? "negative" : "positive"} -- tap to switch`}
        className={
          toggleClassName ??
          "flex w-12 shrink-0 items-center justify-center bg-transparent font-display text-xl leading-none text-accent hover:bg-white/[0.05] focus:bg-white/[0.05] focus:outline-none"
        }
      >
        {negative ? "−" : "+"}
      </button>
      <input
        value={magnitude}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        inputMode={decimal ? "decimal" : "numeric"}
        aria-label={label}
        className={inputClassName}
      />
    </>
  );
}
