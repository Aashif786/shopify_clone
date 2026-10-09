import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  bordered?: boolean;
}

export function Card({
  bordered = true,
  className = "",
  children,
  ...props
}: CardProps): React.ReactElement {
  const classNames = ["card", bordered ? "card--bordered" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classNames} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={`card__header ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>): React.ReactElement {
  return (
    <h3 className={`card__title ${className}`.trim()} {...props}>
      {children}
    </h3>
  );
}

export function CardDescription({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>): React.ReactElement {
  return (
    <p className={`card__description ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={`card__content ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardSection({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={`card__section ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  className = "",
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>): React.ReactElement {
  return (
    <div className={`card__footer ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}
