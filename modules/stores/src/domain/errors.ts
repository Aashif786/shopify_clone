export class StoreDomainError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    status: number = 400,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export class StoreNotFoundError extends StoreDomainError {
  constructor(message: string = "Store not found", details?: unknown) {
    super(message, "STORE_NOT_FOUND", 404, details);
  }
}

export class DuplicateStoreSlugError extends StoreDomainError {
  constructor(slug: string) {
    super(
      `Store slug '${slug}' is already in use`,
      "STORE_SLUG_ALREADY_EXISTS",
      409,
      { slug },
    );
  }
}

export class InvalidStoreStatusTransitionError extends StoreDomainError {
  constructor(fromStatus: string, toStatus: string) {
    super(
      `Cannot transition store from status '${fromStatus}' to '${toStatus}'`,
      "INVALID_STORE_STATUS_TRANSITION",
      400,
      { fromStatus, toStatus },
    );
  }
}

export class StoreSuspendedError extends StoreDomainError {
  constructor(message: string = "Store is currently suspended") {
    super(message, "STORE_SUSPENDED", 403);
  }
}

export class StoreArchivedError extends StoreDomainError {
  constructor(
    message: string = "Store is archived and cannot perform this operation",
  ) {
    super(message, "STORE_ARCHIVED", 403);
  }
}

export class CannotRemoveLastOwnerError extends StoreDomainError {
  constructor(
    message: string = "Cannot remove or demote the last remaining active owner of the store",
  ) {
    super(message, "CANNOT_REMOVE_LAST_OWNER", 400);
  }
}

export class MembershipNotFoundError extends StoreDomainError {
  constructor(message: string = "Store membership not found") {
    super(message, "MEMBERSHIP_NOT_FOUND", 404);
  }
}

export class MembershipAlreadyExistsError extends StoreDomainError {
  constructor(message: string = "User already has a membership in this store") {
    super(message, "MEMBERSHIP_ALREADY_EXISTS", 409);
  }
}

export class InsufficientStorePermissionError extends StoreDomainError {
  constructor(
    message: string = "Insufficient permissions for this store operation",
  ) {
    super(message, "INSUFFICIENT_STORE_PERMISSION", 403);
  }
}

export class OrganizationNotFoundError extends StoreDomainError {
  constructor(message: string = "Organization not found") {
    super(message, "ORGANIZATION_NOT_FOUND", 404);
  }
}

export class OrganizationAccessDeniedError extends StoreDomainError {
  constructor(message: string = "Access denied to organization") {
    super(message, "ORGANIZATION_ACCESS_DENIED", 403);
  }
}

export class ImmutableFieldError extends StoreDomainError {
  constructor(field: string, reason: string) {
    super(
      `Cannot modify immutable field '${field}': ${reason}`,
      "IMMUTABLE_FIELD_ERROR",
      400,
      {
        field,
        reason,
      },
    );
  }
}

export class InvitationNotFoundError extends StoreDomainError {
  constructor(message: string = "Invitation not found") {
    super(message, "INVITATION_NOT_FOUND", 404);
  }
}

export class InvitationExpiredError extends StoreDomainError {
  constructor(message: string = "Invitation has expired") {
    super(message, "INVITATION_EXPIRED", 400);
  }
}

export class InvitationAlreadyAcceptedError extends StoreDomainError {
  constructor(message: string = "Invitation has already been accepted") {
    super(message, "INVITATION_ALREADY_ACCEPTED", 409);
  }
}

export class InvitationRevokedError extends StoreDomainError {
  constructor(message: string = "Invitation has been revoked") {
    super(message, "INVITATION_REVOKED", 400);
  }
}
