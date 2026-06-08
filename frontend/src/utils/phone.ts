export const QATAR_DIAL_CODE = '+974';

/** Local digits only (strips +974 / 974 prefix if present). */
export function stripQatarDialCode(phone: string): string {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+974')) {
    return trimmed.slice(4).replace(/\D/g, '');
  }
  if (trimmed.startsWith('974')) {
    return trimmed.slice(3).replace(/\D/g, '');
  }
  return trimmed.replace(/\D/g, '');
}

/** Full E.164-style number for API storage. */
export function formatQatarPhone(localDigits: string): string {
  const digits = localDigits.replace(/\D/g, '');
  return `${QATAR_DIAL_CODE}${digits}`;
}
