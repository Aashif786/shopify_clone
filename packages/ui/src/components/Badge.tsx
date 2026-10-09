import * as React from "react";

export type BadgeVariant = "neutral" | "success" | "warning" | "danger" | "info";
export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
}

export function Badge({
  variant = "neutral",
  size = "md",
  className = "",
  children,
  ...props
}: BadgeProps): React.ReactElement {
  const classNames = ["badge", `badge--${variant}`, `badge--${size}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classNames} {...props}>
      {children}
    </span>
  );
}
