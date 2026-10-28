import type { Knex } from 'knex';
import { CREATED_AT, FK_RULES, TABLE_OPTIONS, UPDATED_AT } from './table-options.js';

export async function up(knex: Knex): Promise<void> {
  // Steps are data (edited by the DISTRICT_ADMIN). number_label_*: the field label for NUMBER steps.
  await knex.raw(`
    CREATE TABLE step (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      phase ENUM('PRE_POLL', 'POLL_DAY', 'POST_POLL') NOT NULL,
      sort_order SMALLINT UNSIGNED NOT NULL,
      name_hi VARCHAR(150) NOT NULL,
      name_en VARCHAR(150) NOT NULL,
      step_type ENUM('DONE', 'NUMBER', 'TURNOUT') NOT NULL,
      number_label_hi VARCHAR(100) NULL,
      number_label_en VARCHAR(100) NULL,
      opens_at DATETIME NULL,
      due_by DATETIME NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      ${CREATED_AT},
      ${UPDATED_AT},
      PRIMARY KEY (id),
      UNIQUE KEY uq_step_phase_order (phase, sort_order),
      CONSTRAINT chk_step_active CHECK (is_active IN (0, 1)),
      CONSTRAINT chk_step_window CHECK (opens_at IS NULL OR due_by IS NULL OR due_by >= opens_at),
      CONSTRAINT chk_step_number_label CHECK (step_type <> 'NUMBER' OR number_label_hi IS NOT NULL)
    ) ${TABLE_OPTIONS}
  `);
  // One report per (booth, step). Times are server time. TURNOUT: male/female/third gender
  // (cumulative); NUMBER: value_number; DONE: no values.
  await knex.raw(`
    CREATE TABLE step_report (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      booth_id INT UNSIGNED NOT NULL,
      step_id INT UNSIGNED NOT NULL,
      value_number INT UNSIGNED NULL,
      turnout_male INT UNSIGNED NULL,
      turnout_female INT UNSIGNED NULL,
      turnout_third INT UNSIGNED NULL,
      turnout_total INT UNSIGNED AS (turnout_male + turnout_female + turnout_third) STORED,
      reported_at DATETIME(3) NOT NULL,
      reported_by INT UNSIGNED NOT NULL,
      is_late TINYINT(1) NOT NULL,
      version SMALLINT UNSIGNED NOT NULL DEFAULT 1,
      updated_by INT UNSIGNED NULL,
      ${UPDATED_AT},
      PRIMARY KEY (id),
      UNIQUE KEY uq_report_booth_step (booth_id, step_id),
      KEY idx_report_step (step_id),
      CONSTRAINT chk_report_turnout CHECK (
        (turnout_male IS NULL AND turnout_female IS NULL AND turnout_third IS NULL)
        OR (turnout_male IS NOT NULL AND turnout_female IS NOT NULL AND turnout_third IS NOT NULL)
      ),
      CONSTRAINT fk_report_booth FOREIGN KEY (booth_id) REFERENCES booth (id) ${FK_RULES},
      CONSTRAINT fk_report_step FOREIGN KEY (step_id) REFERENCES step (id) ${FK_RULES},
      CONSTRAINT fk_report_by FOREIGN KEY (reported_by) REFERENCES users (id) ${FK_RULES},
      CONSTRAINT fk_report_updated_by FOREIGN KEY (updated_by) REFERENCES users (id) ${FK_RULES}
    ) ${TABLE_OPTIONS}
  `);
  // Every edit keeps the old and new values with the reason (append-only).
  await knex.raw(`
    CREATE TABLE step_report_history (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      report_id INT UNSIGNED NOT NULL,
      old_value JSON NOT NULL,
      new_value JSON NOT NULL,
      reason VARCHAR(500) NOT NULL,
      changed_by INT UNSIGNED NOT NULL,
      ${CREATED_AT},
      PRIMARY KEY (id),
      KEY idx_history_report (report_id),
      CONSTRAINT fk_history_report FOREIGN KEY (report_id) REFERENCES step_report (id) ${FK_RULES},
      CONSTRAINT fk_history_by FOREIGN KEY (changed_by) REFERENCES users (id) ${FK_RULES}
    ) ${TABLE_OPTIONS}
  `);
  // open_booth: the booth id while the issue is open, NULL once resolved -> one open issue per booth.
  await knex.raw(`
    CREATE TABLE issue (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      booth_id INT UNSIGNED NOT NULL,
      issue_type ENUM('LAW_ORDER', 'EVM_FAULT', 'POWER_WATER', 'VOTER_LIST', 'OTHER') NOT NULL,
      note VARCHAR(500) NULL,
      started_at DATETIME(3) NOT NULL,
      started_by INT UNSIGNED NOT NULL,
      resolved_at DATETIME(3) NULL,
      resolved_by INT UNSIGNED NULL,
      resolution VARCHAR(500) NULL,
      duration_seconds INT UNSIGNED AS (TIMESTAMPDIFF(SECOND, started_at, resolved_at)) STORED,
      open_booth INT UNSIGNED AS (IF(resolved_at IS NULL, booth_id, NULL)) STORED,
      PRIMARY KEY (id),
      UNIQUE KEY uq_issue_open_booth (open_booth),
      KEY idx_issue_booth (booth_id),
      CONSTRAINT chk_issue_resolved CHECK (
        (resolved_at IS NULL AND resolved_by IS NULL AND resolution IS NULL)
        OR (resolved_at IS NOT NULL AND resolved_by IS NOT NULL AND resolution IS NOT NULL
            AND resolved_at >= started_at)
      ),
      CONSTRAINT fk_issue_booth FOREIGN KEY (booth_id) REFERENCES booth (id) ${FK_RULES},
      CONSTRAINT fk_issue_started_by FOREIGN KEY (started_by) REFERENCES users (id) ${FK_RULES},
      CONSTRAINT fk_issue_resolved_by FOREIGN KEY (resolved_by) REFERENCES users (id) ${FK_RULES}
    ) ${TABLE_OPTIONS}
  `);
}

export async function down(knex: Knex): Promise<void> {
  for (const t of ['issue', 'step_report_history', 'step_report', 'step']) {
    await knex.raw(`DROP TABLE IF EXISTS ${t}`);
  }
}
