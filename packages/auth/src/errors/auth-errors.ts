export class AuthenticationError extends Error {
  readonly code: string;

  constructor(message: string, code: string = "AUTHENTICATION_FAILED") {
    super(message);
    this.name = "AuthenticationError";
    this.code = code;
  }
}

export class InvalidCredentialsError extends AuthenticationError {
  constructor() {
    super("Invalid email or password", "INVALID_CREDENTIALS");
    this.name = "InvalidCredentialsError";
  }
}

export class SessionExpiredError extends AuthenticationError {
  constructor() {
    super("Session has expired", "SESSION_EXPIRED");
    this.name = "SessionExpiredError";
  }
}

export class SessionRevokedError extends AuthenticationError {
  constructor() {
    super("Session has been revoked", "SESSION_REVOKED");
    this.name = "SessionRevokedError";
  }
}

export class AccountDisabledError extends AuthenticationError {
  constructor() {
    super("Account is disabled", "ACCOUNT_DISABLED");
    this.name = "AccountDisabledError";
  }
}

export class UserAlreadyExistsError extends AuthenticationError {
  constructor() {
    super("An account with this email already exists", "USER_ALREADY_EXISTS");
    this.name = "UserAlreadyExistsError";
  }
}
