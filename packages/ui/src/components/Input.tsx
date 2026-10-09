import * as React from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ error = false, className = "", ...props }, ref) => {
    const classNames = ["input", error ? "input--error" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <input
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        className={classNames}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ error = false, className = "", rows = 3, ...props }, ref) => {
    const classNames = ["textarea", error ? "textarea--error" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={error ? "true" : undefined}
        className={classNames}
        {...props}
      />
    );
  },
);

Textarea.displayName = "Textarea";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  options?: Array<{ label: string; value: string; disabled?: boolean }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ error = false, className = "", children, options, ...props }, ref) => {
    const classNames = ["select", error ? "select--error" : "", className]
      .filter(Boolean)
      .join(" ");

    return (
      <select
        ref={ref}
        aria-invalid={error ? "true" : undefined}
        className={classNames}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                {opt.label}
              </option>
            ))
          : children}
      </select>
    );
  },
);

Select.displayName = "Select";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: React.ReactNode;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ label, id, className = "", ...props }, ref) => {
    const inputId = id ?? (label && typeof label === "string" ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

    const checkboxElement = (
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className={`checkbox ${className}`.trim()}
        {...props}
      />
    );

    if (label) {
      return (
        <label htmlFor={inputId} className="checkbox-label">
          {checkboxElement}
          <span>{label}</span>
        </label>
      );
    }

    return checkboxElement;
  },
);

Checkbox.displayName = "Checkbox";
