export function normalizePhoneNumber(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("233") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 10) return `+233${digits.slice(1)}`;
  return digits.length >= 10 ? `+${digits}` : digits;
}

export function isValidInternationalPhone(value: string): boolean {
  const normalized = normalizePhoneNumber(value);
  const digits = normalized.replace(/\D/g, "");
  return normalized.startsWith("+") && digits.length >= 10 && digits.length <= 15;
}
