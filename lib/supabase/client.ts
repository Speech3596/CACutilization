'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // implicit 플로우(#access_token=...&type=...) 로 통일.
        // 이유: admin generateLink / inviteUserByEmail 은 PKCE verifier 를 클라이언트에
        // 저장하지 못하므로, PKCE 를 쓰면 다른 브라우저·장치에서 링크 클릭 시
        // exchangeCodeForSession 이 실패함. implicit 플로우는 어느 브라우저에서든
        // 바로 세션을 만들 수 있음.
        flowType: 'implicit',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true
      }
    }
  );
}
