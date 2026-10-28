// npm run admin:create -- --username <name> --name "<full name>"
// Creates a DISTRICT_ADMIN. The password is typed (twice, hidden) by the person running it; it must
// follow the same rules as every account (8+ chars, a letter and a digit, not the username).
import { parseArgs } from 'node:util';
import type { ResultSetHeader } from 'mysql2/promise';
import { writeAudit } from '../src/services/audit.js';
import { USERNAME_REGEX, passwordProblem } from '../src/services/credential-rules.js';
import { inTransaction } from '../src/services/db.js';
import { hashPassword } from '../src/services/passwords.js';
import { promptHidden } from './lib/prompt.js';
import { isMainModule, runScript } from './lib/script-db.js';

if (isMainModule(import.meta.url)) {
  const { values } = parseArgs({ options: { username: { type: 'string' }, name: { type: 'string' } } });
  const username = values.username ?? '';
  if (!USERNAME_REGEX.test(username)) {
    console.error('--username must be 3-30 chars: letters, digits, dot, dash, underscore');
    process.exit(2);
  }
  const password = await promptHidden('Password for the new admin: ');
  const again = await promptHidden('Repeat the password: ');
  const problem = passwordProblem(password, username);
  if (password !== again || problem) {
    console.error(password !== again ? 'The two passwords differ. Nothing created.' : `Password not accepted: ${problem}. Nothing created.`);
    process.exit(2);
  }
  await runScript(async (pool) => {
    const hash = await hashPassword(password);
    await inTransaction(pool, async (conn) => {
      const [res] = await conn.execute<ResultSetHeader>(
        "INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, 'DISTRICT_ADMIN', ?)",
        [username, hash, values.name ?? null],
      );
      await writeAudit(conn, { userId: null, action: 'ADMIN_CREATE', entity: 'users', entityId: res.insertId, newValue: { username }, ip: null });
    });
    console.log(`DISTRICT_ADMIN "${username}" created.`);
    return true;
  });
}
