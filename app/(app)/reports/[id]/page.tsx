import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportTabs } from '@/components/ReportTabs';
import { formatKstDate, formatKstDateTime } from '@/lib/utils';
import type { ReportResult } from '@/lib/canb/reportCalculator';
import { Download } from 'lucide-react';

export default async function ReportDetail({ params }: { params: { id: string } }) {
  const profile = await requireProfile();
  const supabase = createSupabaseServerClient();

  const { data: r } = await supabase
    .from('reports')
    .select('id, student_snapshot_id, log_upload_id, period_start, period_end, exclude_upper_levels, created_at, data')
    .eq('id', params.id)
    .single();
  if (!r) notFound();

  const [{ data: snap }, { data: lu }] = await Promise.all([
    supabase.from('student_snapshots').select('base_date').eq('id', r.student_snapshot_id).single(),
    supabase.from('log_uploads').select('filename').eq('id', r.log_upload_id).single()
  ]);

  const result = r.data as unknown as ReportResult;
  const banner = r.exclude_upper_levels ? 'Deca~ / 중등 제외: 적용' : '전체 학생 포함';

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">리포트 상세</h1>
          <div className="text-sm text-muted-foreground">
            기준일 {snap?.base_date} · 로그 {lu?.filename} · 기간 {formatKstDate(r.period_start)}~{formatKstDate(r.period_end)} · 생성 {formatKstDateTime(r.created_at)}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/reports">← 뒤로</Link></Button>
          <Button asChild><Link href={`/api/reports/${r.id}/xlsx`} target="_blank"><Download className="h-4 w-4" /> 엑셀 다운로드</Link></Button>
        </div>
      </div>

      <div className={`rounded-md border px-3 py-2 text-sm ${r.exclude_upper_levels ? 'border-primary bg-accent text-accent-foreground' : 'bg-muted'}`}>
        <b>{banner}</b> · 등록 학생 {result.counts.enrolled_total.toLocaleString()}명 · 기간 로그 {result.counts.logs_in_period.toLocaleString()}건 (매칭 {result.counts.logs_matched_to_enrolled.toLocaleString()}건)
      </div>

      {result.counts.logs_in_period === 0 && (
        <Card>
          <CardHeader><CardTitle>안내</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            해당 기간에 로그가 없습니다. 모든 값은 0 또는 "-"로 표시됩니다.
          </CardContent>
        </Card>
      )}

      <ReportTabs result={result} campusId={profile.role === 'campus_manager' ? profile.campus_id : null} />
    </div>
  );
}
