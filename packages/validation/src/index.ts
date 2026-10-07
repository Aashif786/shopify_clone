export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  errors: ValidationError[];
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

export interface Validator<T> {
  validate(input: unknown): ValidationResult<T>;
}
