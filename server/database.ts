import BetterSqlite3 from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export interface EquipmentType {
  id: number;
  name: string;
  requires_calibration: number;
  calibration_frequency_months: number | null;
  created_at: string;
}

export interface Equipment {
  id: number;
  equipment_type_id: number;
  equipment_type_name?: string;
  make: string;
  model: string;
  serial_number: string;
  equipment_number: string | null;
  last_calibration_date: string | null;
  next_calibration_due: string | null;
  notes: string | null;
  created_at: string;
}

export interface SignOut {
  id: number;
  equipment_id: number;
  equipment_make?: string;
  equipment_model?: string;
  equipment_serial?: string;
  signed_out_by: string;
  signed_out_at: string;
  signed_in_by: string | null;
  signed_in_at: string | null;
  purpose: string | null;
  created_at: string;
}

export interface Usage {
  id: number;
  sign_out_id: number;
  system_equipment: string;
  notes: string | null;
}

export interface CalibrationRecord {
  id: number;
  equipment_id: number;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

export class Database {
  private db: BetterSqlite3.Database;
  private calRecordsPath: string;

  constructor(dbPath: string, calRecordsPath: string) {
    this.db = new BetterSqlite3(dbPath);
    this.calRecordsPath = calRecordsPath;
    if (!fs.existsSync(calRecordsPath)) {
      fs.mkdirSync(calRecordsPath, { recursive: true });
    }
  }

  initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS equipment_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        requires_calibration INTEGER NOT NULL DEFAULT 1,
        calibration_frequency_months INTEGER,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS equipment (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_type_id INTEGER NOT NULL,
        make TEXT NOT NULL,
        model TEXT NOT NULL,
        serial_number TEXT NOT NULL,
        equipment_number TEXT UNIQUE,
        last_calibration_date TEXT,
        next_calibration_due TEXT,
        notes TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (equipment_type_id) REFERENCES equipment_types(id)
      );

