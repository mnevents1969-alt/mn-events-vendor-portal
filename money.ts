const SYMBOLS: Record<string, string> = { INR: "₹", USD: "$", EUR: "€" };

/** Formats an integer minor-unit amount (e.g. paise) with its currency for display. */
export function formatMoney(minor: number | null | undefined, currency = "INR"): string {
  if (minor == null) return "—";
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${(minor / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** Converts a rupee-style decimal input (e.g. "150.50") to integer minor units (15050). */
export function toMinorUnits(value: string): number | null {
  const n = Number(value);
  if (!value.trim() || Number.isNaN(n)) return null;
  return Math.round(n * 100);
}
