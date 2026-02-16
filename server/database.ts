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
  site_name?: string | null;
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
  role: 'user' | 'equipment_manager' | 'company_admin' | 'super_admin';
  company_id?: number | null;
  onboarding_complete?: boolean;
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

  async upsertProfile(authUserId: string, email: string, role: 'user' | 'equipment_manager' | 'company_admin' | 'super_admin'): Promise<Profile> {
    const existing = await this.getProfileByAuthUserId(authUserId);
    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
    const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const emailLower = email.toLowerCase();
    const isSuperAdmin = superAdminEmail && emailLower === superAdminEmail;
    const isAdminEmail = !isSuperAdmin && adminEmail && emailLower === adminEmail;

    if (existing) {
      const newRole = isSuperAdmin ? 'super_admin' : isAdminEmail ? 'super_admin' : existing.role;
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
        role: isSuperAdmin || isAdminEmail ? 'super_admin' : role,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Profile;
  }

  /** Returns department IDs the profile can access. Null = no filter (super_admin/company_admin). */
  async getAllowedDepartmentIds(profile: Profile): Promise<number[] | null> {
    if (profile.role === 'super_admin' || profile.role === 'company_admin') return null;

    const { data: accessRows, error } = await this.supabase
      .from('profile_access')
      .select('site_id, department_id, equipment_id')
      .eq('profile_id', profile.id);
    if (error) throw error;
    if (!accessRows?.length) return []; // No access = see nothing

    const deptIds: number[] = [];
    for (const row of accessRows as { site_id: number; department_id: number | null; equipment_id?: number | null }[]) {
      if (row.equipment_id) {
        const { data: eq } = await this.supabase.from('equipment').select('department_id').eq('id', row.equipment_id).single();
        if (eq?.department_id) deptIds.push(eq.department_id);
      } else if (row.department_id) {
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

  /** Returns equipment IDs the profile has equipment-level access to. Empty = no equipment-level restriction. */
  async getAllowedEquipmentIds(profile: Profile): Promise<number[]> {
    if (profile.role === 'super_admin' || profile.role === 'company_admin') return [];
    const { data, error } = await this.supabase
      .from('profile_access')
      .select('equipment_id')
      .eq('profile_id', profile.id)
      .not('equipment_id', 'is', null);
    if (error) throw error;
    return (data ?? []).map((r: { equipment_id: number }) => r.equipment_id).filter(Boolean);
  }

  async getAllProfiles(adminProfile?: Profile): Promise<(Profile & { company_name?: string | null })[]> {
    let q = this.supabase.from('profiles').select('*, companies(name)').order('email');
    if (adminProfile?.role === 'company_admin') {
      const companyId = adminProfile.company_id ?? (await this.supabase.from('companies').select('id').limit(1).single()).data?.id;
      if (companyId) q = q.eq('company_id', companyId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      ...r,
      company_name: (r.companies as { name: string } | null)?.name ?? null,
      companies: undefined,
    })) as (Profile & { company_name?: string | null })[];
  }

  async createUserProfile(
    authUserId: string,
    email: string,
    role: 'user' | 'equipment_manager' | 'company_admin' | 'super_admin',
    creatorProfile: Profile,
    access: { site_id: number; department_id?: number | null; equipment_id?: number | null }[],
    companyId?: number | null,
    displayName?: string | null
  ): Promise<Profile> {
    const assignedCompanyId = companyId ?? (creatorProfile.role === 'company_admin' ? creatorProfile.company_id : null);
    const payload: Record<string, unknown> = {
      auth_user_id: authUserId,
      email: email.toLowerCase(),
      role,
      company_id: assignedCompanyId ?? null,
      onboarding_complete: role === 'company_admin' ? false : undefined,
    };
    if (displayName !== undefined && displayName !== null) payload.display_name = displayName;
    const { data: profile, error } = await this.supabase
      .from('profiles')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    if (access.length > 0 && (profile as Profile).id) {
      let filtered = access;
      if (creatorProfile.role === 'equipment_manager' || creatorProfile.role === 'company_admin') {
        const creatorAccess = await this.getProfileAccess(creatorProfile.id);
        const siteIds = new Set(creatorAccess.map((a) => a.site_id));
        filtered = access.filter((a) => siteIds.has(a.site_id));
      }
      if (filtered.length > 0) {
        await this.setProfileAccess((profile as Profile).id, filtered);
      }
    }
    return profile as Profile;
  }

  async updateProfileRole(profileId: number, role: 'user' | 'equipment_manager' | 'company_admin' | 'super_admin') {
    const { error } = await this.supabase
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', profileId);
    if (error) throw error;
  }

  async updateProfile(profileId: number, data: { display_name?: string | null; email?: string; company_id?: number | null }) {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.display_name !== undefined) payload.display_name = data.display_name;
    if (data.email !== undefined) payload.email = data.email.toLowerCase();
    if (data.company_id !== undefined) payload.company_id = data.company_id;
    const { error } = await this.supabase.from('profiles').update(payload).eq('id', profileId);
    if (error) throw error;
  }

  async getProfileById(profileId: number): Promise<Profile | undefined> {
    const { data, error } = await this.supabase.from('profiles').select('*').eq('id', profileId).single();
    if (error || !data) return undefined;
    return data as Profile;
  }

  async setOnboardingComplete(profileId: number): Promise<void> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ onboarding_complete: true, updated_at: new Date().toISOString() })
      .eq('id', profileId);
    if (error) throw error;
  }

  async deleteProfile(profileId: number) {
    await this.supabase.from('profile_access').delete().eq('profile_id', profileId);
    const { error } = await this.supabase.from('profiles').delete().eq('id', profileId);
    if (error) throw error;
  }

  async getDefaultCompanyId(): Promise<number | null> {
    const { data } = await this.supabase.from('companies').select('id').limit(1).single();
    return data?.id ?? null;
  }

  async getAllCompanies(): Promise<{ id: number; name: string; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; address_line1?: string | null; subscription_level: number; subscription_active: boolean; subscription_activated_at: string | null }[]> {
    const { data, error } = await this.supabase
      .from('companies')
      .select('id, name, contact_name, contact_email, contact_phone, address_line1, address_line2, address_city, address_state, address_zip, subscription_level, subscription_active, subscription_activated_at')
      .order('name');
    if (error) throw error;
    return (data ?? []) as { id: number; name: string; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; address_line1?: string | null; subscription_level: number; subscription_active: boolean; subscription_activated_at: string | null }[];
  }

  async getCompanyById(id: number) {
    const { data, error } = await this.supabase.from('companies').select('*').eq('id', id).single();
    if (error || !data) return undefined;
    return data as Record<string, unknown>;
  }

  async updateCompany(id: number, data: { name?: string; contact_name?: string | null; contact_email?: string | null; contact_phone?: string | null; address_line1?: string | null; address_line2?: string | null; address_city?: string | null; address_state?: string | null; address_zip?: string | null; subscription_level?: number; subscription_active?: boolean }) {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.name !== undefined) payload.name = data.name;
    if (data.contact_name !== undefined) payload.contact_name = data.contact_name;
    if (data.contact_email !== undefined) payload.contact_email = data.contact_email;
    if (data.contact_phone !== undefined) payload.contact_phone = data.contact_phone;
    if (data.address_line1 !== undefined) payload.address_line1 = data.address_line1;
    if (data.address_line2 !== undefined) payload.address_line2 = data.address_line2;
    if (data.address_city !== undefined) payload.address_city = data.address_city;
    if (data.address_state !== undefined) payload.address_state = data.address_state;
    if (data.address_zip !== undefined) payload.address_zip = data.address_zip;
    if (data.subscription_level !== undefined) payload.subscription_level = data.subscription_level;
    if (data.subscription_active !== undefined) {
      payload.subscription_active = data.subscription_active;
      if (data.subscription_active) payload.subscription_activated_at = new Date().toISOString();
    }
    const { error } = await this.supabase.from('companies').update(payload).eq('id', id);
    if (error) throw error;
  }

  async createCompany(name: string, contactEmail?: string | null, contactName?: string | null) {
    const { data, error } = await this.supabase.from('companies').insert({
      name,
      contact_email: contactEmail ?? null,
      contact_name: contactName ?? null,
    }).select('id').single();
    if (error) throw error;
    return (data as { id: number })?.id ?? null;
  }

  async deleteCompany(companyId: number): Promise<{ storagePaths: string[]; authUserIds: string[] }> {
    const { data: companySites } = await this.supabase.from('sites').select('id').eq('company_id', companyId);
    const siteIds = (companySites ?? []).map((s: { id: number }) => s.id);
    const { data: companyDepts } = await this.supabase.from('departments').select('id').in('site_id', siteIds);
    const deptIds = (companyDepts ?? []).map((d: { id: number }) => d.id);
    const { data: companyEquipment } = await this.supabase.from('equipment').select('id').in('department_id', deptIds.length ? deptIds : [-1]);
    const equipmentIds = (companyEquipment ?? []).map((e: { id: number }) => e.id);

    const storagePaths: string[] = [];
    for (const eqId of equipmentIds) {
      const { data: calRecords } = await this.supabase.from('calibration_records').select('storage_path').eq('equipment_id', eqId);
      for (const r of calRecords ?? []) storagePaths.push((r as { storage_path: string }).storage_path);
    }

    const checkoutIdsToDelete = new Set<number>();
    for (const eqId of equipmentIds) {
      const signOuts = (await this.supabase.from('sign_outs').select('id, checkout_id').eq('equipment_id', eqId)).data ?? [];
      const signOutIds = signOuts.map((s: { id: number }) => s.id);
      for (const s of signOuts) {
        const cid = (s as { checkout_id?: number }).checkout_id;
        if (cid) checkoutIdsToDelete.add(cid);
      }
      if (signOutIds.length) await this.supabase.from('usage').delete().in('sign_out_id', signOutIds);
      await this.supabase.from('sign_outs').delete().eq('equipment_id', eqId);
    }
    for (const cid of checkoutIdsToDelete) {
      await this.supabase.from('checkouts').delete().eq('id', cid);
    }
    await this.supabase.from('equipment_requests').delete().in('equipment_id', equipmentIds.length ? equipmentIds : [-1]);
    for (const eqId of equipmentIds) {
      await this.supabase.from('calibration_records').delete().eq('equipment_id', eqId);
    }
    await this.supabase.from('equipment').delete().in('id', equipmentIds.length ? equipmentIds : [-1]);

    const { data: companyProfiles } = await this.supabase.from('profiles').select('id, auth_user_id').eq('company_id', companyId);
    const authUserIds: string[] = (companyProfiles ?? []).map((p) => (p as { auth_user_id: string }).auth_user_id).filter(Boolean);
    for (const p of companyProfiles ?? []) {
      await this.supabase.from('profile_access').delete().eq('profile_id', (p as { id: number }).id);
    }
    await this.supabase.from('profiles').delete().eq('company_id', companyId);
    await this.supabase.from('departments').delete().in('site_id', siteIds.length ? siteIds : [-1]);
    await this.supabase.from('sites').delete().eq('company_id', companyId);
    const { error } = await this.supabase.from('companies').delete().eq('id', companyId);
    if (error) throw error;
    return { storagePaths, authUserIds };
  }

  async updateCompanySubscription(companyId: number, subscriptionActive: boolean, subscriptionLevel?: number) {
    const payload: Record<string, unknown> = {
      subscription_active: subscriptionActive,
      updated_at: new Date().toISOString(),
    };
    if (subscriptionActive) {
      payload.subscription_activated_at = new Date().toISOString();
    }
    if (subscriptionLevel !== undefined) {
      payload.subscription_level = subscriptionLevel;
    }
    const { error } = await this.supabase
      .from('companies')
      .update(payload)
      .eq('id', companyId);
    if (error) throw error;
  }

  async getSites(adminProfile?: Profile): Promise<{ id: number; name: string; company_id?: number | null; company_name?: string | null }[]> {
    let q = this.supabase.from('sites').select('id, name, company_id, companies(name)').order('name');
    if (adminProfile?.role === 'company_admin') {
      const companyId = adminProfile.company_id ?? (await this.supabase.from('companies').select('id').limit(1).single()).data?.id;
      if (companyId) q = q.eq('company_id', companyId);
    }
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      id: r.id,
      name: r.name,
      company_id: r.company_id,
      company_name: (r.companies as { name: string } | null)?.name ?? null,
    })) as { id: number; name: string; company_id?: number | null; company_name?: string | null }[];
  }

  async updateSite(id: number, name: string, companyId?: number | null) {
    const payload: Record<string, unknown> = { name };
    if (companyId !== undefined) payload.company_id = companyId;
    const { error } = await this.supabase.from('sites').update(payload).eq('id', id);
    if (error) throw error;
  }

  async deleteSite(id: number) {
    const { error } = await this.supabase.from('sites').delete().eq('id', id);
    if (error) throw error;
  }

  async getDepartments(adminProfile?: Profile): Promise<{ id: number; site_id: number; name: string; site_name?: string; company_name?: string | null }[]> {
    let q = this.supabase
      .from('departments')
      .select('id, site_id, name, sites(name, company_id, companies(name))')
      .order('name');
    const { data, error } = await q;
    if (error) throw error;
    let rows = (data ?? []).map((r: Record<string, unknown>) => {
      const sites = r.sites as { name: string; company_id?: number | null; companies?: { name: string } | null } | null;
      return {
        id: r.id,
        site_id: r.site_id,
        name: r.name,
        site_name: sites?.name,
        _company_id: sites?.company_id,
        company_name: sites?.companies?.name ?? null,
      };
    });
    if (adminProfile?.role === 'company_admin') {
      const companyId = adminProfile.company_id ?? (await this.supabase.from('companies').select('id').limit(1).single()).data?.id;
      if (companyId) rows = rows.filter((r: { _company_id?: number | null }) => r._company_id === companyId);
    }
    return rows.map((r: Record<string, unknown>) => {
      const { _company_id, ...rest } = r;
      return rest;
    }) as { id: number; site_id: number; name: string; site_name?: string; company_name?: string | null }[];
  }

  async updateDepartment(id: number, name: string, siteId: number) {
    const { error } = await this.supabase.from('departments').update({ name, site_id: siteId }).eq('id', id);
    if (error) throw error;
  }

  async deleteDepartment(id: number) {
    const { error } = await this.supabase.from('departments').delete().eq('id', id);
    if (error) throw error;
  }

  async getProfileAccess(profileId: number): Promise<{ site_id: number; department_id: number | null; equipment_id?: number | null; site_name?: string; department_name?: string }[]> {
    const { data, error } = await this.supabase
      .from('profile_access')
      .select('site_id, department_id, equipment_id, sites(name), departments(name)')
      .eq('profile_id', profileId);
    if (error) throw error;
    return (data ?? []).map((r: Record<string, unknown>) => ({
      site_id: r.site_id,
      department_id: r.department_id,
      equipment_id: r.equipment_id ?? null,
      site_name: (r.sites as { name: string })?.name,
      department_name: (r.departments as { name: string })?.name,
    })) as { site_id: number; department_id: number | null; equipment_id?: number | null; site_name?: string; department_name?: string }[];
  }

  async setProfileAccess(profileId: number, access: { site_id: number; department_id?: number | null; equipment_id?: number | null }[]) {
    await this.supabase.from('profile_access').delete().eq('profile_id', profileId);
    if (access.length === 0) return;
    const rows = access.map((a) => ({
      profile_id: profileId,
      site_id: a.site_id,
      department_id: a.department_id ?? null,
      equipment_id: a.equipment_id ?? null,
    }));
    const { error } = await this.supabase.from('profile_access').insert(rows);
    if (error) throw error;
  }

  async createSite(name: string, companyId?: number | null) {
    const { error } = await this.supabase.from('sites').insert({ name, company_id: companyId ?? null });
    if (error) throw error;
  }

  async createDepartment(siteId: number, name: string) {
    const { error } = await this.supabase.from('departments').insert({ site_id: siteId, name });
    if (error) throw error;
  }

  /** Returns true if the department belongs to the given company (via site). */
  async isDepartmentInCompany(departmentId: number, companyId: number): Promise<boolean> {
    const { data: dept, error } = await this.supabase
      .from('departments')
      .select('site_id')
      .eq('id', departmentId)
      .single();
    if (error || !dept?.site_id) return false;
    const { data: site } = await this.supabase
      .from('sites')
      .select('company_id')
      .eq('id', dept.site_id)
      .single();
    return (site as { company_id?: number | null })?.company_id === companyId;
  }

  async getDepartmentsForProfile(profile?: Profile): Promise<{ id: number; site_id: number; name: string; site_name?: string }[]> {
    const all = await this.getDepartments();
    if (!profile || profile.role === 'super_admin' || profile.role === 'company_admin') return all;
    const allowed = await this.getAllowedDepartmentIds(profile);
    if (allowed === null) return all;
    if (allowed.length === 0) return [];
    return all.filter((d) => allowed.includes(d.id));
  }

  /** Sites the profile can access (for checkout form). Super/company admin see all; equipment managers see sites from their department access. */
  async getSitesForProfile(profile?: Profile): Promise<{ id: number; name: string }[]> {
    if (profile?.role === 'super_admin' || profile?.role === 'company_admin') {
      const sites = await this.getSites(profile);
      return sites.map((s) => ({ id: s.id, name: s.name }));
    }
    const depts = await this.getDepartmentsForProfile(profile);
    const siteIds = [...new Set(depts.map((d) => d.site_id))];
    if (siteIds.length === 0) return [];
    const { data, error } = await this.supabase
      .from('sites')
      .select('id, name')
      .in('id', siteIds)
      .order('name');
    if (error) throw error;
    return (data ?? []) as { id: number; name: string }[];
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
        departments(name, sites(name))
      `)
      .order('make')
      .order('model');

    let allowedEquip: number[] = [];
    if (profile) {
      const [allowedDepts, equipIds] = await Promise.all([
        this.getAllowedDepartmentIds(profile),
        this.getAllowedEquipmentIds(profile),
      ]);
      allowedEquip = equipIds;

      if (profile.role === 'company_admin' && profile.company_id) {
        const { data: companySites } = await this.supabase
          .from('sites')
          .select('id')
          .eq('company_id', profile.company_id);
        const siteIds = (companySites ?? []).map((s: { id: number }) => s.id);
        if (siteIds.length === 0) return [];
        const { data: companyDepts } = await this.supabase
          .from('departments')
          .select('id')
          .in('site_id', siteIds);
        const deptIds = (companyDepts ?? []).map((d: { id: number }) => d.id);
        if (deptIds.length === 0) return [];
        q = q.in('department_id', deptIds);
      } else if (allowedDepts !== null) {
        if (allowedDepts.length === 0) return [];
        q = q.in('department_id', allowedDepts);
      }
    }

    const { data, error } = await q;
    if (error) throw error;
    let rows = (data ?? []).map((r: Record<string, unknown>) => {
      const dept = r.departments as { name?: string; sites?: { name: string } } | null;
      return {
        ...r,
        equipment_type_name: (r.equipment_types as { name: string })?.name,
        department_name: dept?.name ?? null,
        site_name: dept?.sites?.name ?? null,
        equipment_types: undefined,
        departments: undefined,
      };
    }) as Equipment[];
    if (allowedEquip.length > 0) {
      const equipSet = new Set(allowedEquip);
      rows = rows.filter((e) => equipSet.has(e.id));
    }
    return rows;
  }

  async getEquipmentById(id: number, profile?: Profile): Promise<Equipment | undefined> {
    const { data, error } = await this.supabase
      .from('equipment')
      .select(`
        *,
        equipment_types(name),
        departments(name, sites(name, company_id))
      `)
      .eq('id', id)
      .single();
    if (error || !data) return undefined;

    if (profile) {
      if (profile.role === 'company_admin' && profile.company_id) {
        const dept = data.departments as { sites?: { company_id?: number | null } } | null;
        const companyId = dept?.sites?.company_id;
        if (companyId !== profile.company_id) return undefined;
      } else {
        const [allowedDepts, allowedEquip] = await Promise.all([
          this.getAllowedDepartmentIds(profile),
          this.getAllowedEquipmentIds(profile),
        ]);
        if (allowedDepts !== null) {
          const deptId = (data as { department_id?: number }).department_id;
          if (deptId == null || !allowedDepts.includes(deptId)) return undefined;
        }
        if (allowedEquip.length > 0 && !allowedEquip.includes(id)) return undefined;
      }
    }

    const dept = data.departments as { name?: string; sites?: { name: string } } | null;
    return {
      ...data,
      equipment_type_name: (data.equipment_types as { name: string })?.name,
      department_name: dept?.name ?? null,
      site_name: dept?.sites?.name ?? null,
      equipment_types: undefined,
      departments: undefined,
    } as Equipment;
  }

  async getEquipmentByBarcode(barcode: string, profile?: Profile): Promise<Equipment | undefined> {
    const trimmed = barcode.trim();
    if (!trimmed) return undefined;
    let q = this.supabase
      .from('equipment')
      .select(`
        *,
        equipment_types(name),
        departments(name, sites(name, company_id))
      `)
      .or(`serial_number.eq.${trimmed},equipment_number.eq.${trimmed}`)
      .limit(1);
    const { data, error } = await q.single();
    if (error || !data) return undefined;
    if (profile?.role === 'company_admin' && profile.company_id) {
      const dept = data.departments as { sites?: { company_id?: number | null } } | null;
      const companyId = dept?.sites?.company_id;
      if (companyId !== profile.company_id) return undefined;
    }
    const dept = data.departments as { name?: string; sites?: { name: string } } | null;
    return {
      ...data,
      equipment_type_name: (data.equipment_types as { name: string })?.name,
      department_name: dept?.name ?? null,
      site_name: dept?.sites?.name ?? null,
      equipment_types: undefined,
      departments: undefined,
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
    const eqId = inserted?.id ?? 0;
    if (eqId && data.department_id) {
      await this.autoAddEquipmentToDepartmentAccess(eqId, data.department_id);
    }
    return eqId;
  }

  /** Auto-add new equipment to profile_access for users with equipment-level access in this department */
  private async autoAddEquipmentToDepartmentAccess(equipmentId: number, departmentId: number) {
    const { data: dept } = await this.supabase.from('departments').select('site_id').eq('id', departmentId).single();
    if (!dept?.site_id) return;
    const { data: accessRows } = await this.supabase
      .from('profile_access')
      .select('profile_id, site_id, department_id')
      .eq('site_id', dept.site_id)
      .eq('department_id', departmentId)
      .not('equipment_id', 'is', null);
    const profileIds = [...new Set((accessRows ?? []).map((r: { profile_id: number }) => r.profile_id))];
    for (const profileId of profileIds) {
      await this.supabase.from('profile_access').insert({
        profile_id: profileId,
        site_id: dept.site_id,
        department_id: departmentId,
        equipment_id: equipmentId,
      });
    }
  }

  async bulkUpdateEquipment(ids: number[], data: Partial<{
    equipment_type_id: number;
    department_id: number | null;
    make: string;
    model: string;
    serial_number: string;
    equipment_number: string | null;
    last_calibration_date: string | null;
    next_calibration_due: string | null;
    notes: string | null;
  }>, profile?: Profile) {
    if (ids.length === 0) return;
    const payload: Record<string, unknown> = {};
    if (data.equipment_type_id !== undefined) payload.equipment_type_id = data.equipment_type_id;
    if (data.department_id !== undefined) payload.department_id = data.department_id;
    if (data.make !== undefined) payload.make = data.make;
    if (data.model !== undefined) payload.model = data.model;
    if (data.serial_number !== undefined) payload.serial_number = data.serial_number;
    if (data.equipment_number !== undefined) payload.equipment_number = data.equipment_number;
    if (data.last_calibration_date !== undefined) payload.last_calibration_date = data.last_calibration_date;
    if (data.next_calibration_due !== undefined) payload.next_calibration_due = data.next_calibration_due;
    if (data.notes !== undefined) payload.notes = data.notes;
    if (Object.keys(payload).length === 0) return;
    const { error } = await this.supabase.from('equipment').update(payload).in('id', ids);
    if (error) throw error;
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
      let allowed: number[] | null;
      if (profile.role === 'company_admin' && profile.company_id) {
        const { data: companySites } = await this.supabase
          .from('sites')
          .select('id')
          .eq('company_id', profile.company_id);
        const siteIds = (companySites ?? []).map((s: { id: number }) => s.id);
        if (siteIds.length === 0) allowed = [];
        else {
          const { data: companyDepts } = await this.supabase
            .from('departments')
            .select('id')
            .in('site_id', siteIds);
          allowed = (companyDepts ?? []).map((d: { id: number }) => d.id);
        }
      } else {
        allowed = await this.getAllowedDepartmentIds(profile);
      }
      if (allowed !== null && allowed.length > 0) {
        rows = rows.filter((r: { _department_id?: number | null }) => r._department_id != null && allowed!.includes(r._department_id));
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
    checkout_id?: number;
    room_number?: string;
  }): Promise<number> {
    const payload: Record<string, unknown> = {
      equipment_id: data.equipment_id,
      signed_out_by: data.signed_out_by,
      signed_out_at: new Date().toISOString(),
      purpose: data.purpose ?? null,
      equipment_request_id: data.equipment_request_id ?? null,
      building: data.building ?? null,
      equipment_number_to_test: data.equipment_number_to_test ?? null,
      date_from: data.date_from ?? null,
      date_to: data.date_to ?? null,
    };
    if (data.checkout_id != null) payload.checkout_id = data.checkout_id;
    if (data.room_number != null) payload.room_number = data.room_number;
    const { data: inserted, error } = await this.supabase
      .from('sign_outs')
      .insert(payload)
      .select('id')
      .single();
    if (error) throw error;
    return inserted?.id ?? 0;
  }

  /** Create a batch checkout: one checkout record + N sign_outs. Validates equipment is available and profile has access. */
  async createCheckout(
    profile: Profile,
    data: {
      equipment_ids: number[];
      site_id?: number | null;
      building?: string | null;
      room_number?: string | null;
      equipment_number_to_test?: string | null;
      signed_out_by: string;
      purpose?: string | null;
    }
  ): Promise<{ checkout_id: number; sign_out_ids: number[] }> {
    if (!data.equipment_ids?.length) throw new Error('At least one equipment is required');
    if (!data.signed_out_by?.trim()) throw new Error('signed_out_by is required');

    const allEquipment = await this.getAllEquipment(profile);
    const equipMap = new Map(allEquipment.map((e) => [e.id, e]));
    const activeSignOuts = await this.getActiveSignOuts(profile);
    const activeIds = new Set(activeSignOuts.map((s) => s.equipment_id));

    const validIds: number[] = [];
    for (const id of data.equipment_ids) {
      if (!equipMap.has(id)) throw new Error(`Equipment ${id} not found or access denied`);
      if (activeIds.has(id)) throw new Error(`Equipment ${id} is already signed out`);
      validIds.push(id);
    }

    const { data: checkoutRow, error: checkoutErr } = await this.supabase
      .from('checkouts')
      .insert({
        site_id: data.site_id ?? null,
        building: data.building ?? null,
        room_number: data.room_number ?? null,
        equipment_number_to_test: data.equipment_number_to_test ?? null,
        signed_out_by: data.signed_out_by.trim(),
        purpose: data.purpose ?? null,
      })
      .select('id')
      .single();
    if (checkoutErr) throw checkoutErr;
    const checkoutId = checkoutRow?.id ?? 0;
    if (!checkoutId) throw new Error('Failed to create checkout');

    const purpose = data.purpose ?? null;
    const building = data.building ?? null;
    const roomNumber = data.room_number ?? null;
    const equipNum = data.equipment_number_to_test ?? null;

    const signOutIds: number[] = [];
    for (const equipId of validIds) {
      const id = await this.createSignOut({
        equipment_id: equipId,
        signed_out_by: data.signed_out_by.trim(),
        purpose,
        building,
        equipment_number_to_test: equipNum,
        room_number: roomNumber ?? undefined,
        checkout_id: checkoutId,
      });
      signOutIds.push(id);
    }
    return { checkout_id: checkoutId, sign_out_ids: signOutIds };
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
      let allowed: number[] | null;
      if (profile.role === 'company_admin' && profile.company_id) {
        const { data: companySites } = await this.supabase
          .from('sites')
          .select('id')
          .eq('company_id', profile.company_id);
        const siteIds = (companySites ?? []).map((s: { id: number }) => s.id);
        if (siteIds.length === 0) allowed = [];
        else {
          const { data: companyDepts } = await this.supabase
            .from('departments')
            .select('id')
            .in('site_id', siteIds);
          allowed = (companyDepts ?? []).map((d: { id: number }) => d.id);
        }
      } else {
        allowed = await this.getAllowedDepartmentIds(profile);
      }
      if (allowed !== null && allowed.length > 0) {
        rows = rows.filter((r: { _department_id?: number | null }) => r._department_id != null && allowed!.includes(r._department_id));
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
      if (profile.role === 'user') {
        rows = rows.filter((r: { requester_email?: string }) => (r.requester_email ?? '').toLowerCase() === profile.email.toLowerCase());
      } else {
        let allowed: number[] | null;
        if (profile.role === 'company_admin' && profile.company_id) {
          const { data: companySites } = await this.supabase
            .from('sites')
            .select('id')
            .eq('company_id', profile.company_id);
          const siteIds = (companySites ?? []).map((s: { id: number }) => s.id);
          if (siteIds.length === 0) allowed = [];
          else {
            const { data: companyDepts } = await this.supabase
              .from('departments')
              .select('id')
              .in('site_id', siteIds);
            allowed = (companyDepts ?? []).map((d: { id: number }) => d.id);
          }
        } else {
          allowed = await this.getAllowedDepartmentIds(profile);
        }
        if (allowed !== null && allowed.length > 0) {
          rows = rows.filter((r: { _department_id?: number | null }) => r._department_id != null && allowed!.includes(r._department_id));
        } else if (allowed !== null) {
          rows = [];
        }
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
    site_id?: number | null;
    building: string;
    room_number?: string | null;
    equipment_number_to_test: string;
    date_from: string;
    date_to: string;
  }) {
    const payload: Record<string, unknown> = {
      equipment_id: data.equipment_id,
      requester_name: data.requester_name,
      requester_email: data.requester_email,
      requester_phone: data.requester_phone,
      building: data.building,
      equipment_number_to_test: data.equipment_number_to_test,
      date_from: data.date_from,
      date_to: data.date_to,
    };
    if (data.site_id != null) payload.site_id = data.site_id;
    if (data.room_number != null) payload.room_number = data.room_number;
    const { error } = await this.supabase.from('equipment_requests').insert(payload);
    if (error) throw error;
  }

  async createEquipmentRequestsBatch(data: {
    equipment_ids: number[];
    requester_name: string;
    requester_email: string;
    requester_phone: string;
    site_id?: number | null;
    building: string;
    room_number?: string | null;
    equipment_number_to_test: string;
    date_from: string;
    date_to: string;
  }) {
    if (!data.equipment_ids?.length) throw new Error('At least one equipment is required');
    const rows = data.equipment_ids.map((equipment_id) => {
      const row: Record<string, unknown> = {
        equipment_id,
        requester_name: data.requester_name,
        requester_email: data.requester_email,
        requester_phone: data.requester_phone,
        building: data.building,
        equipment_number_to_test: data.equipment_number_to_test,
        date_from: data.date_from,
        date_to: data.date_to,
      };
      if (data.site_id != null) row.site_id = data.site_id;
      if (data.room_number != null) row.room_number = data.room_number;
      return row;
    });
    const { error } = await this.supabase.from('equipment_requests').insert(rows);
    if (error) throw error;
  }

  async approveEquipmentRequest(
    id: number,
    reviewedBy: string
  ): Promise<{ equipment_id: number; requester_name: string; building: string; room_number?: string | null; equipment_number_to_test: string; date_from: string; date_to: string }> {
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
      room_number: (req as { room_number?: string | null }).room_number ?? null,
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
