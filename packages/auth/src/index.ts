export {
  AccountDisabledError,
  AuthenticationError,
  InvalidCredentialsError,
  SessionExpiredError,
  SessionRevokedError,
  UserAlreadyExistsError,
} from "./errors/auth-errors.js";

export {
  DUMMY_PASSWORD_HASH,
  hashPassword,
  verifyPassword,
} from "./credentials/password.js";

export {
  type PasswordPolicyResult,
  isValidEmailFormat,
  normalizeEmail,
  validatePasswordPolicy,
} from "./credentials/validation.js";

export {
  DEFAULT_SESSION_COOKIE_NAME,
  type SessionCookieOptions,
  extractSessionIdFromCookie,
  getSessionCookieOptions,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
} from "./sessions/cookie.js";

export {
  DEFAULT_SESSION_TTL_MS,
  type AuthenticatedUser,
  type Session,
  type ValidatedSession,
  cleanupExpiredSessions,
  createSession,
  revokeAllUserSessions,
  revokeSession,
  validateSession,
} from "./sessions/session-service.js";

export {
  type AuthContext,
  resolveAuthContext,
} from "./context/auth-context.js";

export {
  type AuthResult,
  type LoginInput,
  type RegisterInput,
  changePassword,
  login,
  logout,
  logoutAll,
  register,
} from "./service/auth-service.js";
