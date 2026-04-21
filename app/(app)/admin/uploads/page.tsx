import { requireRole } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { UploadsClient } from './UploadsClient';

export const dynamic = 'force-dynamic';

export default async function UploadsPage() {
  await requireRole(['admin']);
  const supabase = createSupabaseServerClient();

  const [{ data: snapshots }, { data: logs }] = await Promise.all([
    supabase
      .from('student_snapshots')
      .select('id, base_date, filename, row_count, uploaded_at, is_active')
      .order('base_date', { ascending: false })
      .limit(50),
    supabase
      .from('log_uploads')
      .select('id, filename, row_count, period_start_auto, period_end_auto, uploaded_at')
      .order('uploaded_at', { ascending: false })
      .limit(50)
  ]);

  return (
    <UploadsClient
      snapshots={snapshots ?? []}
      logs={logs ?? []}
    />
  );
}
