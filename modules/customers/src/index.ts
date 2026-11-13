// Domain entities
export {
  type Customer,
  type CustomerStatus,
  VALID_CUSTOMER_STATUSES,
  VALID_CUSTOMER_TRANSITIONS,
  isValidCustomerStatus,
  isValidCustomerTransition,
  assertValidCustomerTransition,
} from "./domain/entities/customer.js";

export { type CustomerAddress } from "./domain/entities/address.js";
export { type CustomerWishlistItem } from "./domain/entities/wishlist.js";

// Domain errors
export {
  CustomerDomainError,
  CustomerNotFoundError,
  CustomerAccessDeniedError,
  CrossStoreCustomerAccessError,
  DuplicateCustomerError,
  CustomerAlreadyExistsError,
  InvalidCustomerEmailError,
  InvalidCustomerStatusError,
  InvalidCustomerStateTransitionError,
  AddressNotFoundError,
  AddressAccessDeniedError,
  CrossStoreAddressAccessError,
  InvalidAddressError,
  DefaultAddressConflictError,
  InvalidCustomerUserError,
} from "./domain/errors.js";

// Domain validation
export {
  normalizeEmail,
  isValidEmailFormat,
  validateCustomerEmail,
  validateCustomerStatus,
  validateCustomerName,
  validateCustomerPhone,
  validateAddressLine,
  validateOptionalAddressLine,
  validateCity,
  validateState,
  validatePostalCode,
  validateCountryCode,
} from "./domain/validation.js";

// Application DTOs
export {
  type CustomerDTO,
  type CustomerAddressDTO,
  type CustomerWithAddressesDTO,
  type CreateCustomerInput,
  type UpdateCustomerInput,
  type ListCustomersInput,
  type CustomerListDTO,
  type CreateCustomerAddressInput,
  type RememberCustomerAddressInput,
  type UpdateCustomerAddressInput,
  type WishlistItemDTO,
  type AddWishlistItemInput,
  type MergeWishlistInput,
} from "./application/dtos.js";

// Application Services
export {
  CustomerService,
  type CustomerOrderSummaryProvider,
} from "./application/customer-service.js";
export { WishlistService } from "./application/wishlist-service.js";

// Infrastructure Repositories
export {
  CustomerRepository,
  type ListCustomersRepoOptions,
  type ListCustomersRepoResult,
} from "./infrastructure/customer-repository.js";
export { WishlistRepository } from "./infrastructure/wishlist-repository.js";


// Newsletter
export {
  type NewsletterSubscriber,
  type NewsletterSubscriberStatus,
  VALID_NEWSLETTER_STATUSES,
} from "./domain/entities/newsletter-subscriber.js";
export {
  type NewsletterSubscriberDTO,
  type SubscribeNewsletterInput,
  type SubscribeNewsletterResultDTO,
  type ListNewsletterSubscribersFilter,
  type NewsletterSubscriberListDTO,
} from "./application/dtos.js";
export { NewsletterService } from "./application/newsletter-service.js";
export {
  NewsletterRepository,
  type UpsertSubscriberResult,
} from "./infrastructure/newsletter-repository.js";
