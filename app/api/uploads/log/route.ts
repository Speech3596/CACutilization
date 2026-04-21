import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { parseLogWorkbook } from '@/lib/excel/parseLog';

export const runtime = 'nodejs';
export const maxDuration = 60;

const BUCKET = 'access-logs';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ message: '권한 없음' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return NextResponse.json({ message: '파일 누락' }, { status: 400 });

  const buf = await file.arrayBuffer();
  const parsed = parseLogWorkbook(buf);
  if (parsed.errors.length > 0) {
    return NextResponse.json({
      message: '파일 검증 실패',
      issues: parsed.errors.slice(0, 50),
      total_issues: parsed.errors.length
    }, { status: 400 });
  }
  if (!parsed.period_start_auto || !parsed.period_end_auto || parsed.logs.length === 0) {
    return NextResponse.json({ message: '유효한 로그 행이 없습니다.' }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();

  const storagePath = `${new Date().toISOString().slice(0, 10)}/${Date.now()}_${safeName(file.name)}`;
  const up = await svc.storage.from(BUCKET).upload(storagePath, Buffer.from(buf), {
    contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    upsert: true
  });
  if (up.error) return NextResponse.json({ message: 'Storage 업로드 실패: ' + up.error.message }, { status: 500 });

  const { data: lu, error } = await svc
    .from('log_uploads')
    .insert({
      filename: file.name,
      uploaded_by: user.id,
      period_start_auto: parsed.period_start_auto.toISOString(),
      period_end_auto:   parsed.period_end_auto.toISOString(),
      row_count: parsed.logs.length,
      storage_path: storagePath
    })
    .select('id, period_start_auto, period_end_auto')
    .single();
  if (error || !lu) return NextResponse.json({ message: '로그 업로드 메타 저장 실패: ' + (error?.message ?? '') }, { status: 500 });

  const rows = parsed.logs.map((l) => ({
    log_upload_id: lu.id,
    campus_raw: l.campus_raw,
    teacher_name: l.teacher_name,
    student_name: l.student_name,
    student_code: l.student_code,
    access_datetime: l.access_datetime.toISOString()
  }));

  const chunkSize = 1000;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error: e } = await svc.from('access_logs').insert(chunk);
    if (e) return NextResponse.json({ message: '로그 행 저장 실패: ' + e.message }, { status: 500 });
  }

  return NextResponse.json({
    id: lu.id,
    row_count: parsed.logs.length,
    period_start_auto: lu.period_start_auto,
    period_end_auto: lu.period_end_auto
  });
}

function safeName(n: string): string {
  return n.replace(/[^\w.\-가-힣]+/g, '_');
}
