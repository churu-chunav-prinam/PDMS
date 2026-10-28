import { Router } from 'express';
import type { Request } from 'express';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { ISSUE_TYPES, PHASES } from '../../config/constants.js';
import { requireRole, userOf } from '../../middleware/auth.js';
import { parseInput } from '../../middleware/validate.js';
import { officerBoothId } from '../../services/access.js';
import { id } from '../admin/officer-fields.js';
import { boothCard, boothHistory, boothSteps } from './booth.read.js';
import { listIssues, openIssue, resolveIssue } from './issues.service.js';
import { saveReport } from './reports.service.js';

// The booth ALWAYS comes from the logged-in officer's assignment, never from the request.

const count = z.number().int().min(0).max(100_000);
const reportBody = z
  .object({
    value: count.optional(),
    turnout: z.object({ male: count, female: count, third: count }).strict().optional(),
  })
  .strict();
const reason = z.string().trim().min(3).max(500);
const editBody = reportBody.extend({ reason }).strict();
const stepParam = z.object({ stepId: id }).strict();
const issueParam = z.object({ issueId: id }).strict();
const phaseQuery = z.object({ phase: z.enum(PHASES) }).strict();
const issueBody = z
  .object({ type: z.enum(ISSUE_TYPES), note: z.string().trim().max(500).nullable() })
  .strict();
const resolveBody = z.object({ resolution: reason }).strict();

export function officerRouter(pool: Pool): Router {
  const router = Router();
  router.use(requireRole('POLLING_OFFICER'));
  const boothOf = (req: Request) => officerBoothId(pool, userOf(req));

  router.get('/home', async (req, res) => {
    const boothId = await boothOf(req);
    const booth = await boothCard(pool, boothId);
    const { now, enforceTimes, steps } = await boothSteps(pool, boothId, booth.registeredVoters);
    const phases = PHASES.map((phase) => {
      const inPhase = steps.filter((s) => s.phase === phase);
      return {
        phase,
        done: inPhase.filter((s) => s.status === 'done').length,
        total: inPhase.length,
        overdue: inPhase.filter((s) => s.status === 'overdue').length,
      };
    });
    const openIssue = (await listIssues(pool, boothId)).find((i) => i.resolvedAt === null) ?? null;
    res.json({
      serverTime: now.toISOString(),
      enforceStepTimes: enforceTimes,
      booth,
      progress: { done: steps.filter((s) => s.status === 'done').length, total: steps.length },
      phases,
      openIssue,
    });
  });

  router.get('/steps', async (req, res) => {
    const { phase } = parseInput(phaseQuery, req.query);
    const boothId = await boothOf(req);
    const booth = await boothCard(pool, boothId);
    const { now, enforceTimes, steps } = await boothSteps(pool, boothId, booth.registeredVoters);
    res.json({ serverTime: now.toISOString(), enforceStepTimes: enforceTimes, registeredVoters: booth.registeredVoters, steps: steps.filter((s) => s.phase === phase) });
  });

  router.post('/steps/:stepId/report', async (req, res) => {
    const { stepId } = parseInput(stepParam, req.params);
    const body = parseInput(reportBody, req.body);
    const result = await saveReport(pool, userOf(req), await boothOf(req), stepId, body, { kind: 'create' }, { ip: req.ip ?? null });
    res.status(201).json(result);
  });

  router.post('/steps/:stepId/edit', async (req, res) => {
    const { stepId } = parseInput(stepParam, req.params);
    const { reason: why, ...values } = parseInput(editBody, req.body);
    const result = await saveReport(pool, userOf(req), await boothOf(req), stepId, values, { kind: 'edit', reason: why }, { ip: req.ip ?? null });
    res.json(result);
  });

  router.get('/issues', async (req, res) => {
    res.json({ issues: await listIssues(pool, await boothOf(req)) });
  });

  router.post('/issues', async (req, res) => {
    const body = parseInput(issueBody, req.body);
    const issueId = await openIssue(pool, userOf(req), await boothOf(req), { type: body.type, note: body.note === '' ? null : body.note }, { ip: req.ip ?? null });
    res.status(201).json({ id: issueId });
  });

  router.post('/issues/:issueId/resolve', async (req, res) => {
    const { issueId } = parseInput(issueParam, req.params);
    const { resolution } = parseInput(resolveBody, req.body);
    await resolveIssue(pool, userOf(req), await boothOf(req), issueId, resolution, { ip: req.ip ?? null });
    res.status(204).end();
  });

  router.get('/history', async (req, res) => {
    res.json({ events: await boothHistory(pool, await boothOf(req)) });
  });

  return router;
}
