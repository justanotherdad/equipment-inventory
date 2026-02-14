import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface EquipmentType {
  id: number;
  name: string;
  requires_calibration: boolean | number;
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
  storage_path: string;
  uploaded_at: string;
}

export interface EquipmentRequest {
  id: number;
  equipment_id: number;
  equipment_make?: string;
  equipment_model?: string;
  equipment_serial?: string;
  equipment_number?: string | null;
  equipment_type_name?: string;
  requester_name: string;
  requester_email: string;
  requester_phone: string;
  building: string;
  equipment_number_to_test: string;
  date_from: string;
  date_to: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
  created_at: string;
}

export class Database {
  private supabase: SupabaseClient;

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  private toEquipmentType(row: Record<string, unknown>): EquipmentType {
    return {
      ...row,
      requires_calibration: row.requires_calibration === true ? 1 : 0,
    } as EquipmentType;
  }

  async getEquipmentTypes(): Promise<EquipmentType[]> {
    const { data, error } = await this.supabase
      .from('equipment_types')
      .select('*')
      .order('name');
    if (error) throw error;
    return (data ?? []).map(this.toEquipmentType);
  }

  async createEquipmentType(data: { name: string; requires_calibration: boolean; calibration_frequency_months?: number }) {
    const { error } = await this.supabase.from('equipment_types').insert({
      name: data.name,
      requires_calibration: data.requires_calibration,
      calibration_frequency_months: data.calibration_frequency_months ?? null,
    });
    if (error) throw error;
  }

