/**
 * Format a number as currency (CAD).
 * Always displays positive values — sign logic is handled by category type.
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("fr-CA", {
    style: "currency",
    currency: "CAD",
  }).format(Math.abs(amount));
}

/**
 * Format a date string (ISO or yyyy-mm-dd) for display.
 */
export function formatDate(date: string): string {
  // Parse as local time to avoid UTC→local timezone shift
  // "2026-02-19" with new Date() is UTC midnight, which rolls back a day in EST/EDT
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("fr-CA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(y, m - 1, d));
}

/**
 * Get the first and last day of a given month/year as ISO date strings.
 * Used for transaction date range queries.
 */
export function getMonthRange(month: number, year: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0); // last day of month
  return {
    startDate: start.toISOString().split("T")[0],
    endDate: end.toISOString().split("T")[0],
  };
}

/**
 * Get current month and year.
 */
export function getCurrentPeriod() {
  const now = new Date();
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}
