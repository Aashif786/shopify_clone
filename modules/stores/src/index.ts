export {
  type StoreStatus,
  type MembershipStatus,
  type InvitationStatus,
  type Organization,
  type OrganizationMembership,
  type Store,
  type StoreSettings,
  type StoreMembership,
  type StoreInvitation,
  type StoreWithSettings,
  type StoreDomain,
  type StoreDomainType,
  type StoreDomainStatus,
  type StoreDomainSslStatus,
  type StoreDnsInstruction,
  type StoreVerificationChallenge,
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
  InvitationNotFoundError,
  InvitationExpiredError,
  InvitationAlreadyAcceptedError,
  InvitationRevokedError,
  DomainConflictError,
  InvalidDomainError,
  DomainNotVerifiedError,
  CannotDeleteDefaultSubdomainError,
  DomainNotFoundError,
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
export { DomainProvider } from "./infrastructure/domain-provider.js";
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
  CreateStoreInvitationInput,
  StoreInvitationDTO,
  StoreInvitationWithTokenDTO,
  InvitationDetailsDTO,
  StoreDomainDTO,
  StoreDomainsResponseDTO,
  StoreDnsInstructionDTO,
  StoreVerificationChallengeDTO,
  AddCustomDomainInput,
  VerifyDomainResultDTO,
  SetPrimaryDomainResultDTO,
} from "./application/dtos.js";

export {
  type SectionType,
  type ColorPresetId,
  type ColorTokens,
  type BackgroundConfig,
  type TypographyTokens,
  type ButtonTokens,
  type AnimationTokens,
  type LandingPageTheme,
  type SectionAnimationConfig,
  type SectionStyleConfig,
  type CarouselSlide,
  type LandingPageSection,
  type StorefrontLandingPageConfig,
  type StorefrontLandingPageRecord,
  type StorefrontLandingPageDTO,
  COLOR_PRESETS,
  createDefaultLandingPageConfig,
} from "./domain/landing-page.js";
