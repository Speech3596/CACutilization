import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { parseStudentWorkbook } from '@/lib/excel/parseStudent';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SNAPSHOT_LIMIT = 30;
const BUCKET = 'student-snapshots';

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ message: '권한 없음' }, { status: 403 });

  const form = await req.formData();
  const file = form.get('file');
  const baseDateInput = String(form.get('base_date') ?? '');
  if (!(file instanceof File)) return NextResponse.json({ message: '파일 누락' }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(baseDateInput)) {
    return NextResponse.json({ message: '기준일(base_date)이 YYYY-MM-DD 형식이어야 합니다.' }, { status: 400 });
  }

  const buf = await file.arrayBuffer();
  const parsed = parseStudentWorkbook(buf, file.name);
  if (parsed.errors.length > 0) {
    return NextResponse.json({
      message: '파일 검증 실패',
      issues: parsed.errors.slice(0, 50),
      total_issues: parsed.errors.length
    }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();

  // 동일 기준일 존재 시 비활성화
  await svc.from('student_snapshots').update({ is_active: false }).eq('base_date', baseDateInput);

  // Storage 업로드
  const storagePath = `${baseDateInput}/${Date.now()}_${safeName(file.name)}`;
  const up = await svc.storage.from(BUCKET).upload(storagePath, Buffer.from(buf), {
    contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    upsert: true
  });
  if (up.error) return NextResponse.json({ message: 'Storage 업로드 실패: ' + up.error.message }, { status: 500 });

  const { data: snap, error: insErr } = await svc
    .from('student_snapshots')
    .upsert({
      base_date: baseDateInput,
      filename: file.name,
      uploaded_by: user.id,
      row_count: parsed.students.length,
      storage_path: storagePath,
      is_active: true
    }, { onConflict: 'base_date' })
    .select('id, base_date')
    .single();
  if (insErr || !snap) return NextResponse.json({ message: '스냅샷 메타 저장 실패: ' + (insErr?.message ?? '') }, { status: 500 });

  // 학생 행 batch insert (기존 삭제 후 재삽입)
  await svc.from('students').delete().eq('snapshot_id', snap.id);

  const rows = parsed.students.map((s) => ({
    snapshot_id: snap.id,
    student_code: s.student_code,
    campus_raw:   s.campus_raw,
    campus_id:    s.campus_id,
    name:         s.name,
    teacher:      s.teacher,
    status:       s.status,
    grade:        s.grade,
    level:        s.level,
    phase:        s.phase,
    raw:          s.raw
  }));

  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await svc.from('students').insert(chunk);
    if (error) return NextResponse.json({ message: '학생 행 저장 실패: ' + error.message }, { status: 500 });
  }

  // 30개 초과 시 가장 오래된 1건 삭제 (cascade로 students 같이 삭제)
  let autoDeleted = false;
  const { data: all } = await svc
    .from('student_snapshots')
    .select('id, base_date, storage_path')
    .order('base_date', { ascending: false });
  if (all && all.length > SNAPSHOT_LIMIT) {
    const toDelete = all.slice(SNAPSHOT_LIMIT);
    for (const d of toDelete) {
      await svc.storage.from(BUCKET).remove([d.storage_path]).catch(() => {});
      await svc.from('student_snapshots').delete().eq('id', d.id);
      autoDeleted = true;
    }
  }

  return NextResponse.json({
    id: snap.id,
    base_date: snap.base_date,
    row_count: parsed.students.length,
    auto_deleted: autoDeleted
  });
}

// Supabase Storage 는 ASCII 키만 허용 → 한글/공백/특수문자를 '_' 로 치환.
function safeName(n: string): string {
  const dot = n.lastIndexOf('.');
  const stem = dot > 0 ? n.slice(0, dot) : n;
  const extRaw = dot > 0 ? n.slice(dot + 1) : '';
  const cleanStem = stem.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '');
  const cleanExt = extRaw.replace(/[^a-zA-Z0-9]+/g, '').toLowerCase();
  const base = cleanStem || 'file';
  return cleanExt ? `${base}.${cleanExt}` : base;
}
