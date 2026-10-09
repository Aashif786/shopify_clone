import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "./Button.js";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        aria-describedby={description ? "dialog-desc" : undefined}
        className={`modal modal--${size}`}
      >
        <div className="modal__header">
          <div className="modal__header-text">
            <h2 id="dialog-title" className="modal__title">
              {title}
            </h2>
            {description && (
              <p id="dialog-desc" className="modal__description">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            className="btn btn--ghost btn--sm modal__close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal__body">{children}</div>

        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  );
}

export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  isLoading = false,
}: ConfirmationDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      description={description}
      size="sm"
      footer={
        <div className="modal__footer-actions" style={{ display: "flex", gap: "var(--space-2)" }}>
          <Button
            variant="outline"
            size="md"
            onClick={onClose}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "danger" : "primary"}
            size="md"
            onClick={onConfirm}
            disabled={isLoading}
            loading={isLoading}
          >
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <p className="confirm-body-text">{description}</p>
    </Dialog>
  );
}
