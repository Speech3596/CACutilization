import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { buildReportXlsx } from '@/lib/excel/buildReportXlsx';
import type { ReportResult } from '@/lib/canb/reportCalculator';
import { formatInTimeZone } from 'date-fns-tz';

export const runtime = 'nodejs';
export const maxDuration = 60;

const KST = 'Asia/Seoul';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

  const svc = createSupabaseServiceClient();
  const { data: r } = await svc
    .from('reports')
    .select('id, student_snapshot_id, log_upload_id, period_start, period_end, exclude_upper_levels, data, xlsx_path')
    .eq('id', params.id)
    .single();
  if (!r) return NextResponse.json({ message: '리포트 없음' }, { status: 404 });

  const { data: snap } = r.student_snapshot_id
    ? await svc.from('student_snapshots').select('base_date').eq('id', r.student_snapshot_id).maybeSingle()
    : { data: null };
  const { data: lu } = r.log_upload_id
    ? await svc.from('log_uploads').select('filename').eq('id', r.log_upload_id).maybeSingle()
    : { data: null };

  const result = r.data as unknown as ReportResult;
  const buf = await buildReportXlsx(result, {
    studentSnapshotLabel: snap?.base_date ?? '',
    logUploadLabel:       lu?.filename ?? '',
    periodStartLabel:     formatInTimeZone(new Date(r.period_start), KST, 'yyyy-MM-dd'),
    periodEndLabel:       formatInTimeZone(new Date(r.period_end),   KST, 'yyyy-MM-dd')
  });

  // Storage 저장 (캐시)
  const storagePath = `${r.id}.xlsx`;
  await svc.storage.from('reports').upload(storagePath, buf, {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    upsert: true
  }).catch(() => {});
  await svc.from('reports').update({ xlsx_path: storagePath }).eq('id', r.id);

  // 다운로드 이력
  await svc.from('report_downloads').insert({ report_id: r.id, user_id: user.id });

  const filename = `CANB_CAC_리포트_${formatInTimeZone(new Date(r.period_start), KST, 'yyyyMMdd')}-${formatInTimeZone(new Date(r.period_end), KST, 'yyyyMMdd')}${r.exclude_upper_levels ? '_초중제외' : ''}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    }
  });
}
