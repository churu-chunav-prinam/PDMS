import type { Knex } from 'knex';
import { CREATED_AT, FK_RULES, TABLE_OPTIONS, UPDATED_AT } from './table-options.js';

export async function up(knex: Knex): Promise<void> {
  // password_enc: AES-256-GCM copy of a generated officer password (credentials Excel only).
  // Login always uses password_hash. DISTRICT_ADMIN accounts never have a copy.
  await knex.raw(`
    CREATE TABLE users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(30) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      password_enc VARCHAR(255) NULL,
      role ENUM('DISTRICT_ADMIN', 'SECTOR_OFFICER', 'POLLING_OFFICER') NOT NULL,
      full_name VARCHAR(120) NULL,
      mobile CHAR(10) NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      failed_login_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
      locked_until DATETIME(3) NULL,
      last_login_at DATETIME(3) NULL,
      created_by INT UNSIGNED NULL,
      ${CREATED_AT},
      ${UPDATED_AT},
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_username (username),
      CONSTRAINT chk_users_active CHECK (is_active IN (0, 1)),
      CONSTRAINT chk_users_mobile CHECK (mobile IS NULL OR REGEXP_LIKE(mobile, '^[6-9][0-9]{9}$')),
      CONSTRAINT chk_users_admin_no_copy CHECK (role <> 'DISTRICT_ADMIN' OR password_enc IS NULL),
      CONSTRAINT fk_users_created_by FOREIGN KEY (created_by) REFERENCES users (id) ${FK_RULES}
    ) ${TABLE_OPTIONS}
  `);
  // Which booths a non-admin user may see. POLLING_OFFICER: exactly one row (enforced in
  // services/accounts.ts). SECTOR_OFFICER (later): many rows, no schema change.
  await knex.raw(`
    CREATE TABLE user_booth (
      user_id INT UNSIGNED NOT NULL,
      booth_id INT UNSIGNED NOT NULL,
      ${CREATED_AT},
      PRIMARY KEY (user_id, booth_id),
      KEY idx_user_booth_booth (booth_id),
      CONSTRAINT fk_user_booth_user FOREIGN KEY (user_id) REFERENCES users (id) ${FK_RULES},
      CONSTRAINT fk_user_booth_booth FOREIGN KEY (booth_id) REFERENCES booth (id) ${FK_RULES}
    ) ${TABLE_OPTIONS}
  `);
  await knex.raw(`
    CREATE TABLE sessions (
      session_id VARCHAR(128) NOT NULL,
      expires INT UNSIGNED NOT NULL,
      data MEDIUMTEXT NULL,
      PRIMARY KEY (session_id),
      KEY idx_sessions_expires (expires)
    ) ${TABLE_OPTIONS}
  `);
}

export async function down(knex: Knex): Promise<void> {
  for (const t of ['sessions', 'user_booth', 'users']) await knex.raw(`DROP TABLE IF EXISTS ${t}`);
}
