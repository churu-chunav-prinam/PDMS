import type { Knex } from 'knex';

// Passwords are now chosen by the admin and never stored in readable form: drop the encrypted
// copies (and the key that read them). Login has always used password_hash only.
export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE users DROP CHECK chk_users_admin_no_copy');
  await knex.raw('ALTER TABLE users DROP COLUMN password_enc');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE users ADD COLUMN password_enc VARCHAR(255) NULL AFTER password_hash');
  await knex.raw("ALTER TABLE users ADD CONSTRAINT chk_users_admin_no_copy CHECK (role <> 'DISTRICT_ADMIN' OR password_enc IS NULL)");
}
