import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { createSupabaseServiceClient } from '@/lib/supabase/service';
import { z } from 'zod';

export const runtime = 'nodejs';

const schema = z.object({
  email:     z.string().email(),
  full_name: z.string().nullish(),
  role:      z.enum(['admin', 'hq_viewer', 'campus_manager']),
  campus_id: z.number().int().nullish(),
  reinvite:  z.boolean().optional()
});

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ message: '인증 필요' }, { status: 401 });
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (me?.role !== 'admin') return NextResponse.json({ message: '권한 없음' }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: '잘못된 입력', issues: parsed.error.flatten() }, { status: 400 });

  const { email, full_name, role, campus_id, reinvite } = parsed.data;
  if (role === 'campus_manager' && !campus_id) {
    return NextResponse.json({ message: 'campus_manager는 campus_id가 필요합니다.' }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();
  const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/login`;

  const { data: existing } = await svc.from('profiles').select('id').eq('email', email).maybeSingle();

  let userId = existing?.id as string | undefined;
  if (!userId || reinvite) {
    const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name }
    });
    if (error) {
      // 이미 존재 + reinvite 로그인 링크도 fallback 처리
      if (!reinvite) return NextResponse.json({ message: error.message }, { status: 400 });
    } else if (data?.user?.id) {
      userId = data.user.id;
    }
  }

  if (!userId) return NextResponse.json({ message: '사용자 ID를 확인할 수 없습니다.' }, { status: 500 });

  const { error: upErr } = await svc.from('profiles').upsert({
    id: userId,
    email,
    full_name: full_name ?? null,
    role,
    campus_id: role === 'campus_manager' ? (campus_id ?? null) : null
  }, { onConflict: 'id' });
  if (upErr) return NextResponse.json({ message: 'profile upsert 실패: ' + upErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
