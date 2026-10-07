const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmailFormat(email: string): boolean {
  const normalized = normalizeEmail(email);
  return EMAIL_REGEX.test(normalized);
}

export interface PasswordPolicyResult {
  valid: boolean;
  reason?: string;
}

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  if (!password || typeof password !== "string") {
    return {
      valid: false,
      reason: "Password is required",
    };
  }

  if (password.length < 8) {
    return {
      valid: false,
      reason: "Password must be at least 8 characters long",
    };
  }

  if (password.length > 128) {
    return {
      valid: false,
      reason: "Password must not exceed 128 characters",
    };
  }

  return { valid: true };
}
