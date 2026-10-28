import type { Role } from '../config/constants.js';

/** The logged-in user, re-loaded from the database on every request. */
export interface AuthUser {
  id: number;
  username: string;
  fullName: string | null;
  role: Role;
}
