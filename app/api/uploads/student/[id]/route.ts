import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';

export const runtime = 'nodejs';

// 종속 리포트 수 조회 (클라이언트 확인용).
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return NextResponse.json({ message: '권한 없음' }, { status: 403 });

  const svc = createSupabaseServiceClient();
  const { count } = await svc.from('reports').select('id', { count: 'exact', head: true }).eq('student_snapshot_id', params.id);
  return NextResponse.json({ dependent_reports: count ?? 0 });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (profile?.role !== 'admin') return NextResponse.json({ message: '권한 없음' }, { status: 403 });

  const svc = createSupabaseServiceClient();

  // 1) 이 스냅샷을 참조하는 리포트(+다운로드 이력)을 먼저 제거.
  const { data: depReports } = await svc.from('reports').select('id').eq('student_snapshot_id', params.id);
  const depIds = (depReports ?? []).map((r) => r.id);
  if (depIds.length > 0) {
    await svc.from('report_downloads').delete().in('report_id', depIds);
    await svc.from('reports').delete().in('id', depIds);
  }

  // 2) Storage 파일 제거.
  const { data: meta } = await svc.from('student_snapshots').select('storage_path').eq('id', params.id).single();
  if (meta?.storage_path) await svc.storage.from('student-snapshots').remove([meta.storage_path]).catch(() => {});

  // 3) 스냅샷 삭제 (students 는 FK on delete cascade).
  const { error } = await svc.from('student_snapshots').delete().eq('id', params.id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, deleted_reports: depIds.length });
}
