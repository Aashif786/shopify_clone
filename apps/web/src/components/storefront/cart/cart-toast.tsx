"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Spinner } from "@calcart/ui";
import { Check, AlertCircle, Info, X } from "lucide-react";

export type CartToastStatus = "loading" | "success" | "error" | "info";

export interface CartToastAction {
  label: string;
  onClick: () => void;
}

export interface CartToastItem {
  id: string;
  status: CartToastStatus;
  message: string;
  description?: string;
  duration?: number;
  action?: CartToastAction;
  timestamp: number;
}

export interface CartToastInput {
  id?: string;
  status: CartToastStatus;
  message: string;
  description?: string;
  duration?: number;
  action?: CartToastAction;
}

export interface CartToastContainerProps {
  toasts: CartToastItem[];
  onDismiss: (id: string) => void;
}

export function CartToastContainer({ toasts, onDismiss }: CartToastContainerProps) {
  return (
    <div
      className="cart-toast-viewport fixed bottom-4 inset-x-4 sm:bottom-6 sm:right-6 sm:left-auto sm:inset-x-auto z-[70] pointer-events-none flex flex-col items-center sm:items-end gap-2 max-w-sm w-full"
      role="region"
      aria-label="Cart Notifications"
      aria-live="polite"
      aria-atomic="false"
      data-testid="cart-toast-viewport"
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {toasts.map((toast) => (
          <CartToastCard key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface CartToastCardProps {
  toast: CartToastItem;
  onDismiss: (id: string) => void;
}

export function CartToastCard({ toast, onDismiss }: CartToastCardProps) {
  const isError = toast.status === "error";

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className={`cart-toast-card pointer-events-auto flex items-center gap-3 px-4 py-3 border w-full sm:w-auto sm:min-w-[280px] max-w-sm ${
        isError
          ? "bg-background border-destructive text-destructive"
          : "bg-background border-foreground text-foreground"
      }`}
      role={isError ? "alert" : "status"}
      data-testid={`cart-toast-${toast.id}`}
    >
      {/* Dynamic Status Icon */}
      <div className="cart-toast-icon shrink-0 flex items-center justify-center">
        {toast.status === "loading" && (
          <Spinner size="sm" className="shrink-0" />
        )}
        {toast.status === "success" && (
          <div className="w-5 h-5 text-foreground flex items-center justify-center shrink-0">
            <Check size={15} strokeWidth={1.75} />
          </div>
        )}
        {toast.status === "error" && (
          <div className="w-5 h-5 text-destructive flex items-center justify-center shrink-0">
            <AlertCircle size={13} strokeWidth={2.5} />
          </div>
        )}
        {toast.status === "info" && (
          <div className="w-5 h-5 text-foreground flex items-center justify-center shrink-0">
            <Info size={13} strokeWidth={2.5} />
          </div>
        )}
      </div>

      {/* Message & Optional Description */}
      <div className="cart-toast-content flex-1 min-w-0 pr-1">
        <p className="cart-toast-message text-sm text-foreground leading-snug">
          {toast.message}
        </p>
        {toast.description && (
          <p className="cart-toast-description text-[11px] text-muted-foreground mt-0.5 leading-snug">
            {toast.description}
          </p>
        )}
      </div>

      {/* Optional Action Button */}
      {toast.action && (
        <button
          type="button"
          onClick={toast.action.onClick}
          className="cart-toast-action at-link text-xs text-foreground shrink-0"
          data-testid="cart-toast-action-btn"
        >
          {toast.action.label}
        </button>
      )}

      {/* Dismiss Button */}
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="cart-toast-close text-muted-foreground hover:text-foreground p-2 -mr-2 shrink-0"
        aria-label="Dismiss notification"
        data-testid={`cart-toast-dismiss-${toast.id}`}
      >
        <X size={14} />
      </button>
    </motion.div>
  );
}
