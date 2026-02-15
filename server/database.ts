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
  department_id?: number | null;
  department_name?: string | null;
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

export interface Profile {
  id: number;
  auth_user_id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  role: 'user' | 'equipment_manager' | 'admin';
  created_at: string;
  updated_at: string;
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

  async getProfileByAuthUserId(authUserId: string): Promise<Profile | undefined> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();
    if (error || !data) return undefined;
    return data as Profile;
  }

  async upsertProfile(authUserId: string, email: string, role: 'user' | 'equipment_manager' | 'admin'): Promise<Profile> {
    const existing = await this.getProfileByAuthUserId(authUserId);
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const isAdminEmail = adminEmail && email.toLowerCase() === adminEmail;

    if (existing) {
      const newRole = isAdminEmail ? 'admin' : existing.role;
      const { data, error } = await this.supabase
        .from('profiles')
        .update({
          email,
          role: newRole,
          updated_at: new Date().toISOString(),
        })
        .eq('auth_user_id', authUserId)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    }

    const { data, error } = await this.supabase
      .from('profiles')
      .insert({
        auth_user_id: authUserId,
        email,
        role: isAdminEmail ? 'admin' : role,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  }

  /** Returns department IDs the profile can access. Null = no filter (admin). */
  async getAllowedDepartmentIds(profile: Profile): Promise<number[] | null> {
    if (profile.role === 'admin') return null;

    const { data: accessRows, error } = await this.supabase
      .from('profile_access')
      .select('site_id, department_id')
      .eq('profile_id', profile.id);
    if (error) throw error;
    if (!accessRows?.length) return []; // No access = see nothing

    const deptIds: number[] = [];
    for (const row of accessRows as { site_id: number; department_id: number | null }[]) {
      if (row.department_id) {
        deptIds.push(row.department_id);
      } else {
        const { data: depts } = await this.supabase
          .from('departments')
          .select('id')
          .eq('site_id', row.site_id);
        (depts ?? []).forEach((d: { id: number }) => deptIds.push(d.id));
      }
    }
    return [...new Set(deptIds)];
  }

  async getAllProfiles(): Promise<Profile[]> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .order('email');
    if (error) throw error;
    return (data ?? []) as Profile[];
  }

  async updateProfileRole(profileId: number, role: 'user' | 'equipment_manager' | 'admin') {
    const { error } = await this.supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', profileId);
    if (error) throw error;
  }

  async getSites(): Promise<{ id: number; name: string }[]> {
    const { data, error } = await this.supabase.from('sites').select('id, name').order('name');
    if (error) throw error;
    return (data ?? []) as { id: number; name: string }[];
  }

  async getDepartments(): Promise<{ id: number; site_id: number; name: string; site_name?: string }[]> {
    const { data, error } = await this.supabase
      .from('departments')
      .select('id, site_id, name, sites(name)')
      .order('name');
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      site_id: r.site_id,
      name: r.name,
      site_name: (r.sites as { name: string })?.name,
    })) as { id: number; site_id: number; name: string; site_name?: string }[];
  }

  async getProfileAccess(profileId: number): Promise<{ site_id: number; department_id: number | null; site_name?: string; department_name?: string }[]> {
    const { data, error } = await this.supabase
      .from('profile_access')
      .select('site_id, department_id, sites(name), departments(name)')
      .eq('profile_id', profileId);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      site_id: r.site_id,
      department_id: r.department_id,
      site_name: (r.sites as { name: string })?.name,
      department_name: (r.departments as { name: string })?.name,
    })) as { site_id: number; department_id: number | null; site_name?: string; department_name?: string }[];
  }

  async setProfileAccess(profileId: number, access: { site_id: number; department_id?: number | null }[]) {
    await this.supabase.from('profile_access').delete().eq('profile_id', profileId);
    if (access.length === 0) return;
    const rows = access.map((a) => ({
      profile_id: profileId,
      site_id: a.site_id,
      department_id: a.department_id ?? null,
    }));
    const { error } = await this.supabase.from('profile_access').insert(rows);
    if (error) throw error;
  }

  async createSite(name: string) {
    const { error } = await this.supabase.from('sites').insert({ name });
    if (error) throw error;
  }

  async createDepartment(siteId: number, name: string) {
    const { error } = await this.supabase.from('departments').insert({ site_id: siteId, name });
    if (error) throw error;
  }

  async getDepartmentsForProfile(profile?: Profile): Promise<{ id: number; site_id: number; name: string; site_name?: string }[]> {
    const all = await this.getDepartments();
    if (!profile || profile.role === 'admin') return all;
    const allowed = await this.getAllowedDepartmentIds(profile);
    if (allowed === null) return all;
    if (allowed.length === 0) return [];
    return all.filter((d) => allowed.includes(d.id));
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

  async getAllEquipment(profile?: Profile): Promise<Equipment[]> {
    let q = this.supabase
      .from('equipment')
      .select(`
        *,
        equipment_types(name),
        departments(name)
      `)
      .order('make')
      .order('model');

    if (profile) {
      const allowed = await this.getAllowedDepartmentIds(profile);
      if (allowed !== null) {
        if (allowed.length === 0) return [];
        q = q.in('department_id', allowed);
      }
    }

    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      equipment_type_name: (r.equipment_types as { name: string })?.name,
      department_name: (r.departments as { name: string })?.name,
      equipment_types: undefined,
      departments: undefined,
    })) as Equipment[];
  }

  async getEquipmentById(id: number, profile?: Profile): Promise<Equipment | undefined> {
    const { data, error } = await this.supabase
      .from('equipment')
      .select(`
        *,
        equipment_types(name),
        departments(name)
      `)
      .eq('id', id)
      .single();
    if (error || !data) return undefined;

    if (profile) {
      const allowed = await this.getAllowedDepartmentIds(profile);
      if (allowed !== null) {
        const deptId = (data as { department_id?: number }).department_id;
        if (deptId == null || !allowed.includes(deptId)) return undefined;
      }
    }

    return {
      ...data,
      equipment_type_name: (data.equipment_types as { name: string })?.name,
      department_name: (data.departments as { name: string })?.name,
      equipment_types: undefined,
      departments: undefined,
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
    department_id?: number | null;
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
        department_id: data.department_id ?? null,
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
    department_id: number | null;
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
        department_id: data.department_id !== undefined ? data.department_id : existing.department_id,
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

  async getCalibrationStatus(profile?: Profile): Promise<Array<Equipment & { status: 'due' | 'due_soon' | 'ok' | 'n/a'; days_until_due: number | null }>> {
    const equipment = await this.getAllEquipment(profile);
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

  async getAllSignOuts(profile?: Profile): Promise<SignOut[]> {
    const { data, error } = await this.supabase
      .from('sign_outs')
      .select(`
        *,
        equipment(make, model, serial_number, equipment_number, department_id)
      `)
      .order('signed_out_at', { ascending: false });
    if (error) throw error;
    let rows = (data ?? []).map((r: Record<string, unknown>) => {
      const eq = r.equipment as { make: string; model: string; serial_number: string; equipment_number?: string; department_id?: number | null };
      return {
        ...r,
        equipment_make: eq?.make,
        equipment_model: eq?.model,
        equipment_serial: eq?.serial_number,
        equipment_equipment_number: eq?.equipment_number,
        equipment: undefined,
        _department_id: eq?.department_id,
      };
    });
    if (profile) {
      const allowed = await this.getAllowedDepartmentIds(profile);
      if (allowed !== null && allowed.length > 0) {
        rows = rows.filter((r: { _department_id?: number | null }) => r._department_id != null && allowed.includes(r._department_id));
      } else if (allowed !== null) {
        rows = [];
      }
    }
    return rows.map((r: Record<string, unknown>) => {
      const { _department_id, ...rest } = r;
      return rest;
    }) as SignOut[];
  }

  async getActiveSignOuts(profile?: Profile): Promise<SignOut[]> {
    const all = await this.getAllSignOuts(profile);
    return all.filter((s) => !s.signed_in_at);
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

  async getAllCalibrationRecords(profile?: Profile): Promise<Array<CalibrationRecord & { equipment_make?: string; equipment_model?: string; equipment_serial?: string; equipment_number?: string | null }>> {
    const { data, error } = await this.supabase
      .from('calibration_records')
      .select('*, equipment(make, model, serial_number, equipment_number, department_id)')
      .order('uploaded_at', { ascending: false });
    if (error) throw error;
    let rows = (data ?? []).map((r: Record<string, unknown>) => {
      const eq = (r.equipment || {}) as { make?: string; model?: string; serial_number?: string; equipment_number?: string; department_id?: number | null };
      return {
        ...r,
        equipment_make: eq.make,
        equipment_model: eq.model,
        equipment_serial: eq.serial_number,
        equipment_number: eq.equipment_number,
        equipment: undefined,
        _department_id: eq.department_id,
      };
    });
    if (profile) {
      const allowed = await this.getAllowedDepartmentIds(profile);
      if (allowed !== null && allowed.length > 0) {
        rows = rows.filter((r: { _department_id?: number | null }) => r._department_id != null && allowed.includes(r._department_id));
      } else if (allowed !== null) {
        rows = [];
      }
    }
    return rows.map((r: Record<string, unknown>) => {
      const { _department_id, ...rest } = r;
      return rest;
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
  async getEquipmentRequests(status?: 'pending' | 'approved' | 'rejected', profile?: Profile): Promise<EquipmentRequest[]> {
    let q = this.supabase
      .from('equipment_requests')
      .select('*, equipment(make, model, serial_number, equipment_number, department_id)')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    let rows = (data ?? []).map((r: Record<string, unknown>) => {
      const eq = (r.equipment || {}) as { make?: string; model?: string; serial_number?: string; equipment_number?: string; department_id?: number | null };
      return {
        ...r,
        equipment_make: eq.make,
        equipment_model: eq.model,
        equipment_serial: eq.serial_number,
        equipment_number: eq.equipment_number,
        equipment_type_name: null as string | undefined,
        equipment: undefined,
        _department_id: eq.department_id,
      };
    });
    if (profile) {
      const allowed = await this.getAllowedDepartmentIds(profile);
      if (allowed !== null && allowed.length > 0) {
        rows = rows.filter((r: { _department_id?: number | null }) => r._department_id != null && allowed.includes(r._department_id));
      } else if (allowed !== null) {
        rows = [];
      }
    }
    return rows.map((r: Record<string, unknown>) => {
      const { _department_id, ...rest } = r;
      return rest;
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
