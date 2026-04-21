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
  reinvite:  z.boolean().optional(),
  // mode='direct' 이면 이메일 발송 없이 관리자가 지정한 비밀번호로 즉시 계정 생성.
  // mode='invite' 이면 Supabase Auth Invite 메일 발송.
  mode:      z.enum(['invite', 'direct']).default('invite'),
  password:  z.string().min(8).optional()
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

  const { email, full_name, role, campus_id, reinvite, mode, password } = parsed.data;
  if (role === 'campus_manager' && !campus_id) {
    return NextResponse.json({ message: 'campus_manager는 campus_id가 필요합니다.' }, { status: 400 });
  }
  if (mode === 'direct' && (!password || password.length < 8)) {
    return NextResponse.json({ message: '직접 생성에는 8자 이상의 초기 비밀번호가 필요합니다.' }, { status: 400 });
  }

  const svc = createSupabaseServiceClient();
  const { data: existing } = await svc.from('profiles').select('id').eq('email', email).maybeSingle();
  let userId = existing?.id as string | undefined;

  if (mode === 'direct') {
    // 이메일 발송 없이 Admin API 로 직접 생성/갱신.
    if (!userId) {
      const { data, error } = await svc.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name }
      });
      if (error || !data?.user?.id) {
        return NextResponse.json({ message: '계정 생성 실패: ' + (error?.message ?? '') }, { status: 400 });
      }
      userId = data.user.id;
    } else {
      // 기존 계정이면 비밀번호만 재설정(+이메일 확정)
      const { error } = await svc.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
        user_metadata: { full_name }
      });
      if (error) return NextResponse.json({ message: '비밀번호 재설정 실패: ' + error.message }, { status: 400 });
    }
  } else {
    // 기존 이메일 초대 플로우
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/login`;
    if (!userId || reinvite) {
      const { data, error } = await svc.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { full_name }
      });
      if (error) {
        if (!reinvite) return NextResponse.json({ message: error.message }, { status: 400 });
      } else if (data?.user?.id) {
        userId = data.user.id;
      }
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

  return NextResponse.json({ ok: true, mode });
}
