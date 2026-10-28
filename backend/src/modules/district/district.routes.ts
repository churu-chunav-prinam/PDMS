import { Router } from 'express';
import type { Request, Response } from 'express';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import type { AppConfig } from '../../config/app-config.js';
import { PHASES, STEP_TYPES } from '../../config/constants.js';
import { requireRole, userOf } from '../../middleware/auth.js';
import { parseInput } from '../../middleware/validate.js';
import { writeWorkbook } from '../../services/xlsx.js';
import type { SheetSpec } from '../../services/xlsx.js';
import { id } from '../admin/officer-fields.js';
import { auditPage, boothDetail, issuesSheet, reportsSheet, turnoutSheet } from './district.read.js';
import { getEnforceStepTimes, getPollDate, setEnforceStepTimes, setPollDate } from '../../services/settings.js';
import { dashboard, filterBooths, loadSnapshot, pendingForStep } from './snapshot.js';
import { createStep, deleteStep, listStepsWithCounts, setStepActive, updateStep } from './steps.admin.js';

const BOOTH_LIST_LIMIT = 200;
const AUDIT_PAGE = 100;

const idParam = z.object({ id }).strict();
const boothQuery = z
  .object({
    ps: id.optional(),
    filter: z.enum(['all', 'pending', 'issue', 'behind', 'nothing']).default('all'),
    q: z.string().max(60).default(''),
  })
  .strict();
const localDateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).nullable();
const label = z.string().trim().min(1).max(100).nullable();
const stepBody = z
  .object({
    phase: z.enum(PHASES),
    sortOrder: z.number().int().min(1).max(9999),
    nameHi: z.string().trim().min(2).max(150),
    nameEn: z.string().trim().min(2).max(150),
    type: z.enum(STEP_TYPES),
    numberLabelHi: label,
    numberLabelEn: label,
    opensAt: localDateTime,
    dueBy: localDateTime,
  })
  .strict();
const activeBody = z.object({ active: z.boolean() }).strict();
const pollDateBody = z.object({ pollDate: z.iso.date() }).strict();
const enforceBody = z.object({ enabled: z.boolean() }).strict();
const auditQuery = z.object({ before: id.optional() }).strict();
const exportParam = z.object({ kind: z.enum(['reports', 'turnout', 'issues']) }).strict();

async function sendXlsx(res: Response, filename: string, sheet: SheetSpec): Promise<void> {
  res
    .set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .set('Content-Disposition', `attachment; filename="${filename}"`)
    .set('Cache-Control', 'no-store')
    .send(await writeWorkbook([sheet]));
}

export function districtRouter(pool: Pool, config: AppConfig): Router {
  const router = Router();
  router.use(requireRole('DISTRICT_ADMIN'));
  const ip = (req: Request) => req.ip ?? null;

  router.get('/dashboard', async (_req, res) => {
    res.json(dashboard(await loadSnapshot(pool)));
  });

  router.get('/booths', async (req, res) => {
    const q = parseInput(boothQuery, req.query);
    const all = filterBooths(await loadSnapshot(pool), { psId: q.ps ?? null, filter: q.filter, q: q.q });
    res.json({ total: all.length, booths: all.slice(0, BOOTH_LIST_LIMIT) });
  });

  router.get('/booths/:id', async (req, res) => {
    res.json(await boothDetail(pool, parseInput(idParam, req.params).id));
  });

  router.get('/steps/:id/pending', async (req, res) => {
    res.json({ booths: pendingForStep(await loadSnapshot(pool), parseInput(idParam, req.params).id) });
  });

  router.get('/issues', async (_req, res) => {
    res.json({ openIssues: dashboard(await loadSnapshot(pool)).openIssues });
  });

  router.get('/export/:kind', async (req, res) => {
    const { kind } = parseInput(exportParam, req.params);
    const sheet = kind === 'reports' ? await reportsSheet(pool) : kind === 'turnout' ? await turnoutSheet(pool) : await issuesSheet(pool);
    await sendXlsx(res, `churu-poll-${kind}.xlsx`, sheet);
  });

  // Step master
  router.get('/steps', async (_req, res) => {
    res.json({ steps: await listStepsWithCounts(pool) });
  });
  router.post('/steps', async (req, res) => {
    res.status(201).json({ id: await createStep(pool, userOf(req).id, parseInput(stepBody, req.body), ip(req)) });
  });
  router.post('/steps/:id/update', async (req, res) => {
    await updateStep(pool, userOf(req).id, parseInput(idParam, req.params).id, parseInput(stepBody, req.body), ip(req));
    res.status(204).end();
  });
  router.post('/steps/:id/active', async (req, res) => {
    const { active } = parseInput(activeBody, req.body);
    await setStepActive(pool, userOf(req).id, parseInput(idParam, req.params).id, active, ip(req));
    res.status(204).end();
  });
  router.post('/steps/:id/delete', async (req, res) => {
    await deleteStep(pool, userOf(req).id, parseInput(idParam, req.params).id, ip(req));
    res.status(204).end();
  });

  // Settings
  router.get('/settings', async (_req, res) => {
    res.json({ pollDate: await getPollDate(pool, config.pollDateDefault), enforceStepTimes: await getEnforceStepTimes(pool) });
  });
  router.post('/settings/poll-date', async (req, res) => {
    const { pollDate } = parseInput(pollDateBody, req.body);
    res.json(await setPollDate(pool, userOf(req).id, pollDate, config.pollDateDefault, ip(req)));
  });

  router.post('/settings/enforce-step-times', async (req, res) => {
    const { enabled } = parseInput(enforceBody, req.body);
    await setEnforceStepTimes(pool, userOf(req).id, enabled, ip(req));
    res.json({ enforceStepTimes: enabled });
  });

  router.get('/audit', async (req, res) => {
    const { before } = parseInput(auditQuery, req.query);
    res.json({ entries: await auditPage(pool, before ?? null, AUDIT_PAGE) });
  });

  return router;
}
