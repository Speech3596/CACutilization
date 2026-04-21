'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginFlow />
    </Suspense>
  );
}

type Mode = 'login' | 'set-password' | 'forgot';

function parseHash(): URLSearchParams {
  if (typeof window === 'undefined') return new URLSearchParams();
  const h = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  return new URLSearchParams(h);
}

function LoginFlow() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const supabase = createSupabaseBrowserClient();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [flowReason, setFlowReason] = useState<'invite' | 'recovery' | null>(null);

  // 초기화: invite/recovery 링크 처리
  useEffect(() => {
    (async () => {
      try {
        // 1) 해시(#access_token=...&type=invite|recovery) 처리
        //    implicit 플로우에서는 Supabase 클라이언트가 detectSessionInUrl 로
        //    자동으로 세션을 만들어 주지만, 해시에서 type 을 먼저 읽어야 UI 를 띄울 수 있음.
        const hp = parseHash();
        const hashType = hp.get('type');
        const hashAccessToken = hp.get('access_token');
        const hashError = hp.get('error_description') || hp.get('error');

        if (hashError) {
          toast({
            title: '링크가 만료되었거나 이미 사용됨',
            description: '관리자에게 재초대를 요청하거나 "비밀번호를 잊으셨나요?"로 다시 시도하세요.',
            variant: 'destructive'
          });
          window.history.replaceState({}, '', '/login');
        }

        if (hashAccessToken) {
          // Supabase 클라이언트가 자동 처리하지 못한 경우를 대비해 수동 설정
          const refreshToken = hp.get('refresh_token');
          if (refreshToken) {
            await supabase.auth.setSession({
              access_token: hashAccessToken,
              refresh_token: refreshToken
            });
          }
        }

        // 2) 레거시 PKCE ?code= 처리 (구버전 링크 호환)
        const code = sp.get('code');
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            toast({
              title: '링크가 만료되었거나 이미 사용됨',
              description: '관리자에게 재초대를 요청하거나 "비밀번호를 잊으셨나요?"로 다시 시도하세요.',
              variant: 'destructive'
            });
          }
        }

        // 3) 세션 확정 + type 판정
        const { data: { user } } = await supabase.auth.getUser();
        const queryType = sp.get('type');
        const effectiveType =
          (hashType === 'invite' || hashType === 'recovery') ? hashType :
          (queryType === 'invite' || queryType === 'recovery') ? queryType :
          null;

        if (user && effectiveType) {
          setMode('set-password');
          setInvitedEmail(user.email ?? null);
          setFlowReason(effectiveType);
          window.history.replaceState({}, '', '/login');
        } else if (hashAccessToken || code) {
          // 토큰은 있었지만 type 힌트가 없는 경우(예: 직접 링크 공유) →
          // 안전하게 set-password 로 유도 (초대/재설정 링크는 대부분 이 경로로 옴)
          if (user) {
            setMode('set-password');
            setInvitedEmail(user.email ?? null);
            setFlowReason('recovery');
            window.history.replaceState({}, '', '/login');
          }
        }
      } catch (err) {
        console.error('[login] init error', err);
      } finally {
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      toast({ title: '로그인 실패', description: error.message, variant: 'destructive' });
      return;
    }
    // 하드 내비게이션: 서버 컴포넌트가 새 쿠키로 재평가되도록 강제.
    const next = sp.get('next') ?? '/';
    window.location.assign(next);
  }

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast({ title: '비밀번호는 8자 이상이어야 합니다', variant: 'destructive' }); return; }
    if (password !== password2) { toast({ title: '두 비밀번호가 일치하지 않습니다', variant: 'destructive' }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setBusy(false);
      toast({ title: '설정 실패', description: error.message, variant: 'destructive' });
      return;
    }
    toast({ title: '비밀번호가 설정되었습니다', description: '로그인 상태로 이동합니다.' });
    // 이미 세션이 있으므로 하드 내비게이션으로 홈 진입
    window.location.assign('/');
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const base = (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin).replace(/\/+$/, '');
    const redirectTo = `${base}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (error) { toast({ title: '메일 발송 실패', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '메일을 발송했습니다', description: '받은 편지함에서 링크를 확인하세요.' });
    setMode('login');
  }

  const title =
    mode === 'set-password' ? (flowReason === 'recovery' ? '비밀번호 재설정' : '초기 비밀번호 설정')
    : mode === 'forgot' ? '비밀번호 재설정 메일 보내기'
    : 'CANB · CAC 로그 리포트';

  const desc =
    mode === 'set-password'
      ? `${invitedEmail ?? ''} 계정의 새 비밀번호를 입력하세요.`
      : mode === 'forgot'
      ? '등록된 이메일로 재설정 링크를 보내드립니다.'
      : '이메일과 비밀번호로 로그인하세요.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-primary">{title}</CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent>
          {!ready ? (
            <div className="py-8 text-center text-sm text-muted-foreground">로딩 중…</div>
          ) : (
            <>
              {mode === 'set-password' && (
                <form onSubmit={setNewPassword} className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="pw">새 비밀번호 (8자 이상)</Label>
                    <Input id="pw" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="pw2">비밀번호 확인</Label>
                    <Input id="pw2" type="password" autoComplete="new-password" required value={password2} onChange={(e) => setPassword2(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={busy}>{busy ? '…' : '비밀번호 설정 및 로그인'}</Button>
                </form>
              )}

              {mode === 'login' && (
                <form onSubmit={signIn} className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="email">이메일</Label>
                    <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="password">비밀번호</Label>
                    <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={busy}>{busy ? '로그인 중…' : '로그인'}</Button>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-xs text-muted-foreground hover:text-primary self-start"
                  >
                    비밀번호를 잊으셨나요?
                  </button>
                </form>
              )}

              {mode === 'forgot' && (
                <form onSubmit={sendReset} className="grid gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="email">이메일</Label>
                    <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <Button type="submit" disabled={busy}>{busy ? '…' : '재설정 메일 보내기'}</Button>
                  <button
                    type="button"
                    onClick={() => setMode('login')}
                    className="text-xs text-muted-foreground hover:text-primary self-start"
                  >
                    ← 로그인으로 돌아가기
                  </button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
