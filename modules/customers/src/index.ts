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
  type UpdateCustomerAddressInput,
} from "./application/dtos.js";

// Application Service
export { CustomerService } from "./application/customer-service.js";

// Infrastructure Repository
export {
  CustomerRepository,
  type ListCustomersRepoOptions,
  type ListCustomersRepoResult,
} from "./infrastructure/customer-repository.js";
