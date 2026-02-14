import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import archiver from 'archiver';
import { createClient } from '@supabase/supabase-js';
import { Database } from './database';

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

app.get('/api/equipment', async (_req, res) => {
  try {
    const data = await db.getAllEquipment();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment/calibration-status', async (_req, res) => {
  try {
    const data = await db.getCalibrationStatus();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment/barcode/:barcode', async (req, res) => {
  try {
    const eq = await db.getEquipmentByBarcode(req.params.barcode);
    res.json(eq ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment/:id', async (req, res) => {
  try {
    const eq = await db.getEquipmentById(parseInt(req.params.id, 10));
    res.json(eq ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/equipment', async (req, res) => {
  try {
    const id = await db.createEquipment(req.body);
    res.status(201).json({ id });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/equipment/:id', async (req, res) => {
  try {
    await db.updateEquipment(parseInt(req.params.id, 10), req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/equipment/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
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

app.get('/api/sign-outs', async (_req, res) => {
  try {
    const data = await db.getAllSignOuts();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/sign-outs/active', async (_req, res) => {
  try {
    const data = await db.getActiveSignOuts();
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
    const records = await db.getCalibrationRecords(parseInt(req.params.equipmentId, 10));
    res.json(records.map((r) => ({ ...r, download_url: `/api/calibration-records/${r.id}/download` })));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/calibration-records/equipment/:equipmentId', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const equipmentId = parseInt(req.params.equipmentId, 10);
    const ext = path.extname(req.file.originalname) || '.pdf';
    const storagePath = `${equipmentId}/${Date.now()}${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from(storageBucket)
      .upload(storagePath, req.file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (uploadErr) throw uploadErr;

    await db.addCalibrationRecord(equipmentId, req.file.originalname, storagePath);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/calibration-records/:id/download', async (req, res) => {
  try {
    const rec = await db.getCalibrationRecordById(parseInt(req.params.id, 10));
    if (!rec) return res.status(404).send('File not found');

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
    const rec = await db.deleteCalibrationRecord(parseInt(req.params.id, 10));
    if (rec?.storage_path) {
      await supabase.storage.from(storageBucket).remove([rec.storage_path]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/calibration-records', async (_req, res) => {
  try {
    const records = await db.getAllCalibrationRecords();
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
  const valid = records.filter((r): r is NonNullable<typeof r> => r != null);
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
    const data = await db.getEquipmentRequests(status);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/equipment-requests', async (req, res) => {
  try {
    await db.createEquipmentRequest(req.body);
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
    const signOutId = await db.createSignOut({
      equipment_id: reqData.equipment_id,
      signed_out_by: reqData.requester_name,
      purpose: `Building: ${reqData.building}, Equipment to test: #${reqData.equipment_number_to_test}, Dates: ${reqData.date_from} to ${reqData.date_to}`,
      building: reqData.building,
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
