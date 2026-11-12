export {
  AccountDisabledError,
  AuthenticationError,
  InvalidCredentialsError,
  InvalidTokenError,
  SessionExpiredError,
  SessionRevokedError,
  TokenExpiredError,
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
  LEGACY_SESSION_COOKIE_NAME,
  CUSTOMER_SESSION_COOKIE_NAME,
  type SessionCookieOptions,
  getStoreCustomerSessionCookieName,
  extractSessionIdFromCookie,
  extractCustomerSessionIdFromCookie,
  getSessionCookieOptions,
  serializeExpiredSessionCookie,
  serializeSessionCookie,
  serializeCustomerSessionCookie,
  serializeExpiredCustomerSessionCookie,
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
  consumeEmailVerificationToken,
  createEmailVerificationToken,
  createPasswordResetToken,
  generateSecureToken,
  hashToken,
  isUserEmailVerified,
  login,
  logout,
  logoutAll,
  register,
  resetPasswordWithToken,
  updateUserProfile,
} from "./service/auth-service.js";

export {
  ApiKeyService,
  type GeneratedApiKey,
  type VerifiedApiKeyContext,
} from "./api-keys/api-key-service.js";
