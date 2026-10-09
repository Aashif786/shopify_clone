import type { ReactNode } from "react";

export type AlertVariant = "info" | "success" | "warning" | "danger";

export interface AlertProps {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}

export function Alert({
  variant = "info",
  title,
  children,
  action,
  onDismiss,
  className = "",
}: AlertProps) {
  const role = variant === "danger" ? "alert" : "status";

  return (
    <div
      role={role}
      className={`alert alert--${variant} ${className}`.trim()}
    >
      <div className="alert__content">
        {title && <strong className="alert__title">{title}</strong>}
        <div className="alert__message">{children}</div>
      </div>
      {action && <div className="alert__action">{action}</div>}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="btn btn--ghost btn--sm alert__dismiss"
          aria-label="Dismiss alert"
        >
          ✕
        </button>
      )}
    </div>
  );
}
