// Mirror of backend/src/services/credential-rules.ts, for instant Hindi hints while typing.
// The server checks everything again and decides; keep the two files in step.

export const MOBILE_REGEX = /^[6-9]\d{9}$/;
export const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,30}$/;
export const PASSWORD_MIN = 8;

export const MOBILE_HINT = '10 अंक, 6-9 से शुरू';
export const USERNAME_HINT = '3-30 अक्षर: a-z, 0-9, . - _';
export const PASSWORD_HINT = 'कम से कम 8 अक्षर, एक अक्षर और एक अंक; यूज़रनेम जैसा नहीं';

/** Hindi text for each password rule the server can report (reason of PASSWORD_WEAK). */
export const PASSWORD_REASONS: Record<string, string> = {
  PASSWORD_TOO_SHORT: 'पासवर्ड कम से कम 8 अक्षर का हो',
  PASSWORD_TOO_LONG: 'पासवर्ड बहुत लंबा है',
  PASSWORD_NEEDS_LETTER_AND_DIGIT: 'पासवर्ड में कम से कम एक अक्षर और एक अंक हो',
  PASSWORD_SAME_AS_USERNAME: 'पासवर्ड यूज़रनेम जैसा नहीं हो सकता',
};

export function mobileError(m: string): string | null {
  return MOBILE_REGEX.test(m) ? null : 'मोबाइल नंबर 10 अंकों का हो (6-9 से शुरू)';
}

export function usernameError(u: string): string | null {
  return USERNAME_REGEX.test(u.trim()) ? null : `यूज़रनेम सही नहीं (${USERNAME_HINT})`;
}

export function passwordError(p: string, username: string): string | null {
  if (p.length < PASSWORD_MIN) return PASSWORD_REASONS.PASSWORD_TOO_SHORT ?? null;
  if (!/\p{L}/u.test(p) || !/\d/.test(p)) return PASSWORD_REASONS.PASSWORD_NEEDS_LETTER_AND_DIGIT ?? null;
  if (p.toLowerCase() === username.trim().toLowerCase()) return PASSWORD_REASONS.PASSWORD_SAME_AS_USERNAME ?? null;
  return null;
}

export function confirmError(p: string, confirm: string): string | null {
  return p === confirm ? null : 'दोनों पासवर्ड एक जैसे नहीं हैं';
}
