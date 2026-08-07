import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;

// 6-8 digits (900k-100M combos) instead of 4, since a shorter PIN is brute-forceable
// in seconds by a script with no rate limiting.
export const PIN_PATTERN = /^\d{6,8}$/;

// Paired with the pattern above: length alone doesn't stop a scripted attacker with no
// throttling, so a wrong PIN this many times in a row locks the account out for a cooldown.
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;

export function hashPin(pin: string) {
  return bcrypt.hash(pin, SALT_ROUNDS);
}

export function verifyPin(pin: string, hash: string) {
  return bcrypt.compare(pin, hash);
}
