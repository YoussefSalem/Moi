/**
 * Parse an EGP-formatted price string into a number of EGP.
 *
 * Handles both formats:
 *   - Comma thousands + dot decimal: "1,399 EGP" → 1399, "969.20 EGP" → 969.20
 *   - Legacy dot thousands: "1.399 EGP" → 1399
 *
 * A trailing dot followed by exactly 2 digits is treated as a decimal point.
 * Otherwise dots and commas are treated as thousands separators.
 */
export function parseEGP(raw: string): number {
  const clean = String(raw).replace(/EGP/i, "").trim();
  if (clean === "") return 0;

  // Check if it has a decimal (dot followed by exactly 2 digits at end)
  const decimalMatch = clean.match(/\.(\d{2})$/);
  if (decimalMatch) {
    // Has decimal: remove commas (thousands), keep dot and decimal
    const numStr = clean.replace(/,/g, "");
    return parseFloat(numStr);
  }

  // No decimal: remove all non-digits (dots and commas are thousands separators)
  const digits = clean.replace(/[^0-9]/g, "");
  return parseInt(digits, 10);
}
