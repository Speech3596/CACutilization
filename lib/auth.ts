import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Role } from '@/lib/supabase/types';

export interface CurrentProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  campus_id: number | null;
}

/** Server helper: get the current user + profile, or redirect to /login. */
export async function requireProfile(): Promise<CurrentProfile> {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, campus_id')
    .eq('id', user.id)
    .single();

  if (error || !data) redirect('/login');
  return data as unknown as CurrentProfile;
}

export async function requireRole(allowed: Role[]): Promise<CurrentProfile> {
  const p = await requireProfile();
  if (!allowed.includes(p.role)) redirect('/');
  return p;
}

export async function getOptionalProfile(): Promise<CurrentProfile | null> {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from('profiles')
    .select('id, email, full_name, role, campus_id')
    .eq('id', user.id)
    .single();
  return (data as unknown as CurrentProfile) ?? null;
}
