import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Database } from './database';

const app = express();
const PORT = process.env.PORT || 3000;

// Data directory (use DATA_PATH for Render persistent disk, else ./data in project)
const dataDir = process.env.DATA_PATH || path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'equipment-inventory.db');
const calRecordsPath = path.join(dataDir, 'calibration-records');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(calRecordsPath)) fs.mkdirSync(calRecordsPath, { recursive: true });

const db = new Database(dbPath, calRecordsPath);
db.initialize();

// Multer for PDF uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, calRecordsPath),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '.pdf';
    cb(null, `${req.params.equipmentId}_${Date.now()}${ext}`);
  },
});
const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are allowed'));
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

app.use(cors());
app.use(express.json());

// API routes
app.get('/api/equipment-types', (_req, res) => {
  try {
    res.json(db.getEquipmentTypes());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/equipment-types', (req, res) => {
  try {
    db.createEquipmentType(req.body);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/equipment-types/:id', (req, res) => {
  try {
    db.updateEquipmentType(parseInt(req.params.id, 10), req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/equipment-types/:id', (req, res) => {
  try {
    db.deleteEquipmentType(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment', (_req, res) => {
  try {
    res.json(db.getAllEquipment());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment/calibration-status', (_req, res) => {
  try {
    res.json(db.getCalibrationStatus());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment/barcode/:barcode', (req, res) => {
  try {
    const eq = db.getEquipmentByBarcode(req.params.barcode);
    res.json(eq ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/equipment/:id', (req, res) => {
  try {
    const eq = db.getEquipmentById(parseInt(req.params.id, 10));
    res.json(eq ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/equipment', (req, res) => {
  try {
    db.createEquipment(req.body);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.put('/api/equipment/:id', (req, res) => {
  try {
    db.updateEquipment(parseInt(req.params.id, 10), req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/equipment/:id', (req, res) => {
  try {
    db.deleteEquipment(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/sign-outs', (_req, res) => {
  try {
    res.json(db.getAllSignOuts());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/sign-outs/active', (_req, res) => {
  try {
    res.json(db.getActiveSignOuts());
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/sign-outs/equipment/:equipmentId', (req, res) => {
  try {
    res.json(db.getSignOutsByEquipment(parseInt(req.params.equipmentId, 10)));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/sign-outs/active/equipment/:equipmentId', (req, res) => {
  try {
    const so = db.getActiveSignOutByEquipmentId(parseInt(req.params.equipmentId, 10));
    res.json(so ?? null);
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/sign-outs', (req, res) => {
  try {
    db.createSignOut(req.body);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/sign-outs/:id/check-in', (req, res) => {
  try {
    db.checkInSignOut(parseInt(req.params.id, 10), req.body);
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/usage/sign-out/:signOutId', (req, res) => {
  try {
    res.json(db.getUsageBySignOut(parseInt(req.params.signOutId, 10)));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/usage', (req, res) => {
  try {
    db.addUsage(req.body);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.delete('/api/usage/:id', (req, res) => {
  try {
    db.removeUsage(parseInt(req.params.id, 10));
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/calibration-records/equipment/:equipmentId', (req, res) => {
  try {
    const records = db.getCalibrationRecords(parseInt(req.params.equipmentId, 10));
    // Return records with download URL instead of file path
    res.json(records.map((r) => ({ ...r, download_url: `/api/calibration-records/${r.id}/download` })));
  } catch (err) {
    res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.post('/api/calibration-records/equipment/:equipmentId', upload.single('pdf'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const equipmentId = parseInt(req.params.equipmentId, 10);
    db.addCalibrationRecord(equipmentId, req.file.originalname, req.file.path);
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Unknown error' });
  }
});

app.get('/api/calibration-records/:id/download', (req, res) => {
  try {
    const rec = db.getCalibrationRecordById(parseInt(req.params.id, 10));
    if (!rec || !fs.existsSync(rec.file_path)) return res.status(404).send('File not found');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(rec.file_name)}"`);
    res.sendFile(path.resolve(rec.file_path));
  } catch (err) {
    res.status(500).send(err instanceof Error ? err.message : 'Unknown error');
  }
});

app.delete('/api/calibration-records/:id', (req, res) => {
  try {
    db.deleteCalibrationRecord(parseInt(req.params.id, 10));
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
  console.log(`Data stored in: ${dataDir}`);
  console.log(`Calibration PDFs stored in: ${calRecordsPath}`);
});
