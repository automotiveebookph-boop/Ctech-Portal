// Philippine mobile number normalization/formatting.
// Canonical storage format: "09XXXXXXXXX" (11 digits, leading 0).

export function normalizePHPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("63") && digits.length === 12) return "0" + digits.slice(2);
  if (digits.startsWith("9") && digits.length === 10) return "0" + digits;
  return digits;
}

export function formatPHPhone(input: string | null | undefined): string {
  if (!input) return "";
  const n = normalizePHPhone(input);
  if (n.length !== 11) return input;
  return `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}`;
}

export function isValidPHPhone(input: string): boolean {
  const n = normalizePHPhone(input);
  return /^09\d{9}$/.test(n);
}
