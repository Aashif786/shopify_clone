export {
  type StoreStatus,
  type MembershipStatus,
  type Organization,
  type OrganizationMembership,
  type Store,
  type StoreSettings,
  type StoreMembership,
  type StoreWithSettings,
} from "./domain/entities.js";

export {
  StoreDomainError,
  StoreNotFoundError,
  DuplicateStoreSlugError,
  InvalidStoreStatusTransitionError,
  StoreSuspendedError,
  StoreArchivedError,
  CannotRemoveLastOwnerError,
  MembershipNotFoundError,
  MembershipAlreadyExistsError,
  InsufficientStorePermissionError,
  OrganizationNotFoundError,
  OrganizationAccessDeniedError,
  ImmutableFieldError,
} from "./domain/errors.js";

export {
  isValidStoreTransition,
  assertValidStoreTransition,
  isValidMembershipTransition,
  assertValidMembershipTransition,
} from "./domain/lifecycle.js";

export {
  normalizeSlug,
  isValidSlugFormat,
  isValidCurrency,
  isValidLocale,
  isValidTimezone,
  isValidStoreRole,
  isValidEmail,
  validateStoreInput,
  type ValidateStoreInputOptions,
} from "./domain/validation.js";

export { StoreRepository } from "./infrastructure/store-repository.js";

export { StoreService } from "./application/store-service.js";

export type {
  CreateStoreInput,
  UpdateStoreInput,
  StoreSummaryDTO,
  StoreSettingsDTO,
  StoreDetailDTO,
  StoreMemberDTO,
  AddStoreMemberInput,
  UpdateStoreMemberInput,
} from "./application/dtos.js";
