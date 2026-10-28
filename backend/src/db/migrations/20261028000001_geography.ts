import type { Knex } from 'knex';
import { CREATED_AT, FK_RULES, TABLE_OPTIONS, UPDATED_AT } from './table-options.js';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE TABLE district (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      code VARCHAR(10) NOT NULL,
      name_english VARCHAR(100) NOT NULL,
      name_hindi VARCHAR(150) NOT NULL,
      ${CREATED_AT},
      PRIMARY KEY (id),
      UNIQUE KEY uq_district_code (code)
    ) ${TABLE_OPTIONS}
  `);
  // code: short PS code used in officer usernames (RTG-045).
  await knex.raw(`
    CREATE TABLE panchayat_samiti (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      district_id INT UNSIGNED NOT NULL,
      code VARCHAR(5) NOT NULL,
      name_english VARCHAR(150) NOT NULL,
      name_hindi VARCHAR(200) NOT NULL,
      ${CREATED_AT},
      PRIMARY KEY (id),
      UNIQUE KEY uq_ps_code (code),
      UNIQUE KEY uq_ps_name_english (name_english),
      CONSTRAINT chk_ps_code CHECK (REGEXP_LIKE(code, '^[A-Z]{2,5}$', 'c')),
      CONSTRAINT fk_ps_district FOREIGN KEY (district_id) REFERENCES district (id) ${FK_RULES}
    ) ${TABLE_OPTIONS}
  `);
  // PS wards belong to one PS; ZP wards belong to the district (ps_scope 0).
  await knex.raw(`
    CREATE TABLE ward (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      ward_type ENUM('PS', 'ZP') NOT NULL,
      panchayat_samiti_id INT UNSIGNED NULL,
      ward_no SMALLINT UNSIGNED NOT NULL,
      ps_scope INT UNSIGNED AS (IFNULL(panchayat_samiti_id, 0)) STORED,
      PRIMARY KEY (id),
      UNIQUE KEY uq_ward_scope_no (ward_type, ps_scope, ward_no),
      CONSTRAINT chk_ward_scope CHECK (
        (ward_type = 'PS' AND panchayat_samiti_id IS NOT NULL)
        OR (ward_type = 'ZP' AND panchayat_samiti_id IS NULL)
      ),
      CONSTRAINT fk_ward_ps FOREIGN KEY (panchayat_samiti_id) REFERENCES panchayat_samiti (id) ${FK_RULES}
    ) ${TABLE_OPTIONS}
  `);
  // Booth identity = (PS, booth_no); booth numbers restart in every PS.
  await knex.raw(`
    CREATE TABLE booth (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      panchayat_samiti_id INT UNSIGNED NOT NULL,
      booth_no SMALLINT UNSIGNED NOT NULL,
      name_hindi VARCHAR(300) NOT NULL,
      name_english VARCHAR(300) NULL,
      ps_ward_id INT UNSIGNED NOT NULL,
      zp_ward_id INT UNSIGNED NOT NULL,
      registered_voters_male INT UNSIGNED NULL,
      registered_voters_female INT UNSIGNED NULL,
      registered_voters_total INT UNSIGNED NOT NULL,
      ${CREATED_AT},
      ${UPDATED_AT},
      PRIMARY KEY (id),
      UNIQUE KEY uq_booth_ps_no (panchayat_samiti_id, booth_no),
      CONSTRAINT chk_booth_no CHECK (booth_no >= 1),
      CONSTRAINT fk_booth_ps FOREIGN KEY (panchayat_samiti_id) REFERENCES panchayat_samiti (id) ${FK_RULES},
      CONSTRAINT fk_booth_ps_ward FOREIGN KEY (ps_ward_id) REFERENCES ward (id) ${FK_RULES},
      CONSTRAINT fk_booth_zp_ward FOREIGN KEY (zp_ward_id) REFERENCES ward (id) ${FK_RULES}
    ) ${TABLE_OPTIONS}
  `);
}

export async function down(knex: Knex): Promise<void> {
  for (const t of ['booth', 'ward', 'panchayat_samiti', 'district']) {
    await knex.raw(`DROP TABLE IF EXISTS ${t}`);
  }
}
