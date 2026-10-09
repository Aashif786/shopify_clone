import React from "react";

export interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  label?: string;
  className?: string;
}

export function Spinner({
  size = "md",
  label = "Loading...",
  className = "",
}: SpinnerProps) {
  return (
    <div
      role="status"
      className={`spinner spinner-${size} ${className}`.trim()}
      aria-label={label}
    >
      <span className="sr-only">{label}</span>
    </div>
  );
}

export interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
}

export function Skeleton({
  width,
  height,
  borderRadius,
  className = "",
}: SkeletonProps) {
  const style: React.CSSProperties = {
    width: typeof width === "number" ? `${width}px` : width,
    height: typeof height === "number" ? `${height}px` : height,
    borderRadius:
      typeof borderRadius === "number" ? `${borderRadius}px` : borderRadius,
  };

  return (
    <div
      aria-hidden="true"
      className={`skeleton ${className}`.trim()}
      style={style}
    />
  );
}
