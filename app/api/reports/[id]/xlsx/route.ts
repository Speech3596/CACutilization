import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { buildReportXlsx } from '@/lib/excel/buildReportXlsx';
import type { ReportResult } from '@/lib/canb/reportCalculator';
import { formatInTimeZone } from 'date-fns-tz';
import { CAMPUS_BY_ID } from '@/lib/canb/campusMapping';

export const runtime = 'nodejs';
export const maxDuration = 60;

const KST = 'Asia/Seoul';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

  const { data: me } = await supabase.from('profiles').select('role, campus_id').eq('id', user.id).single();
  if (!me) return NextResponse.json({ message: '프로필 없음' }, { status: 403 });

  const svc = createSupabaseServiceClient();
  const { data: r } = await svc
    .from('reports')
    .select('id, student_snapshot_id, log_upload_id, period_start, period_end, exclude_upper_levels, exclude_middle_levels, data, xlsx_path')
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

  // campus_manager 는 본인 캠퍼스만 포함된 엑셀을 내려받는다.
  const restrictCampusId: number | null =
    me.role === 'campus_manager'
      ? (me.campus_id != null && CAMPUS_BY_ID[me.campus_id] ? me.campus_id : -1)
      : null;

  if (me.role === 'campus_manager' && restrictCampusId === -1) {
    return NextResponse.json({ message: '캠퍼스가 지정되지 않은 계정입니다.' }, { status: 403 });
  }

  const buf = await buildReportXlsx(result, {
    studentSnapshotLabel: snap?.base_date ?? '',
    logUploadLabel:       lu?.filename ?? '',
    periodStartLabel:     formatInTimeZone(new Date(r.period_start), KST, 'yyyy-MM-dd'),
    periodEndLabel:       formatInTimeZone(new Date(r.period_end),   KST, 'yyyy-MM-dd'),
    restrictCampusId
  });

  // Storage 캐시는 "전체 데이터" 엑셀에만 사용 (캠퍼스 제한본은 매번 생성).
  if (restrictCampusId == null) {
    const storagePath = `${r.id}.xlsx`;
    await svc.storage.from('reports').upload(storagePath, buf, {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      upsert: true
    }).catch(() => {});
    await svc.from('reports').update({ xlsx_path: storagePath }).eq('id', r.id);
  }

  // 다운로드 이력
  await svc.from('report_downloads').insert({ report_id: r.id, user_id: user.id });

  const scopeSuffix = restrictCampusId != null ? `_${CAMPUS_BY_ID[restrictCampusId]?.name ?? '캠퍼스'}` : '';
  const flagSuffix  = [r.exclude_upper_levels ? 'Deca제외' : null, r.exclude_middle_levels ? '중등제외' : null].filter(Boolean).join('_');
  const filename = `CANB_CAC_리포트_${formatInTimeZone(new Date(r.period_start), KST, 'yyyyMMdd')}-${formatInTimeZone(new Date(r.period_end), KST, 'yyyyMMdd')}${scopeSuffix}${flagSuffix ? '_' + flagSuffix : ''}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`
    }
  });
}
