import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import archiver from 'archiver';
import { createClient } from '@supabase/supabase-js';
import { SquareClient, SquareEnvironment } from 'square';
import { Database } from './database';
import { authMiddleware } from './auth';

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;
const storageBucket = process.env.SUPABASE_STORAGE_BUCKET || 'calibration-records';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY. Set these environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const db = new Database(supabaseUrl, supabaseServiceKey);

const squareAccessToken = process.env.SQUARE_ACCESS_TOKEN;
const squareLocationId = process.env.SQUARE_LOCATION_ID;
const squareClient = squareAccessToken && squareLocationId
  ? new SquareClient({
      token: squareAccessToken,
      environment: process.env.SQUARE_ENV === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
    })
  : null;

// Multer for PDF uploads (memory storage - we'll upload to Supabase)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

app.use(cors());
app.use(express.json());

// Auth: get or create profile (requires valid JWT)
app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    res.json(req.profile);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// All API routes require auth
app.use('/api', authMiddleware);

// API routes
app.get('/api/equipment-types', async (_req, res) => {
  try {
    const data = await db.getEquipmentTypes();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/equipment-types', async (req, res) => {
  try {
    await db.createEquipmentType(req.body);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/equipment-types/:id', async (req, res) => {
  try {
    await db.updateEquipmentType(parseInt(req.params.id, 10), req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/equipment-types/:id', async (req, res) => {
  try {
    await db.deleteEquipmentType(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment', async (req, res) => {
  try {
    const data = await db.getAllEquipment(req.profile);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment/calibration-status', async (req, res) => {
  try {
    const data = await db.getCalibrationStatus(req.profile);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment/barcode/:barcode', async (req, res) => {
  try {
    const eq = await db.getEquipmentByBarcode(req.params.barcode, req.profile);
    res.json(eq ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment/:id', async (req, res) => {
  try {
    const eq = await db.getEquipmentById(parseInt(req.params.id, 10), req.profile);
    res.json(eq ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/equipment', async (req, res) => {
  try {
    if (req.profile?.role === 'company_admin' && req.profile.company_id) {
      const deptId = req.body.department_id;
      if (deptId != null) {
        const ok = await db.isDepartmentInCompany(parseInt(String(deptId), 10), req.profile.company_id);
        if (!ok) return res.status(403).json({ error: 'Department must belong to your company' });
      } else {
        return res.status(400).json({ error: 'Department is required' });
      }
    }
    const id = await db.createEquipment(req.body);
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/equipment/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.profile?.role === 'company_admin') {
      const existing = await db.getEquipmentById(id, req.profile);
      if (!existing) return res.status(403).json({ error: 'Access denied' });
    }
    await db.updateEquipment(id, req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/equipment/bulk', async (req, res) => {
  try {
    const { ids, ...data } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
    const idList = ids.map((x: unknown) => parseInt(String(x), 10));
    if (req.profile?.role === 'company_admin') {
      for (const id of idList) {
        const existing = await db.getEquipmentById(id, req.profile);
        if (!existing) return res.status(403).json({ error: 'Access denied to one or more equipment items' });
      }
    }
    await db.bulkUpdateEquipment(idList, data);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/equipment/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.profile?.role === 'company_admin') {
      const existing = await db.getEquipmentById(id, req.profile);
      if (!existing) return res.status(403).json({ error: 'Access denied' });
    }
    const records = await db.getCalibrationRecords(id);
    for (const r of records) {
      await supabase.storage.from(storageBucket).remove([r.storage_path]);
    }
    await db.deleteEquipment(id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/sign-outs', async (req, res) => {
  try {
    const data = await db.getAllSignOuts(req.profile);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/sign-outs/active', async (req, res) => {
  try {
    const data = await db.getActiveSignOuts(req.profile);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/sign-outs/equipment/:equipmentId', async (req, res) => {
  try {
    const data = await db.getSignOutsByEquipment(parseInt(req.params.equipmentId, 10));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/sign-outs/active/equipment/:equipmentId', async (req, res) => {
  try {
    const so = await db.getActiveSignOutByEquipmentId(parseInt(req.params.equipmentId, 10));
    res.json(so ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/sign-outs', async (req, res) => {
  try {
    const id = await db.createSignOut(req.body);
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/sites', async (req, res) => {
  try {
    const data = await db.getSitesForProfile(req.profile);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/checkouts', async (req, res) => {
  try {
    if (!req.profile) return res.status(401).json({ error: 'Unauthorized' });
    const result = await db.createCheckout(req.profile, req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/sign-outs/:id/check-in', async (req, res) => {
  try {
    await db.checkInSignOut(parseInt(req.params.id, 10), req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/usage/sign-out/:signOutId', async (req, res) => {
  try {
    const data = await db.getUsageBySignOut(parseInt(req.params.signOutId, 10));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/usage', async (req, res) => {
  try {
    await db.addUsage(req.body);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/usage/:id', async (req, res) => {
  try {
    await db.removeUsage(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/calibration-records/equipment/:equipmentId', async (req, res) => {
  try {
    const equipmentId = parseInt(req.params.equipmentId, 10);
    if (req.profile?.role === 'company_admin') {
      const eq = await db.getEquipmentById(equipmentId, req.profile);
      if (!eq) return res.status(403).json({ error: 'Access denied' });
    }
    const records = await db.getCalibrationRecords(equipmentId);
    res.json(records.map((r) => ({ ...r, download_url: `/api/calibration-records/${r.id}/download` })));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/calibration-records/equipment/:equipmentId', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const equipmentId = parseInt(req.params.equipmentId, 10);
    if (req.profile?.role === 'company_admin') {
      const eq = await db.getEquipmentById(equipmentId, req.profile);
      if (!eq) return res.status(403).json({ error: 'Access denied' });
    }
    const ext = path.extname(req.file.originalname) || '.pdf';
    const storagePath = `${equipmentId}/${Date.now()}${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(storageBucket)
      .upload(storagePath, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (uploadErr) throw uploadErr;

    const calDate = req.body?.cal_date || null;
    const dueDate = req.body?.due_date || null;
    await db.addCalibrationRecord(equipmentId, req.file.originalname, storagePath, calDate || undefined, dueDate || undefined);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/calibration-records/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { cal_date, due_date } = req.body || {};
    const rec = await db.getCalibrationRecordById(id);
    if (!rec) return res.status(404).json({ error: 'Record not found' });
    if (req.profile?.role === 'company_admin') {
      const eq = await db.getEquipmentById(rec.equipment_id, req.profile);
      if (!eq) return res.status(403).json({ error: 'Access denied' });
    }
    await db.updateCalibrationRecord(id, { cal_date: cal_date || null, due_date: due_date || null });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/calibration-records/:id/download', async (req, res) => {
  try {
    const rec = await db.getCalibrationRecordById(parseInt(req.params.id, 10));
    if (!rec) return res.status(404).send('File not found');
    if (req.profile?.role === 'company_admin') {
      const eq = await db.getEquipmentById(rec.equipment_id, req.profile);
      if (!eq) return res.status(403).send('Access denied');
    }
    const { data, error } = await supabase.storage
      .from(storageBucket)
      .createSignedUrl(rec.storage_path, 60); // 60 second expiry
    if (error || !data?.signedUrl) return res.status(404).send('File not found');

    res.redirect(302, data.signedUrl);
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Unknown error');
  }
});

app.delete('/api/calibration-records/:id', async (req, res) => {
  try {
    const recId = parseInt(req.params.id, 10);
    const existing = await db.getCalibrationRecordById(recId);
    if (existing && req.profile?.role === 'company_admin') {
      const eq = await db.getEquipmentById(existing.equipment_id, req.profile);
      if (!eq) return res.status(403).json({ error: 'Access denied' });
    }
    const rec = await db.deleteCalibrationRecord(recId);
    if (rec?.storage_path) {
      await supabase.storage.from(storageBucket).remove([rec.storage_path]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/calibration-records', async (req, res) => {
  try {
    const records = await db.getAllCalibrationRecords(req.profile);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/calibration-records/download-batch', async (req, res) => {
  const { ids } = req.body as { ids?: number[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required with at least one id' });
  }
  const records = await Promise.all(ids.map((id) => db.getCalibrationRecordById(id)));
  let valid = records.filter((r): r is NonNullable<typeof r> => r != null);
  if (req.profile?.role === 'company_admin') {
    const accessChecked: typeof valid = [];
    for (const rec of valid) {
      const eq = await db.getEquipmentById(rec.equipment_id, req.profile);
      if (eq) accessChecked.push(rec);
    }
    valid = accessChecked;
  }
  if (valid.length === 0) return res.status(404).json({ error: 'No valid records found' });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="calibration-certificates-${Date.now()}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', () => res.end());
  archive.pipe(res);

  for (const rec of valid) {
    try {
      const { data, error } = await supabase.storage.from(storageBucket).download(rec.storage_path);
      if (error || !data) continue;
      const buffer = Buffer.from(await data.arrayBuffer());
      const safeName = rec.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const zipName = `${rec.equipment_id}_${safeName}`;
      archive.append(buffer, { name: zipName });
    } catch {
      // Skip failed downloads
    }
  }

  await archive.finalize();
});

// Equipment Requests
app.get('/api/equipment-requests', async (req, res) => {
  try {
    const status = req.query.status as 'pending' | 'approved' | 'rejected' | undefined;
    const data = await db.getEquipmentRequests(status, req.profile);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/equipment-requests', async (req, res) => {
  try {
    const body = req.body;
    if (Array.isArray(body.equipment_ids)) {
      await db.createEquipmentRequestsBatch(body);
    } else {
      await db.createEquipmentRequest(body);
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/equipment-requests/:id/approve', async (req, res) => {
  try {
    const { reviewed_by } = req.body;
    if (!reviewed_by?.trim()) return res.status(400).json({ error: 'reviewed_by is required' });
    const reqData = await db.approveEquipmentRequest(parseInt(req.params.id, 10), reviewed_by.trim());
    const purposeParts = [`Building: ${reqData.building}`];
    if (reqData.room_number) purposeParts.push(`Room: ${reqData.room_number}`);
    purposeParts.push(`Equipment to test: #${reqData.equipment_number_to_test}`, `Dates: ${reqData.date_from} to ${reqData.date_to}`);
    const signOutId = await db.createSignOut({
      equipment_id: reqData.equipment_id,
      signed_out_by: reqData.requester_name,
      purpose: purposeParts.join(', '),
      building: reqData.building,
      room_number: reqData.room_number ?? undefined,
      equipment_number_to_test: reqData.equipment_number_to_test,
      date_from: reqData.date_from,
      date_to: reqData.date_to,
      equipment_request_id: parseInt(req.params.id, 10),
    });
    await db.addUsage({
      sign_out_id: signOutId,
      system_equipment: reqData.equipment_number_to_test,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/equipment-requests/:id/reject', async (req, res) => {
  try {
    const { reviewed_by, comment } = req.body;
    if (!reviewed_by?.trim()) return res.status(400).json({ error: 'reviewed_by is required' });
    await db.rejectEquipmentRequest(parseInt(req.params.id, 10), reviewed_by.trim(), comment);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Admin-only routes (super_admin, company_admin)
function adminOnly(req: express.Request, res: express.Response, next: express.NextFunction) {
  const role = req.profile?.role;
  if (role !== 'super_admin' && role !== 'company_admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

// Super admin only
function superAdminOnly(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.profile?.role !== 'super_admin') return res.status(403).json({ error: 'Super admin access required' });
  next();
}

// Company admin only (for onboarding)
function companyAdminOnly(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (req.profile?.role !== 'company_admin') return res.status(403).json({ error: 'Company admin access required' });
  next();
}

// Admin or equipment manager (for user creation within scope)
function adminOrEquipmentManager(req: express.Request, res: express.Response, next: express.NextFunction) {
  const role = req.profile?.role;
  if (role !== 'super_admin' && role !== 'company_admin' && role !== 'equipment_manager') {
    return res.status(403).json({ error: 'Admin or equipment manager access required' });
  }
  next();
}

app.get('/api/admin/profiles', adminOnly, async (req, res) => {
  try {
    const data = await db.getAllProfiles(req.profile);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/admin/profiles/:id/role', adminOnly, async (req, res) => {
  try {
    const role = req.body.role as 'user' | 'equipment_manager' | 'company_admin' | 'super_admin';
    if (!['user', 'equipment_manager', 'company_admin', 'super_admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    await db.updateProfileRole(parseInt(req.params.id, 10), role);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/admin/profiles/:id', adminOnly, async (req, res) => {
  try {
    const { display_name, email, company_id } = req.body;
    const profileId = parseInt(req.params.id, 10);
    const p = await db.getProfileById(profileId);
    if (!p) return res.status(404).json({ error: 'Profile not found' });
    if (email !== undefined && email !== p.email) {
      const { error: authErr } = await supabase.auth.admin.updateUserById(p.auth_user_id, { email: email.trim().toLowerCase() });
      if (authErr) return res.status(400).json({ error: authErr.message });
    }
    await db.updateProfile(profileId, { display_name, email: email?.trim?.(), company_id });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/admin/profiles/:id/access', adminOnly, async (req, res) => {
  try {
    const data = await db.getProfileAccess(parseInt(req.params.id, 10));
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/admin/profiles/:id/access', adminOnly, async (req, res) => {
  try {
    const access = req.body.access as { site_id: number; department_id?: number | null; equipment_id?: number | null }[];
    if (!Array.isArray(access)) return res.status(400).json({ error: 'access must be an array' });
    await db.setProfileAccess(parseInt(req.params.id, 10), access);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/admin/profiles/:id', adminOnly, async (req, res) => {
  try {
    const profileId = parseInt(req.params.id, 10);
    const p = await db.getProfileById(profileId);
    if (!p) return res.status(404).json({ error: 'Profile not found' });
    await db.deleteProfile(profileId);
    try {
      await supabase.auth.admin.deleteUser(p.auth_user_id);
    } catch {
      // Auth user may already be deleted; ignore
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/admin/sites', adminOnly, async (req, res) => {
  try {
    const data = await db.getSites(req.profile);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/admin/sites', adminOnly, async (req, res) => {
  try {
    const { name, company_id } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const companyId = req.profile?.role === 'super_admin' && company_id != null
      ? Number(company_id)
      : req.profile?.role === 'company_admin'
        ? (req.profile.company_id ?? await db.getDefaultCompanyId())
        : null;
    await db.createSite(name.trim(), companyId);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/admin/sites/:id', adminOnly, async (req, res) => {
  try {
    const { name, company_id } = req.body;
    const id = parseInt(req.params.id, 10);
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const companyId = req.profile?.role === 'super_admin' && company_id != null ? Number(company_id) : undefined;
    await db.updateSite(id, name.trim(), companyId);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/admin/sites/:id', adminOnly, async (req, res) => {
  try {
    await db.deleteSite(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/departments', async (req, res) => {
  try {
    const data = await db.getDepartmentsForProfile(req.profile);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/admin/departments', adminOnly, async (req, res) => {
  try {
    const data = await db.getDepartments(req.profile);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/admin/departments', adminOnly, async (req, res) => {
  try {
    const { site_id, name } = req.body;
    if (!site_id || !name?.trim()) return res.status(400).json({ error: 'site_id and name are required' });
    await db.createDepartment(parseInt(String(site_id), 10), name.trim());
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/admin/departments/:id', adminOnly, async (req, res) => {
  try {
    const { name, site_id } = req.body;
    const id = parseInt(req.params.id, 10);
    if (!name?.trim() || !site_id) return res.status(400).json({ error: 'name and site_id are required' });
    await db.updateDepartment(id, name.trim(), parseInt(String(site_id), 10));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/admin/departments/:id', adminOnly, async (req, res) => {
  try {
    await db.deleteDepartment(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/admin/onboarding-status', companyAdminOnly, async (req, res) => {
  try {
    const profile = req.profile;
    let needsOnboarding = profile?.onboarding_complete !== true;
    if (profile?.company_id) {
      const sites = await db.getSites(profile);
      if (sites.length === 0) needsOnboarding = true;
    }
    res.json({ needsOnboarding });
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/admin/onboarding-complete', companyAdminOnly, async (req, res) => {
  try {
    if (!req.profile?.id) return res.status(400).json({ error: 'Profile not found' });
    await db.setOnboardingComplete(req.profile.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/admin/companies', superAdminOnly, async (_req, res) => {
  try {
    const data = await db.getAllCompanies();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/admin/companies/:id', adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.profile?.role === 'company_admin' && req.profile.company_id !== id) return res.status(403).json({ error: 'Access denied' });
    const company = await db.getCompanyById(id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/admin/companies/:id', adminOnly, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (req.profile?.role === 'company_admin' && req.profile.company_id !== id) return res.status(403).json({ error: 'Access denied' });
    const { name, contact_name, contact_email, contact_phone, address_line1, address_line2, address_city, address_state, address_zip, subscription_level, subscription_active } = req.body;
    await db.updateCompany(id, {
      name,
      contact_name,
      contact_email,
      contact_phone,
      address_line1,
      address_line2,
      address_city,
      address_state,
      address_zip,
      subscription_level,
      subscription_active,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/payments/orders', companyAdminOnly, async (req, res) => {
  try {
    const companyId = req.profile?.company_id;
    if (!companyId) return res.status(400).json({ error: 'Company not found' });
    const orders = await db.getSubscriptionOrders(companyId);
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/payments/process', companyAdminOnly, async (req, res) => {
  try {
    const companyId = req.profile?.company_id;
    if (!companyId) return res.status(400).json({ error: 'Company not found' });
    const { sourceId, amountCents, planName, idempotencyKey } = req.body;
    if (!sourceId || typeof amountCents !== 'number' || amountCents < 1) {
      return res.status(400).json({ error: 'sourceId and amountCents (positive) required' });
    }
    if (!squareClient) {
      return res.status(503).json({ error: 'Square payments not configured. Set SQUARE_ACCESS_TOKEN and SQUARE_LOCATION_ID.' });
    }
    const idemKey = idempotencyKey || `sub-${companyId}-${Date.now()}`;
    const response = await squareClient.payments.create({
      sourceId,
      idempotencyKey: idemKey,
      amountMoney: { amount: BigInt(amountCents), currency: 'USD' },
      locationId: squareLocationId!,
    });
    const result = response.body;
    if (response.statusCode !== 200 || !result.payment?.id) {
      return res.status(400).json({ error: (result as { errors?: { detail?: string }[] }).errors?.[0]?.detail || 'Payment failed' });
    }
    try {
      await db.createSubscriptionOrder(companyId, {
        square_payment_id: result.payment.id,
        amount_cents: amountCents,
        plan_name: planName || null,
        status: 'completed',
      });
    } catch {
      // Order record may fail if table doesn't exist; payment still succeeded
    }
    res.json({ ok: true, paymentId: result.payment.id });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Payment failed' });
  }
});

app.post('/api/admin/companies', superAdminOnly, async (req, res) => {
  try {
    const { name, contact_email, contact_name, create_admin, admin_email, admin_password } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'name is required' });
    const contactEmail = contact_email?.trim?.() || (create_admin ? admin_email?.trim?.() : null) || null;
    const contactName = contact_name?.trim?.() || null;
    const companyId = await db.createCompany(name.trim(), contactEmail, contactName);
    if (create_admin && admin_email?.trim() && admin_password?.trim() && companyId) {
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email: admin_email.trim().toLowerCase(),
        password: admin_password.trim(),
        email_confirm: true,
      });
      if (authErr) return res.status(400).json({ error: authErr.message });
      if (authUser?.user?.id) {
        const displayName = contactName || null;
        await db.createUserProfile(authUser.user.id, admin_email.trim().toLowerCase(), 'company_admin', req.profile, [], companyId, displayName);
      }
    }
    res.status(201).json({ ok: true, id: companyId });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/admin/companies/:id/subscription', superAdminOnly, async (req, res) => {
  try {
    const { subscription_active, subscription_level } = req.body;
    const companyId = parseInt(req.params.id, 10);
    if (typeof subscription_active !== 'boolean') return res.status(400).json({ error: 'subscription_active (boolean) required' });
    await db.updateCompanySubscription(companyId, subscription_active, subscription_level);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/admin/companies/:id', superAdminOnly, async (req, res) => {
  try {
    const companyId = parseInt(req.params.id, 10);
    const { storagePaths, authUserIds } = await db.deleteCompany(companyId);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'calibration-records';
    if (storagePaths.length) await supabase.storage.from(bucket).remove(storagePaths);
    for (const uid of authUserIds) {
      try { await supabase.auth.admin.deleteUser(uid); } catch { /* ignore */ }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/admin/companies/:id/close', companyAdminOnly, async (req, res) => {
  try {
    const companyId = parseInt(req.params.id, 10);
    if (req.profile?.company_id !== companyId) return res.status(403).json({ error: 'Access denied' });
    const { confirm } = req.body;
    const company = await db.getCompanyById(companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    const expected = (company.name as string)?.trim().toUpperCase();
    const provided = (confirm ?? '').trim().toUpperCase();
    if (expected && provided !== expected) return res.status(400).json({ error: 'Type the company name exactly to confirm' });
    const { storagePaths, authUserIds } = await db.deleteCompany(companyId);
    const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'calibration-records';
    if (storagePaths.length) await supabase.storage.from(bucket).remove(storagePaths);
    for (const uid of authUserIds) {
      try { await supabase.auth.admin.deleteUser(uid); } catch { /* ignore */ }
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/admin/users', adminOrEquipmentManager, async (req, res) => {
  try {
    const { email, password, access, role, company_id } = req.body;
    if (!email?.trim() || !password?.trim()) return res.status(400).json({ error: 'email and password are required' });
    const allowedRoles = ['user', 'equipment_manager', 'company_admin', 'super_admin'] as const;
    const assignedRole = allowedRoles.includes(role) ? role : 'user';
    const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      email_confirm: true,
    });
    if (authErr) return res.status(400).json({ error: authErr.message });
    if (!authUser?.user?.id) return res.status(500).json({ error: 'Failed to create user' });
    const profile = await db.createUserProfile(
      authUser.user.id,
      email.trim().toLowerCase(),
      assignedRole,
      req.profile,
      Array.isArray(access) ? access : [],
      company_id != null ? Number(company_id) : undefined
    );
    res.status(201).json({ id: profile.id, email: profile.email });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

// Serve static files in production
const distPath = path.join(process.cwd(), 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`Equipment Inventory server running at http://localhost:${PORT}`);
  console.log(`Using Supabase for database and storage`);
});
