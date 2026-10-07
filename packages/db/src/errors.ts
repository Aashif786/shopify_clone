export class DatabaseUnavailableError extends Error {
  constructor() {
    super("Database is unavailable");
    this.name = "DatabaseUnavailableError";
  }
}

export function toSafeDatabaseError(error: unknown): Error {
  if (error instanceof DatabaseUnavailableError) {
    return error;
  }

  return new DatabaseUnavailableError();
}
