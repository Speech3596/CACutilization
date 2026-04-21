/**
 * Create or promote the initial admin profile.
 *
 *   npm run seed:admin -- --email=you@example.com [--name=홍길동] [--password=MyPass!]
 *
 * If the user does not yet exist in Supabase Auth, an invite email is sent.
 * If they already exist, the profile row is upserted with role=admin.
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'node:path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL     = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ .env.local 에 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 값이 필요합니다.');
  process.exit(1);
}

function parseArgs() {
  const a: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (m) a[m[1]] = m[2];
  }
  return a;
}

async function main() {
  const { email, name, password } = parseArgs();
  if (!email) {
    console.error('사용법: npm run seed:admin -- --email=you@example.com [--name=...] [--password=...]');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } });

  // 1) auth user 조회
  const { data: list } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  let target = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  if (!target) {
    if (password) {
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: name ? { full_name: name } : undefined
      });
      if (error) throw error;
      target = data.user!;
      console.log(`✅ Auth 사용자 생성: ${email} (비밀번호 직접 지정)`);
    } else {
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${SITE_URL}/login`,
        data: name ? { full_name: name } : undefined
      });
      if (error) throw error;
      target = data.user!;
      console.log(`✅ 초대 메일 발송: ${email}`);
    }
  } else {
    console.log(`ℹ️  기존 Auth 사용자 발견: ${email}`);
  }

  // 2) profile upsert (admin)
  const { error: profErr } = await supabase.from('profiles').upsert({
    id:        target.id,
    email:     target.email!,
    full_name: name ?? null,
    role:      'admin',
    campus_id: null
  }, { onConflict: 'id' });
  if (profErr) throw profErr;

  console.log(`🎉 Admin 프로필 준비 완료: ${email} (id=${target.id})`);
  console.log('   이제 브라우저에서 /login → 비밀번호를 설정/입력 후 로그인하세요.');
}

main().catch((e) => {
  console.error('❌ 실패:', e);
  process.exit(1);
});
