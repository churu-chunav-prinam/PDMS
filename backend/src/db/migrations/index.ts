import type { Knex } from 'knex';
import * as geography from './20261028000001_geography.js';
import * as users from './20261028000002_users.js';
import * as stepsReports from './20261028000003_steps_reports.js';
import * as audit from './20261028000004_audit.js';
import * as settingsMarker from './20261028000005_settings_marker.js';
import * as settingsText from './20261028000006_settings_text.js';
import * as dropPasswordCopies from './20261028000007_drop_password_copies.js';

// Explicit, ordered list: statically imported so tsx and the compiled dist/ behave the same.
const MIGRATIONS: readonly (readonly [string, Knex.Migration])[] = [
  ['20261028000001_geography', geography],
  ['20261028000002_users', users],
  ['20261028000003_steps_reports', stepsReports],
  ['20261028000004_audit', audit],
  ['20261028000005_settings_marker', settingsMarker],
  ['20261028000006_settings_text', settingsText],
  ['20261028000007_drop_password_copies', dropPasswordCopies],
];

export const migrationSource: Knex.MigrationSource<string> = {
  getMigrations: () => Promise.resolve(MIGRATIONS.map(([name]) => name)),
  getMigrationName: (name) => name,
  getMigration: (name) => {
    const found = MIGRATIONS.find(([n]) => n === name);
    if (!found) return Promise.reject(new Error(`Unknown migration: ${name}`));
    return Promise.resolve(found[1]);
  },
};
