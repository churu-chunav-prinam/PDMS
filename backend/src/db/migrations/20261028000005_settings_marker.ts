import type { Knex } from 'knex';
import { CREATED_AT, TABLE_OPTIONS, UPDATED_AT } from './table-options.js';

export async function up(knex: Knex): Promise<void> {
  // Key/value settings edited by the DISTRICT_ADMIN (e.g. poll_date).
  await knex.raw(`
    CREATE TABLE app_settings (
      setting_key VARCHAR(64) NOT NULL,
      setting_value VARCHAR(255) NOT NULL,
      ${CREATED_AT},
      ${UPDATED_AT},
      PRIMARY KEY (setting_key)
    ) ${TABLE_OPTIONS}
  `);
  // marker: fixed meaning for the dashboard ("poll started"), independent of the editable name.
  await knex.raw(`ALTER TABLE step ADD COLUMN marker ENUM('POLL_START') NULL AFTER step_type,
                  ADD UNIQUE KEY uq_step_marker (marker)`);
  await knex.raw("UPDATE step SET marker = 'POLL_START' WHERE name_en = 'Poll started' AND phase = 'POLL_DAY'");
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE step DROP INDEX uq_step_marker, DROP COLUMN marker');
  await knex.raw('DROP TABLE IF EXISTS app_settings');
}
