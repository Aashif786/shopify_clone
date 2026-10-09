import * as React from "react";

export interface FormFieldProps {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  error?: string | null;
  helperText?: string | null;
  children: React.ReactNode;
  className?: string;
}

export function FormField({
  label,
  htmlFor,
  required = false,
  error,
  helperText,
  children,
  className = "",
}: FormFieldProps): React.ReactElement {
  const errorId = htmlFor ? `${htmlFor}-error` : undefined;
  const helperId = htmlFor ? `${htmlFor}-helper` : undefined;

  return (
    <div className={`form-field ${className}`.trim()}>
      {label && (
        <label htmlFor={htmlFor} className="form-label">
          <span>{label}</span>
          {required && (
            <span className="form-label__required" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {children}

      {error ? (
        <div id={errorId} className="form-error" role="alert">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </div>
      ) : helperText ? (
        <div id={helperId} className="form-helper">
          {helperText}
        </div>
      ) : null}
    </div>
  );
}