  async updateEquipmentType(id: number, data: Partial<{ name: string; requires_calibration: boolean; calibration_frequency_months: number | null }>) {
    const { data: existing, error: fetchErr } = await this.supabase
      .from('equipment_types')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !existing) throw new Error('Equipment type not found');
    const { error } = await this.supabase
      .from('equipment_types')
      .update({
        name: data.name ?? existing.name,
        requires_calibration: data.requires_calibration !== undefined ? data.requires_calibration : existing.requires_calibration,
        calibration_frequency_months: data.calibration_frequency_months !== undefined ? data.calibration_frequency_months : existing.calibration_frequency_months,
      })
      .eq('id', id);
    if (error) throw error;
  }

  async deleteEquipmentType(id: number) {
    const { count, error: countErr } = await this.supabase
      .from('equipment')
      .select('*', { count: 'exact', head: true })
      .eq('equipment_type_id', id);
    if (countErr) throw countErr;
    if ((count ?? 0) > 0) throw new Error('Cannot delete: equipment exists of this type');
    const { error } = await this.supabase.from('equipment_types').delete().eq('id', id);
    if (error) throw error;
  }

  async getAllEquipment(): Promise<Equipment[]> {
    const { data, error } = await this.supabase
      .from('equipment')
      .select(`
        *,
        equipment_types(name)
      `)
      .order('make')
      .order('model');
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      equipment_type_name: (r.equipment_types as { name: string })?.name,
      equipment_types: undefined,
    })) as Equipment[];
  }

  async getEquipmentById(id: number): Promise<Equipment | undefined> {
    const { data, error } = await this.supabase
      .from('equipment')
      .select(`
        *,
        equipment_types(name)
      `)
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    return {
      ...data,
      equipment_type_name: (data.equipment_types as { name: string })?.name,
      equipment_types: undefined,
    } as Equipment;
  }

  async getEquipmentByBarcode(barcode: string): Promise<Equipment | undefined> {
    const trimmed = barcode.trim();
    if (!trimmed) return undefined;
    const { data, error } = await this.supabase
      .from('equipment')
      .select(`
        *,
        equipment_types(name)
      `)
      .or(`serial_number.eq.${trimmed},equipment_number.eq.${trimmed}`)
      .limit(1)
      .single();
    if (error || !data) return undefined;
    return {
      ...data,
      equipment_type_name: (data.equipment_types as { name: string })?.name,
      equipment_types: undefined,
    } as Equipment;
  }

  async getActiveSignOutByEquipmentId(equipmentId: number): Promise<SignOut | undefined> {
    const { data, error } = await this.supabase
      .from('sign_outs')
      .select(`
        *,
        equipment(make, model, serial_number, equipment_number)
      `)
      .eq('equipment_id', equipmentId)
      .is('signed_in_at', null)
      .order('signed_out_at', { ascending: false })
      .limit(1)
      .single();
    if (error || !data) return undefined;
    const eq = data.equipment as { make: string; model: string; serial_number: string; equipment_number?: string };
    return {
      ...data,
      equipment_make: eq?.make,
      equipment_model: eq?.model,
      equipment_serial: eq?.serial_number,
      equipment_equipment_number: eq?.equipment_number,
      equipment: undefined,
    } as SignOut;
  }

  async createEquipment(data: {
    equipment_type_id: number;
    make: string;
    model: string;
    serial_number: string;
    equipment_number?: string | null;
    last_calibration_date?: string | null;
    next_calibration_due?: string | null;
    notes?: string | null;
  }): Promise<number> {
    const { data: inserted, error } = await this.supabase
      .from('equipment')
      .insert({
        equipment_type_id: data.equipment_type_id,
        make: data.make,
        model: data.model,
        serial_number: data.serial_number,
        equipment_number: data.equipment_number?.trim() || null,
        last_calibration_date: data.last_calibration_date ?? null,
        next_calibration_due: data.next_calibration_due ?? null,
        notes: data.notes ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return inserted?.id ?? 0;
  }

  async updateEquipment(id: number, data: Partial<{
    equipment_type_id: number;
    make: string;
    model: string;
    serial_number: string;
    equipment_number: string | null;
    last_calibration_date: string | null;
    next_calibration_due: string | null;
    notes: string | null;
  }>) {
    const { data: existing, error: fetchErr } = await this.supabase
      .from('equipment')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !existing) throw new Error('Equipment not found');
    const { error } = await this.supabase
      .from('equipment')
      .update({
        equipment_type_id: data.equipment_type_id ?? existing.equipment_type_id,
        make: data.make ?? existing.make,
        model: data.model ?? existing.model,
        serial_number: data.serial_number ?? existing.serial_number,
        equipment_number: data.equipment_number !== undefined ? (data.equipment_number?.trim() || null) : existing.equipment_number,
        last_calibration_date: data.last_calibration_date !== undefined ? data.last_calibration_date : existing.last_calibration_date,
        next_calibration_due: data.next_calibration_due !== undefined ? data.next_calibration_due : existing.next_calibration_due,
        notes: data.notes !== undefined ? data.notes : existing.notes,
      })
      .eq('id', id);
    if (error) throw error;
  }

  async deleteEquipment(id: number) {
    const { count, error: signOutErr } = await this.supabase
      .from('sign_outs')
      .select('*', { count: 'exact', head: true })
      .eq('equipment_id', id)
      .is('signed_in_at', null);
    if (signOutErr) throw signOutErr;
    if ((count ?? 0) > 0) throw new Error('Cannot delete: equipment is currently signed out');
    const { error: delCal } = await this.supabase.from('calibration_records').delete().eq('equipment_id', id);
    if (delCal) throw delCal;
    const signOutIds = (await this.supabase.from('sign_outs').select('id').eq('equipment_id', id)).data?.map((s) => s.id) ?? [];
    if (signOutIds.length > 0) {
      await this.supabase.from('usage').delete().in('sign_out_id', signOutIds);
    }
    await this.supabase.from('sign_outs').delete().eq('equipment_id', id);
    const { error } = await this.supabase.from('equipment').delete().eq('id', id);
    if (error) throw error;
  }

  async getCalibrationStatus(): Promise<Array<Equipment & { status: 'due' | 'due_soon' | 'ok' | 'n/a'; days_until_due: number | null }>> {
    const equipment = await this.getAllEquipment();
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

  async getAllSignOuts(): Promise<SignOut[]> {
    const { data, error } = await this.supabase
      .from('sign_outs')
      .select(`
        *,
        equipment(make, model, serial_number)
      `)
      .order('signed_out_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => {
      const eq = r.equipment as { make: string; model: string; serial_number: string };
      return {
        ...r,
        equipment_make: eq?.make,
        equipment_model: eq?.model,
        equipment_serial: eq?.serial_number,
        equipment: undefined,
      };
    }) as SignOut[];
  }

  async getActiveSignOuts(): Promise<SignOut[]> {
    const { data, error } = await this.supabase
      .from('sign_outs')
      .select(`
        *,
        equipment(make, model, serial_number, equipment_number)
      `)
      .is('signed_in_at', null)
      .order('signed_out_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => {
      const eq = r.equipment as { make: string; model: string; serial_number: string; equipment_number?: string };
      return {
        ...r,
        equipment_make: eq?.make,
        equipment_model: eq?.model,
        equipment_serial: eq?.serial_number,
        equipment_equipment_number: eq?.equipment_number,
        equipment: undefined,
      };
    }) as SignOut[];
  }

  async getSignOutsByEquipment(equipmentId: number): Promise<SignOut[]> {
    const { data, error } = await this.supabase
      .from('sign_outs')
      .select(`
        *,
        equipment(make, model, serial_number)
      `)
      .eq('equipment_id', equipmentId)
      .order('signed_out_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => {
      const eq = r.equipment as { make: string; model: string; serial_number: string };
      return {
        ...r,
        equipment_make: eq?.make,
        equipment_model: eq?.model,
        equipment_serial: eq?.serial_number,
        equipment: undefined,
      };
    }) as SignOut[];
  }

  async createSignOut(data: {
    equipment_id: number;
    signed_out_by: string;
    purpose?: string;
    equipment_request_id?: number;
    building?: string;
    equipment_number_to_test?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<number> {
    const { data: inserted, error } = await this.supabase
      .from('sign_outs')
      .insert({
        equipment_id: data.equipment_id,
        signed_out_by: data.signed_out_by,
        signed_out_at: new Date().toISOString(),
        purpose: data.purpose ?? null,
        equipment_request_id: data.equipment_request_id ?? null,
        building: data.building ?? null,
        equipment_number_to_test: data.equipment_number_to_test ?? null,
        date_from: data.date_from ?? null,
        date_to: data.date_to ?? null,
      })
      .select('id')
      .single();
    if (error) throw error;
    return inserted?.id ?? 0;
  }

  async checkInSignOut(id: number, data: { signed_in_by: string }) {
    const { error } = await this.supabase
      .from('sign_outs')
      .update({ signed_in_by: data.signed_in_by, signed_in_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  }

  async getUsageBySignOut(signOutId: number): Promise<Usage[]> {
    const { data, error } = await this.supabase.from('usage').select('*').eq('sign_out_id', signOutId);
    if (error) throw error;
    return data ?? [];
  }

  async addUsage(data: { sign_out_id: number; system_equipment: string; notes?: string }) {
    const { error } = await this.supabase.from('usage').insert({
      sign_out_id: data.sign_out_id,
      system_equipment: data.system_equipment,
      notes: data.notes ?? null,
    });
    if (error) throw error;
  }

  async removeUsage(id: number) {
    const { error } = await this.supabase.from('usage').delete().eq('id', id);
    if (error) throw error;
  }

  async getCalibrationRecords(equipmentId: number): Promise<CalibrationRecord[]> {
    const { data, error } = await this.supabase
      .from('calibration_records')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async getAllCalibrationRecords(): Promise<Array<CalibrationRecord & { equipment_make?: string; equipment_model?: string; equipment_serial?: string; equipment_number?: string | null }>> {
    const { data, error } = await this.supabase
      .from('calibration_records')
      .select('*, equipment(make, model, serial_number, equipment_number)')
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => {
      const eq = (r.equipment || {}) as { make?: string; model?: string; serial_number?: string; equipment_number?: string };
      return {
        ...r,
        equipment_make: eq.make,
        equipment_model: eq.model,
        equipment_serial: eq.serial_number,
        equipment_number: eq.equipment_number,
        equipment: undefined,
      };
    }) as Array<CalibrationRecord & { equipment_make?: string; equipment_model?: string; equipment_serial?: string; equipment_number?: string | null }>;
  }

  async getCalibrationRecordById(id: number): Promise<CalibrationRecord | undefined> {
    const { data, error } = await this.supabase
      .from('calibration_records')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return undefined;
    return data as CalibrationRecord;
  }

  async addCalibrationRecord(equipmentId: number, fileName: string, storagePath: string) {
    const { error } = await this.supabase.from('calibration_records').insert({
      equipment_id: equipmentId,
      file_name: fileName,
      storage_path: storagePath,
    });
    if (error) throw error;
  }

  // Equipment Requests
  async getEquipmentRequests(status?: 'pending' | 'approved' | 'rejected'): Promise<EquipmentRequest[]> {
    let q = this.supabase
      .from('equipment_requests')
      .select('*, equipment(make, model, serial_number, equipment_number)')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => {
      const eq = (r.equipment || {}) as { make?: string; model?: string; serial_number?: string; equipment_number?: string };
      return {
        ...r,
        equipment_make: eq.make,
        equipment_model: eq.model,
        equipment_serial: eq.serial_number,
        equipment_number: eq.equipment_number,
        equipment_type_name: null as string | undefined,
        equipment: undefined,
      };
    }) as EquipmentRequest[];
  }

  async createEquipmentRequest(data: {
    equipment_id: number;
    requester_name: string;
    requester_email: string;
    requester_phone: string;
    building: string;
    equipment_number_to_test: string;
    date_from: string;
    date_to: string;
  }) {
    const { error } = await this.supabase.from('equipment_requests').insert({
      equipment_id: data.equipment_id,
      requester_name: data.requester_name,
      requester_email: data.requester_email,
      requester_phone: data.requester_phone,
      building: data.building,
      equipment_number_to_test: data.equipment_number_to_test,
      date_from: data.date_from,
      date_to: data.date_to,
    });
    if (error) throw error;
  }

  async approveEquipmentRequest(
    id: number,
    reviewedBy: string
  ): Promise<{ equipment_id: number; requester_name: string; building: string; equipment_number_to_test: string; date_from: string; date_to: string }> {
    const { data: req, error: fetchErr } = await this.supabase
      .from('equipment_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchErr || !req) throw new Error('Request not found');
    if (req.status !== 'pending') throw new Error('Request already reviewed');
    const { error } = await this.supabase
      .from('equipment_requests')
      .update({
        status: 'approved',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw error;
    return {
      equipment_id: req.equipment_id,
      requester_name: req.requester_name,
      building: req.building,
      equipment_number_to_test: req.equipment_number_to_test,
      date_from: req.date_from,
      date_to: req.date_to,
    };
  }

  async rejectEquipmentRequest(id: number, reviewedBy: string, comment?: string) {
    const { data: req, error: fetchErr } = await this.supabase
      .from('equipment_requests')
      .select('status')
      .eq('id', id)
      .single();
    if (fetchErr || !req) throw new Error('Request not found');
    if (req.status !== 'pending') throw new Error('Request already reviewed');
    const { error } = await this.supabase
      .from('equipment_requests')
      .update({
        status: 'rejected',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        review_comment: comment ?? null,
      })
      .eq('id', id);
    if (error) throw error;
  }

  async deleteCalibrationRecord(id: number): Promise<{ storage_path: string } | null> {
    const { data, error: fetchErr } = await this.supabase
      .from('calibration_records')
      .select('storage_path')
      .eq('id', id)
      .single();
    if (fetchErr || !data) return null;
    const { error } = await this.supabase.from('calibration_records').delete().eq('id', id);
    if (error) throw error;
    return data as { storage_path: string };
  }
}
