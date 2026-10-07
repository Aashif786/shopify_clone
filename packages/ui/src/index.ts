import * as React from "react";

export interface ButtonProps {
  children?: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

export function Button({
  children,
  disabled,
  onClick,
  type = "button",
}: ButtonProps): React.ReactElement {
  return React.createElement(
    "button",
    {
      type,
      disabled,
      onClick,
    },
    children
  );
}
