import bcrypt from 'bcrypt';
import { BCRYPT_COST } from '../config/constants.js';

export function hashPassword(password: string, cost = BCRYPT_COST): Promise<string> {
  return bcrypt.hash(password, cost);
}

/** True when `candidate` is the password behind `hash` (used to stop username == password). */
export function matchesHash(candidate: string, hash: string): Promise<boolean> {
  return bcrypt.compare(candidate, hash);
}
