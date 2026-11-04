export class PlatformAuthError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string = "AUTHENTICATION_FAILED", statusCode: number = 401) {
    super(message);
    this.name = "PlatformAuthError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InvalidCredentialsError extends PlatformAuthError {
  constructor(message: string = "Invalid platform administrator credentials.") {
    super(message, "INVALID_CREDENTIALS", 401);
    this.name = "InvalidCredentialsError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AccountLockedError extends PlatformAuthError {
  readonly remainingMinutes: number;
  readonly lockedUntil?: Date;

  constructor(remainingMinutes: number, lockedUntil?: Date) {
    super(
      `Account is temporarily locked due to multiple failed login attempts. Try again in ${remainingMinutes} minute(s).`,
      "ACCOUNT_LOCKED",
      423
    );
    this.name = "AccountLockedError";
    this.remainingMinutes = remainingMinutes;
    this.lockedUntil = lockedUntil;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class InsufficientPlatformPrivilegesError extends PlatformAuthError {
  constructor(message: string = "Invalid platform administrator credentials.") {
    // Return identical user-facing message to prevent email enumeration between normal users and platform admins
    super(message, "INVALID_CREDENTIALS", 401);
    this.name = "InsufficientPlatformPrivilegesError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
