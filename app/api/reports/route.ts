import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { computeReport, REPORT_SCHEMA_VERSION, type ReportResult, type StudentRow, type LogRow } from '@/lib/canb/reportCalculator';
import { z } from 'zod';

export const runtime = 'nodejs';
export const maxDuration = 60;

const schema = z.object({
  student_snapshot_id:   z.string().uuid(),
  log_upload_id:         z.string().uuid(),
  period_start:          z.string(),    // ISO
  period_end:            z.string(),    // ISO
  exclude_upper_levels:  z.boolean(),
  exclude_middle_levels: z.boolean()
});

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role, campus_id').eq('id', user.id).single();
  if (!me) return NextResponse.json({ message: '프로필 없음' }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: '잘못된 입력', issues: parsed.error.flatten() }, { status: 400 });
  const {
    student_snapshot_id,
    log_upload_id,
    period_start,
    period_end,
    exclude_upper_levels,
    exclude_middle_levels
  } = parsed.data;

  const svc = createSupabaseServiceClient();

  // 캐시 체크 (동일 입력 조합). schema_version 이 다르면 구버전 계산식이므로 폐기 후 재계산.
  const { data: cached } = await svc
    .from('reports')
    .select('id, data, xlsx_path')
    .eq('student_snapshot_id',   student_snapshot_id)
    .eq('log_upload_id',         log_upload_id)
    .eq('period_start',          period_start)
    .eq('period_end',            period_end)
    .eq('exclude_upper_levels',  exclude_upper_levels)
    .eq('exclude_middle_levels', exclude_middle_levels)
    .maybeSingle();
  if (cached) {
    const cachedVersion = (cached.data as any)?.schema_version ?? null;
    if (cachedVersion === REPORT_SCHEMA_VERSION) {
      return NextResponse.json({ id: cached.id, data: cached.data, cached: true });
    }
    // 구버전 캐시 폐기
    if (cached.xlsx_path) {
      await svc.storage.from('reports').remove([cached.xlsx_path]).catch(() => {});
    }
    await svc.from('report_downloads').delete().eq('report_id', cached.id);
    await svc.from('reports').delete().eq('id', cached.id);
  }

  // 학생 로드
  const students = await loadAllStudents(svc, student_snapshot_id);
  // 로그 로드 (기간 필터는 compute 내부에서 함. 여기선 upload 전체)
  const logs = await loadAllLogs(svc, log_upload_id);

  const result = computeReport({
    students,
    logs,
    period_start:          new Date(period_start),
    period_end:            new Date(period_end),
    exclude_upper_levels,
    exclude_middle_levels
  });

  // 저장
  const { data: ins, error } = await svc
    .from('reports')
    .insert({
      student_snapshot_id,
      log_upload_id,
      period_start,
      period_end,
      exclude_upper_levels,
      exclude_middle_levels,
      created_by: user.id,
      data: result as unknown
    })
    .select('id')
    .single();
  if (error || !ins) return NextResponse.json({ message: '리포트 저장 실패: ' + (error?.message ?? '') }, { status: 500 });

  return NextResponse.json({ id: ins.id, data: result, cached: false });
}

async function loadAllStudents(svc: ReturnType<typeof createSupabaseServiceClient>, snapshotId: string): Promise<StudentRow[]> {
  const rows: StudentRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await svc
      .from('students')
      .select('student_code, campus_raw, campus_id, name, teacher, status, grade, level, phase')
      .eq('snapshot_id', snapshotId)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as StudentRow[]));
    if (data.length < pageSize) break;
  }
  return rows;
}

async function loadAllLogs(svc: ReturnType<typeof createSupabaseServiceClient>, logUploadId: string): Promise<LogRow[]> {
  const rows: LogRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await svc
      .from('access_logs')
      .select('student_code, teacher_name, access_datetime')
      .eq('log_upload_id', logUploadId)
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as LogRow[]));
    if (data.length < pageSize) break;
  }
  return rows;
}
