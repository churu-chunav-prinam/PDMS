import type { Knex } from 'knex';

// Some settings are lists (e.g. the dev demo's booth ids): VARCHAR(255) is too short.
export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE app_settings MODIFY setting_value TEXT NOT NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE app_settings MODIFY setting_value VARCHAR(255) NOT NULL');
}
