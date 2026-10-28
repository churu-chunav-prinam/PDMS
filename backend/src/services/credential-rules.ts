// The ONLY place that decides what a valid username, password and mobile are (officers and admins).
// The frontend mirrors these rules for instant hints (frontend/src/rules/credentials.ts); the server decides.
import { z } from 'zod';
import { MOBILE_REGEX } from '../config/constants.js';

/** 3-30 chars: letters, digits, dot, dash, underscore. Uniqueness is case-insensitive (column collation). */
export const USERNAME_REGEX = /^[A-Za-z0-9._-]{3,30}$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export type PasswordProblem = 'PASSWORD_TOO_SHORT' | 'PASSWORD_TOO_LONG' | 'PASSWORD_NEEDS_LETTER_AND_DIGIT' | 'PASSWORD_SAME_AS_USERNAME';

/** null when the password is acceptable for this username. */
export function passwordProblem(password: string, username: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN) return 'PASSWORD_TOO_SHORT';
  if (password.length > PASSWORD_MAX) return 'PASSWORD_TOO_LONG';
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'PASSWORD_NEEDS_LETTER_AND_DIGIT';
  if (password.toLowerCase() === username.toLowerCase()) return 'PASSWORD_SAME_AS_USERNAME';
  return null;
}

export const usernameField = z.string().trim().regex(USERNAME_REGEX);
export const mobileField = z.string().trim().regex(MOBILE_REGEX);
/** Shape only (length bounds); the strength rule needs the username: see passwordProblem. */
export const passwordField = z.string().min(1).max(PASSWORD_MAX);

/** Case-insensitive key for username comparisons outside the database. */
export const usernameKey = (u: string) => u.trim().toLowerCase();
