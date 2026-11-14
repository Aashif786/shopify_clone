import React, { type ReactNode } from "react";

/** Merchant "Ledger" design primitives. Styles live in app/merchant/merchant-theme.css. */

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mt-page", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("mt-page-header", className)}>
      <div style={{ minWidth: 0 }}>
        <h1 className="mt-page-title">{title}</h1>
        {description ? <p className="mt-page-sub">{description}</p> : null}
      </div>
      {actions ? <div className="mt-page-actions">{actions}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  actions,
  children,
  flush,
  className,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <section className={cx("mt-panel", className)}>
      {title || actions ? (
        <div className="mt-panel-head">
          <h2 className="mt-panel-title">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className={cx("mt-panel-body", flush && "mt-panel-body--flush")}>{children}</div>
    </section>
  );
}

export interface StatItem {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
}

/** Single bordered strip of KPIs: denser than a row of separate cards. */
export function StatStrip({ items }: { items: StatItem[] }) {
  return (
    <div className="mt-stats" role="list">
      {items.map((item) => (
        <div className="mt-stat" role="listitem" key={item.label}>
          <div className="mt-stat-label">{item.label}</div>
          <div className="mt-stat-value">{item.value}</div>
          {item.hint ? <div className="mt-stat-hint">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

export function Toolbar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("mt-toolbar", className)}>{children}</div>;
}

export function ToolbarSpacer() {
  return <span className="mt-toolbar-spacer" />;
}

export function SplitGrid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return <div className={columns === 3 ? "mt-grid-3" : "mt-grid-2"}>{children}</div>;
}

export function EmptyPanel({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mt-empty">
      <strong>{title}</strong>
      {description ? <span>{description}</span> : null}
      {action}
    </div>
  );
}
