/** Regras de senha (sem Node crypto) — pode ser usado no client e no server. */
export function validatePasswordPolicy(password: string): { valid: true } | { valid: false; message: string } {
  if (password.length < 8) return { valid: false, message: "A senha deve ter no mínimo 8 caracteres." };
  if (!/[A-Z]/.test(password)) return { valid: false, message: "A senha deve conter ao menos 1 letra maiúscula." };
  if (!/[a-z]/.test(password)) return { valid: false, message: "A senha deve conter ao menos 1 letra minúscula." };
  if (!/[0-9]/.test(password)) return { valid: false, message: "A senha deve conter ao menos 1 número." };
  return { valid: true };
}
