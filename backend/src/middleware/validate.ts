import type { z } from 'zod';
import { ApiError } from './errors.js';

/** Parses request input with a .strict() Zod schema; 400 VALIDATION_FAILED with field paths otherwise. */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((i) => i.path.join('.')))];
    throw new ApiError(400, 'VALIDATION_FAILED', { fields });
  }
  return result.data;
}
