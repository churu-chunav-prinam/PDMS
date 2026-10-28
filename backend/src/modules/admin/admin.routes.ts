import express, { Router } from 'express';
import type { Request, Response } from 'express';
import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '../../config/constants.js';
import { requireRole, userOf } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/errors.js';
import { parseInput } from '../../middleware/validate.js';
import { writeAudit } from '../../services/audit.js';
import { writeWorkbook } from '../../services/xlsx.js';
import type { SheetSpec } from '../../services/xlsx.js';
import { requireReauth } from '../auth/auth.service.js';
import { passwordField, usernameField } from '../../services/credential-rules.js';
import { createOfficers, setOfficerActive, setOfficerPassword, updateOfficerDetails } from './accounts.service.js';
import { checkBulkFile } from './bulk.service.js';
import { id, mobile, officerName } from './officer-fields.js';
import { BULK_TEMPLATE, credentialsSheet, listBoothOfficers, listPanchayatSamitis, listPsWards, listWardBooths } from './officers.read.js';

/** Paths whose JSON body may be larger (base64 Excel); app.ts skips the 100 kb parser for them. */
export const UPLOAD_PATHS = new Set(['/api/admin/officers/bulk']);
const uploadJson = express.json({ limit: Math.ceil((MAX_UPLOAD_BYTES * 4) / 3) + 1024 });

const idParam = z.object({ id }).strict();
const psQuery = z.object({ ps: id }).strict();
/** Password + its confirmation (checked on the server too). The strength rule is in assertPassword. */
const newPassword = { password: passwordField, confirmPassword: passwordField };
const sameConfirm = (b: { password: string; confirmPassword: string }) => b.password === b.confirmPassword;
const MISMATCH = { message: 'PASSWORD_MISMATCH', path: ['confirmPassword'] };
const createBody = z
  .object({ boothId: id, fullName: officerName, mobile, username: usernameField, ...newPassword })
  .strict()
  .refine(sameConfirm, MISMATCH);
const updateBody = z.object({ fullName: officerName, mobile, username: usernameField }).strict();
const setPasswordBody = z.object(newPassword).strict().refine(sameConfirm, MISMATCH);
const bulkBody = z
  .object({ file: z.base64().max(Math.ceil((MAX_UPLOAD_BYTES * 4) / 3)), commit: z.boolean() })
  .strict();
const credentialsBody = z.object({ psId: id, password: z.string().min(1).max(128) }).strict();

const actorOf = (req: Request) => ({ userId: userOf(req).id, ip: req.ip ?? null });

async function sendXlsx(res: Response, filename: string, sheets: readonly SheetSpec[]): Promise<void> {
  const data = await writeWorkbook(sheets);
  res
    .set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .set('Content-Disposition', `attachment; filename="${filename}"`)
    .set('Cache-Control', 'no-store')
    .send(data);
}

export function adminRouter(pool: Pool): Router {
  const router = Router();
  // Every route below is DISTRICT_ADMIN only.
  router.use(requireRole('DISTRICT_ADMIN'));

  router.get('/ps', async (_req, res) => {
    res.json({ panchayatSamitis: await listPanchayatSamitis(pool) });
  });

  // Booth picker (add officer): PS ward list and the booths of one ward. Admin only.
  router.get('/ps/:id/wards', async (req, res) => {
    res.json({ wards: await listPsWards(pool, parseInput(idParam, req.params).id) });
  });
  router.get('/wards/:id/booths', async (req, res) => {
    res.json({ booths: await listWardBooths(pool, parseInput(idParam, req.params).id) });
  });

  router.get('/booths', async (req, res) => {
    const { ps } = parseInput(psQuery, req.query);
    res.json({ booths: await listBoothOfficers(pool, ps) });
  });

  router.post('/officers', async (req, res) => {
    const { confirmPassword: _confirm, ...input } = parseInput(createBody, req.body);
    const [officer] = await createOfficers(pool, [input], actorOf(req), 'OFFICER_CREATE');
    res.status(201).json({ officer });
  });

  router.post('/officers/bulk', uploadJson, async (req, res) => {
    const body = parseInput(bulkBody, req.body);
    const file = Buffer.from(body.file, 'base64');
    if (file.length > MAX_UPLOAD_BYTES) throw new ApiError(413, 'FILE_TOO_LARGE');
    const check = await checkBulkFile(pool, file);
    if (!check.ok) throw new ApiError(400, 'FILE_INVALID', { fileError: check.fileError, columns: check.columns ?? [] });
    // All or nothing: a commit with any problem row writes nothing.
    if (!body.commit || check.problemRows > 0) {
      res.status(body.commit ? 409 : 200).json({
        committed: false,
        rows: check.rows,
        problemRows: check.problemRows,
        ...(body.commit ? { error: 'BULK_HAS_PROBLEMS' } : {}),
      });
      return;
    }
    const created = await createOfficers(pool, check.inputs, actorOf(req), 'OFFICER_BULK_CREATE');
    res.status(201).json({ committed: true, rows: check.rows, problemRows: 0, created: created.length });
  });

  router.post('/officers/:id/update', async (req, res) => {
    const { id: userId } = parseInput(idParam, req.params);
    await updateOfficerDetails(pool, userId, parseInput(updateBody, req.body), actorOf(req));
    res.status(204).end();
  });

  router.post('/officers/:id/password', async (req, res) => {
    const { id: userId } = parseInput(idParam, req.params);
    const { password } = parseInput(setPasswordBody, req.body);
    await setOfficerPassword(pool, userId, password, actorOf(req));
    res.status(204).end();
  });

  for (const [path, active] of [['disable', false], ['enable', true]] as const) {
    router.post(`/officers/:id/${path}`, async (req, res) => {
      const { id: userId } = parseInput(idParam, req.params);
      await setOfficerActive(pool, userId, active, actorOf(req));
      res.status(204).end();
    });
  }

  router.get('/officers/template.xlsx', async (_req, res) => {
    const ps = await listPanchayatSamitis(pool);
    await sendXlsx(res, 'officers-template.xlsx', [
      BULK_TEMPLATE,
      {
        name: 'PS codes',
        columns: [{ header: 'booth = ps_code-booth_no, e.g.', width: 30 }, { header: 'ps_code', width: 10 }, { header: 'पंचायत समिति', width: 30 }, { header: 'booths' }],
        rows: ps.map((p) => [`${p.code}-001`, p.code, p.nameHi, p.booths]),
      },
    ]);
  });

  // POST (not GET): needs the admin's password again (lists every officer's mobile and username).
  router.post('/credentials', async (req, res) => {
    const body = parseInput(credentialsBody, req.body);
    const actor = actorOf(req);
    await requireReauth(pool, actor.userId, body.password, actor.ip);
    const ps = (await listPanchayatSamitis(pool)).find((p) => p.id === body.psId);
    if (!ps) throw new ApiError(404, 'PS_NOT_FOUND');
    const sheet = await credentialsSheet(pool, ps.id);
    await writeAudit(pool, {
      userId: actor.userId,
      action: 'CREDENTIALS_DOWNLOAD',
      entity: 'panchayat_samiti',
      entityId: ps.id,
      newValue: { ps_code: ps.code, rows: sheet.rows.length },
      ip: actor.ip,
    });
    await sendXlsx(res, `credentials-${ps.code}.xlsx`, [sheet]);
  });

  return router;
}
