import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import type { User } from '@supabase/supabase-js';
import { Database } from './database';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

export interface AuthUser extends User {}
export interface Profile {
  id: number;
  auth_user_id: string;
  email: string;
  display_name: string | null;
  phone: string | null;
  role: 'user' | 'equipment_manager' | 'company_admin' | 'super_admin';
  company_id?: number | null;
  onboarding_complete?: boolean;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthUser;
      profile?: Profile;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Auth not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.authUser = user;

  // Fetch or create profile for access control (upsert ensures SUPER_ADMIN_EMAIL is applied on every login)
  const db = new Database(supabaseUrl, supabaseKey);
  const profile = await db.upsertProfile(user.id, user.email ?? '', 'user');
  req.profile = profile;

  next();
}
