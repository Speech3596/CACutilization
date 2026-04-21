import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';

export const runtime = 'nodejs';

const patchSchema = z.object({
  role:      z.enum(['admin', 'hq_viewer', 'campus_manager']),
  campus_id: z.number().int().nullable()
});

async function requireAdmin() {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (data?.role !== 'admin') return null;
  return user;
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ message: '권한 없음' }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ message: '잘못된 입력' }, { status: 400 });
  const { role, campus_id } = parsed.data;
  if (role === 'campus_manager' && !campus_id) {
    return NextResponse.json({ message: 'campus_manager는 campus_id가 필요합니다.' }, { status: 400 });
  }
  const svc = createSupabaseServiceClient();
  const { error } = await svc.from('profiles').update({
    role,
    campus_id: role === 'campus_manager' ? campus_id : null
  }).eq('id', params.id);
  if (error) return NextResponse.json({ message: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const me = await requireAdmin();
  if (!me) return NextResponse.json({ message: '권한 없음' }, { status: 403 });
  if (me.id === params.id) return NextResponse.json({ message: '자기 자신은 삭제할 수 없습니다.' }, { status: 400 });
  const svc = createSupabaseServiceClient();
  const { error: delAuth } = await svc.auth.admin.deleteUser(params.id);
  if (delAuth) return NextResponse.json({ message: delAuth.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