      CREATE TABLE IF NOT EXISTS sign_outs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        signed_out_by TEXT NOT NULL,
        signed_out_at TEXT NOT NULL,
        signed_in_by TEXT,
        signed_in_at TEXT,
        purpose TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (equipment_id) REFERENCES equipment(id)
      );

      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sign_out_id INTEGER NOT NULL,
        system_equipment TEXT NOT NULL,
        notes TEXT,
        FOREIGN KEY (sign_out_id) REFERENCES sign_outs(id)
      );

      CREATE TABLE IF NOT EXISTS calibration_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        equipment_id INTEGER NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        uploaded_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (equipment_id) REFERENCES equipment(id)
      );

      CREATE INDEX IF NOT EXISTS idx_equipment_type ON equipment(equipment_type_id);
      CREATE INDEX IF NOT EXISTS idx_sign_outs_equipment ON sign_outs(equipment_id);
      CREATE INDEX IF NOT EXISTS idx_sign_outs_active ON sign_outs(signed_in_at);
      CREATE INDEX IF NOT EXISTS idx_usage_sign_out ON usage(sign_out_id);
      CREATE INDEX IF NOT EXISTS idx_cal_records_equipment ON calibration_records(equipment_id);
    `);

    try {
      const cols = this.db.prepare("PRAGMA table_info(equipment)").all() as { name: string }[];
      if (!cols.some((c) => c.name === 'equipment_number')) {
        this.db.exec('ALTER TABLE equipment ADD COLUMN equipment_number TEXT UNIQUE');
      }
    } catch {
      // Column may already exist
    }

    const count = this.db.prepare('SELECT COUNT(*) as c FROM equipment_types').get() as { c: number };
    if (count.c === 0) {
      const defaults = [
        ['Temperature Logger', 1, 12],
        ['Temp & Humidity Logger', 1, 12],
        ['Laptop', 0, null],
        ['Temperature Block', 1, 12],
        ['Temperature Standard', 1, 12],
      ];
      const insert = this.db.prepare(
        'INSERT INTO equipment_types (name, requires_calibration, calibration_frequency_months) VALUES (?, ?, ?)'
      );
      for (const [name, req, freq] of defaults) {
        insert.run(name, req, freq);
      }
    }
  }

  getEquipmentTypes(): EquipmentType[] {
    return this.db.prepare('SELECT * FROM equipment_types ORDER BY name').all() as EquipmentType[];
  }

  createEquipmentType(data: { name: string; requires_calibration: boolean; calibration_frequency_months?: number }) {
    const stmt = this.db.prepare(
      'INSERT INTO equipment_types (name, requires_calibration, calibration_frequency_months) VALUES (?, ?, ?)'
    );
    return stmt.run(data.name, data.requires_calibration ? 1 : 0, data.calibration_frequency_months ?? null);
  }

  updateEquipmentType(id: number, data: Partial<{ name: string; requires_calibration: boolean; calibration_frequency_months: number | null }>) {
    const existing = this.db.prepare('SELECT * FROM equipment_types WHERE id = ?').get(id) as EquipmentType;
    if (!existing) throw new Error('Equipment type not found');
    const stmt = this.db.prepare(
      'UPDATE equipment_types SET name = ?, requires_calibration = ?, calibration_frequency_months = ? WHERE id = ?'
    );
    return stmt.run(
      data.name ?? existing.name,
      data.requires_calibration !== undefined ? (data.requires_calibration ? 1 : 0) : existing.requires_calibration,
      data.calibration_frequency_months !== undefined ? data.calibration_frequency_months : existing.calibration_frequency_months,
      id
    );
  }

  deleteEquipmentType(id: number) {
    const hasEquipment = this.db.prepare('SELECT COUNT(*) as c FROM equipment WHERE equipment_type_id = ?').get(id) as { c: number };
    if (hasEquipment.c > 0) throw new Error('Cannot delete: equipment exists of this type');
    return this.db.prepare('DELETE FROM equipment_types WHERE id = ?').run(id);
  }

  getAllEquipment(): Equipment[] {
    return this.db.prepare(`
      SELECT e.*, et.name as equipment_type_name 
      FROM equipment e 
      JOIN equipment_types et ON e.equipment_type_id = et.id 
      ORDER BY et.name, e.make, e.model
    `).all() as Equipment[];
  }

  getEquipmentById(id: number): Equipment | undefined {
    return this.db.prepare(`
      SELECT e.*, et.name as equipment_type_name 
      FROM equipment e 
      JOIN equipment_types et ON e.equipment_type_id = et.id 
      WHERE e.id = ?
    `).get(id) as Equipment | undefined;
  }

  getEquipmentByBarcode(barcode: string): Equipment | undefined {
    const trimmed = barcode.trim();
    if (!trimmed) return undefined;
    return this.db.prepare(`
      SELECT e.*, et.name as equipment_type_name 
      FROM equipment e 
      JOIN equipment_types et ON e.equipment_type_id = et.id 
      WHERE e.serial_number = ? OR e.equipment_number = ?
    `).get(trimmed, trimmed) as Equipment | undefined;
  }

  getActiveSignOutByEquipmentId(equipmentId: number): SignOut | undefined {
    return this.db.prepare(`
      SELECT s.*, e.make as equipment_make, e.model as equipment_model, e.serial_number as equipment_serial, e.equipment_number as equipment_equipment_number
      FROM sign_outs s
      JOIN equipment e ON s.equipment_id = e.id
      WHERE s.equipment_id = ? AND s.signed_in_at IS NULL
      ORDER BY s.signed_out_at DESC
      LIMIT 1
    `).get(equipmentId) as SignOut | undefined;
  }

  createEquipment(data: {
    equipment_type_id: number;
    make: string;
    model: string;
    serial_number: string;
    equipment_number?: string | null;
    last_calibration_date?: string | null;
    next_calibration_due?: string | null;
    notes?: string | null;
  }) {
    const stmt = this.db.prepare(
      'INSERT INTO equipment (equipment_type_id, make, model, serial_number, equipment_number, last_calibration_date, next_calibration_due, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    return stmt.run(
      data.equipment_type_id,
      data.make,
      data.model,
      data.serial_number,
      data.equipment_number?.trim() || null,
      data.last_calibration_date ?? null,
      data.next_calibration_due ?? null,
      data.notes ?? null
    );
  }

  updateEquipment(id: number, data: Partial<{
    equipment_type_id: number;
    make: string;
    model: string;
    serial_number: string;
    equipment_number: string | null;
    last_calibration_date: string | null;
    next_calibration_due: string | null;
    notes: string | null;
  }>) {
    const existing = this.db.prepare('SELECT * FROM equipment WHERE id = ?').get(id) as Equipment;
    if (!existing) throw new Error('Equipment not found');
    const stmt = this.db.prepare(
      'UPDATE equipment SET equipment_type_id = ?, make = ?, model = ?, serial_number = ?, equipment_number = ?, last_calibration_date = ?, next_calibration_due = ?, notes = ? WHERE id = ?'
    );
    return stmt.run(
      data.equipment_type_id ?? existing.equipment_type_id,
      data.make ?? existing.make,
      data.model ?? existing.model,
      data.serial_number ?? existing.serial_number,
      data.equipment_number !== undefined ? (data.equipment_number?.trim() || null) : existing.equipment_number,
      data.last_calibration_date !== undefined ? data.last_calibration_date : existing.last_calibration_date,
      data.next_calibration_due !== undefined ? data.next_calibration_due : existing.next_calibration_due,
      data.notes !== undefined ? data.notes : existing.notes,
      id
    );
  }

  deleteEquipment(id: number) {
    const hasSignOuts = this.db.prepare('SELECT COUNT(*) as c FROM sign_outs WHERE equipment_id = ? AND signed_in_at IS NULL').get(id) as { c: number };
    if (hasSignOuts.c > 0) throw new Error('Cannot delete: equipment is currently signed out');
    const records = this.db.prepare('SELECT file_path FROM calibration_records WHERE equipment_id = ?').all(id) as { file_path: string }[];
    for (const r of records) {
      if (fs.existsSync(r.file_path)) fs.unlinkSync(r.file_path);
    }
    this.db.prepare('DELETE FROM calibration_records WHERE equipment_id = ?').run(id);
    this.db.prepare('DELETE FROM usage WHERE sign_out_id IN (SELECT id FROM sign_outs WHERE equipment_id = ?)').run(id);
    this.db.prepare('DELETE FROM sign_outs WHERE equipment_id = ?').run(id);
    return this.db.prepare('DELETE FROM equipment WHERE id = ?').run(id);
  }

  getCalibrationStatus(): Array<Equipment & { status: 'due' | 'due_soon' | 'ok' | 'n/a'; days_until_due: number | null }> {
    const equipment = this.getAllEquipment();
    const today = new Date();
    return equipment.map((e) => {
      if (!e.next_calibration_due) {
        return { ...e, status: 'n/a' as const, days_until_due: null };
      }
      const dueDate = new Date(e.next_calibration_due);
      const daysUntil = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      let status: 'due' | 'due_soon' | 'ok' | 'n/a' = 'ok';
      if (daysUntil < 0) status = 'due';
      else if (daysUntil <= 30) status = 'due_soon';
      return { ...e, status, days_until_due: daysUntil };
    });
  }

  getAllSignOuts(): SignOut[] {
    return this.db.prepare(`
      SELECT s.*, e.make as equipment_make, e.model as equipment_model, e.serial_number as equipment_serial
      FROM sign_outs s
      JOIN equipment e ON s.equipment_id = e.id
      ORDER BY s.signed_out_at DESC
    `).all() as SignOut[];
  }

  getActiveSignOuts(): SignOut[] {
    return this.db.prepare(`
      SELECT s.*, e.make as equipment_make, e.model as equipment_model, e.serial_number as equipment_serial, e.equipment_number as equipment_equipment_number
      FROM sign_outs s
      JOIN equipment e ON s.equipment_id = e.id
      WHERE s.signed_in_at IS NULL
      ORDER BY s.signed_out_at DESC
    `).all() as SignOut[];
  }

  getSignOutsByEquipment(equipmentId: number): SignOut[] {
    return this.db.prepare(`
      SELECT s.*, e.make as equipment_make, e.model as equipment_model, e.serial_number as equipment_serial
      FROM sign_outs s
      JOIN equipment e ON s.equipment_id = e.id
      WHERE s.equipment_id = ?
      ORDER BY s.signed_out_at DESC
    `).all(equipmentId) as SignOut[];
  }

  createSignOut(data: { equipment_id: number; signed_out_by: string; purpose?: string }) {
    const stmt = this.db.prepare(
      'INSERT INTO sign_outs (equipment_id, signed_out_by, signed_out_at, purpose) VALUES (?, ?, datetime("now"), ?)'
    );
    return stmt.run(data.equipment_id, data.signed_out_by, data.purpose ?? null);
  }

  checkInSignOut(id: number, data: { signed_in_by: string }) {
    return this.db.prepare(
      'UPDATE sign_outs SET signed_in_by = ?, signed_in_at = datetime("now") WHERE id = ?'
    ).run(data.signed_in_by, id);
  }

  getUsageBySignOut(signOutId: number): Usage[] {
    return this.db.prepare('SELECT * FROM usage WHERE sign_out_id = ?').all(signOutId) as Usage[];
  }

  addUsage(data: { sign_out_id: number; system_equipment: string; notes?: string }) {
    const stmt = this.db.prepare('INSERT INTO usage (sign_out_id, system_equipment, notes) VALUES (?, ?, ?)');
    return stmt.run(data.sign_out_id, data.system_equipment, data.notes ?? null);
  }

  removeUsage(id: number) {
    return this.db.prepare('DELETE FROM usage WHERE id = ?').run(id);
  }

  getCalibrationRecords(equipmentId: number): CalibrationRecord[] {
    return this.db.prepare('SELECT * FROM calibration_records WHERE equipment_id = ? ORDER BY uploaded_at DESC').all(equipmentId) as CalibrationRecord[];
  }

  getCalibrationRecordById(id: number): CalibrationRecord | undefined {
    return this.db.prepare('SELECT * FROM calibration_records WHERE id = ?').get(id) as CalibrationRecord | undefined;
  }

  addCalibrationRecord(equipmentId: number, fileName: string, destPath: string) {
    const stmt = this.db.prepare('INSERT INTO calibration_records (equipment_id, file_name, file_path) VALUES (?, ?, ?)');
    return stmt.run(equipmentId, fileName, destPath);
  }

  deleteCalibrationRecord(id: number) {
    const rec = this.db.prepare('SELECT file_path FROM calibration_records WHERE id = ?').get(id) as { file_path: string };
    if (rec && fs.existsSync(rec.file_path)) fs.unlinkSync(rec.file_path);
    return this.db.prepare('DELETE FROM calibration_records WHERE id = ?').run(id);
  }

  close() {
    this.db.close();
  }
}
