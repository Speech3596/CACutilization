import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ReportsClient } from './ReportsClient';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const profile = await requireProfile();
  const supabase = createSupabaseServerClient();

  const [{ data: snapshots }, { data: logs }, { data: campuses }] = await Promise.all([
    supabase.from('student_snapshots').select('id, base_date, filename, row_count').order('base_date', { ascending: false }).limit(30),
    supabase.from('log_uploads').select('id, filename, period_start_auto, period_end_auto, row_count').order('uploaded_at', { ascending: false }).limit(20),
    supabase.from('campuses').select('id, name, type, display_order').order('display_order', { ascending: true })
  ]);

  return (
    <ReportsClient
      profile={profile}
      snapshots={snapshots ?? []}
      logs={logs ?? []}
      campuses={campuses ?? []}
    />
  );
}
