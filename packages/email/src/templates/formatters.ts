/**
 * Format order monetary amount in cents (minor units) to localized currency string.
 */
export function formatCurrency(
  cents: number | null | undefined,
  currency: string = "USD",
): string {
  if (cents === null || cents === undefined || Number.isNaN(cents)) {
    return "—";
  }
  const amount = cents / 100;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency.toUpperCase()} ${amount.toFixed(2)}`;
  }
}

/**
 * Format a Date or ISO timestamp string into a friendly localized date string.
 */
export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(d);
  } catch {
    return String(date);
  }
}
