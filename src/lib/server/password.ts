import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

export function validatePasswordPolicy(password: string): { valid: true } | { valid: false; message: string } {
  if (password.length < 8) return { valid: false, message: "A senha deve ter no mínimo 8 caracteres." };
  if (!/[A-Z]/.test(password)) return { valid: false, message: "A senha deve conter ao menos 1 letra maiúscula." };
  if (!/[a-z]/.test(password)) return { valid: false, message: "A senha deve conter ao menos 1 letra minúscula." };
  if (!/[0-9]/.test(password)) return { valid: false, message: "A senha deve conter ao menos 1 número." };
  return { valid: true };
}

