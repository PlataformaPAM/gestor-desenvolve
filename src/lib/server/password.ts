import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { validatePasswordPolicy as validatePasswordPolicyImpl } from "@/lib/password-policy";

const KEY_LEN = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, KEY_LEN).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = parts[1];
  const hash = parts[2];
  const derived = scryptSync(password, salt, KEY_LEN);
  const target = Buffer.from(hash, "hex");
  if (derived.length !== target.length) return false;
  return timingSafeEqual(derived, target);
}

export const validatePasswordPolicy = validatePasswordPolicyImpl;

