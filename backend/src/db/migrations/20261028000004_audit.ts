import type { Knex } from 'knex';
import { CREATED_AT, FK_RULES, TABLE_OPTIONS } from './table-options.js';

const APPEND_ONLY = ['audit_log', 'step_report_history'] as const;

export async function up(knex: Knex): Promise<void> {
  // user_id is NULL for CLI scripts and unknown-user login attempts.
  await knex.raw(`
    CREATE TABLE audit_log (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NULL,
      action VARCHAR(64) NOT NULL,
      entity VARCHAR(64) NOT NULL,
      entity_id BIGINT UNSIGNED NULL,
      old_value JSON NULL,
      new_value JSON NULL,
      reason VARCHAR(1000) NULL,
      ip VARCHAR(45) NULL,
      ${CREATED_AT},
      PRIMARY KEY (id),
      KEY idx_audit_entity (entity, entity_id),
      KEY idx_audit_created (created_at),
      CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ${FK_RULES}
    ) ${TABLE_OPTIONS}
  `);
  // Triggers block every DB user, the migration user included (the app user also lacks the grants).
  // Aiven fallback only (CREATE TRIGGER refused there): skipped, and loudly reported at startup.
  if (process.env.DB_FALLBACK_NO_APPEND_ONLY_TRIGGERS === 'true') {
    console.warn('WARNING: append-only triggers NOT created (DB_FALLBACK_NO_APPEND_ONLY_TRIGGERS=true)');
    return;
  }
  for (const table of APPEND_ONLY) {
    for (const op of ['UPDATE', 'DELETE']) {
      await knex.raw(`
        CREATE TRIGGER trg_${table}_no_${op.toLowerCase()} BEFORE ${op} ON ${table} FOR EACH ROW
          SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '${table} is append-only'
      `);
    }
  }
}

export async function down(knex: Knex): Promise<void> {
  for (const table of APPEND_ONLY) {
    for (const op of ['update', 'delete']) await knex.raw(`DROP TRIGGER IF EXISTS trg_${table}_no_${op}`);
  }
  await knex.raw('DROP TABLE IF EXISTS audit_log');
}
