/**
 * Parse an EGP-formatted price string into a plain integer number of EGP.
 *
 * EGP strings use dots and spaces as thousands separators, not decimal points.
 * All non-digit characters are stripped before converting, so the format of
 * any surrounding currency label does not matter.
 *
 * Examples:
 *   parseEGP("1.399 EGP") → 1399
 *   parseEGP("899 EGP")   → 899
 *   parseEGP("2.500")     → 2500
 *   parseEGP("")          → 0
 */
export function parseEGP(raw: string): number {
  const digits = String(raw).replace(/[^0-9]/g, "");
  if (digits === "") return 0;
  return parseInt(digits, 10);
}
