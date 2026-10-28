import { z } from 'zod';

/** Letters (Hindi or English), spaces and dots only: nothing that Excel could run as a formula. */
export const OFFICER_NAME_REGEX = /^[\p{L}\p{M}][\p{L}\p{M} .]{1,119}$/u;

export const officerName = z.string().trim().regex(OFFICER_NAME_REGEX);
export { mobileField as mobile } from '../../services/credential-rules.js';
export const id = z.coerce.number().int().min(1).max(4_294_967_295);
