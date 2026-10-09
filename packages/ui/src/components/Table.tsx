import React from "react";

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  children: React.ReactNode;
  caption?: string;
  className?: string;
  fullWidth?: boolean;
}

export function Table({
  children,
  caption,
  className = "",
  fullWidth = true,
  ...props
}: TableProps) {
  return (
    <div className={`table-container ${fullWidth ? "table-full-width" : ""}`}>
      <table className={`table ${className}`.trim()} {...props}>
        {caption && <caption className="table-caption">{caption}</caption>}
        {children}
      </table>
    </div>
  );
}

export interface TableHeaderProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export function TableHeader({ children, className = "", ...props }: TableHeaderProps) {
  return (
    <thead className={`table-header ${className}`.trim()} {...props}>
      {children}
    </thead>
  );
}

export interface TableBodyProps
  extends React.HTMLAttributes<HTMLTableSectionElement> {
  children: React.ReactNode;
}

export function TableBody({ children, className = "", ...props }: TableBodyProps) {
  return (
    <tbody className={`table-body ${className}`.trim()} {...props}>
      {children}
    </tbody>
  );
}

export interface TableRowProps
  extends React.HTMLAttributes<HTMLTableRowElement> {
  children: React.ReactNode;
  isClickable?: boolean;
}

export function TableRow({
  children,
  className = "",
  isClickable = false,
  ...props
}: TableRowProps) {
  return (
    <tr
      className={`table-row ${isClickable ? "table-row-clickable" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </tr>
  );
}

export interface TableHeadProps
  extends React.ThHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
}

export function TableHead({
  children,
  className = "",
  align = "left",
  ...props
}: TableHeadProps) {
  return (
    <th
      scope="col"
      className={`table-head table-align-${align} ${className}`.trim()}
      {...props}
    >
      {children}
    </th>
  );
}

export interface TableCellProps
  extends React.TdHTMLAttributes<HTMLTableCellElement> {
  children?: React.ReactNode;
  align?: "left" | "center" | "right";
}

export function TableCell({
  children,
  className = "",
  align = "left",
  ...props
}: TableCellProps) {
  return (
    <td
      className={`table-cell table-align-${align} ${className}`.trim()}
      {...props}
    >
      {children}
    </td>
  );
}
