import type { Db } from './db.js';

/**
 * Ends every login session of a user (e.g. after a username or password change), optionally
 * keeping one session (the admin changing their own profile stays logged in).
 */
export async function endSessionsOf(db: Db, userId: number, keepSessionId: string | null = null): Promise<void> {
  await db.execute(
    "DELETE FROM sessions WHERE JSON_EXTRACT(data, '$.userId') = ? AND (? IS NULL OR session_id <> ?)",
    [userId, keepSessionId, keepSessionId],
  );
}
