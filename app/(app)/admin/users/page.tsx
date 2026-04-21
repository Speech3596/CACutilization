import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { UsersClient } from './UsersClient';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  await requireRole(['admin']);
  const supabase = createSupabaseServerClient();

  const [{ data: profiles }, { data: campuses }] = await Promise.all([
    supabase.from('profiles').select('id, email, full_name, role, campus_id, created_at').order('created_at', { ascending: false }),
    supabase.from('campuses').select('id, name, type, display_order').order('display_order', { ascending: true })
  ]);

  return <UsersClient profiles={profiles ?? []} campuses={campuses ?? []} />;
}
