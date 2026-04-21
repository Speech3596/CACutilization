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
  const [invitedEmail, setInvitedEmail] = useState<string | null>(null);
  const [flowReason, setFlowReason] = useState<'invite' | 'recovery' | null>(null);

  useEffect(() => {
    (async () => {
      // PKCE callback: ?code=...
      const code = sp.get('code');
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error && data?.user) {
          setMode('set-password');
          setInvitedEmail(data.user.email ?? null);
          const reason = (data.user.app_metadata?.provider_token ? null : null);
          // Prefer explicit hint from query
          const q = sp.get('type');
          setFlowReason(q === 'recovery' ? 'recovery' : 'invite');
          // clean URL so refresh doesn't try to re-exchange
          window.history.replaceState({}, '', '/login');
          return;
        }
        if (error) {
          toast({
            title: '링크가 만료되었거나 이미 사용됨',
            description: '관리자에게 재초대 메일을 요청하거나 "비밀번호를 잊으셨나요?"를 이용하세요.',
            variant: 'destructive'
          });
          window.history.replaceState({}, '', '/login');
        }
        return;
      }

      // Implicit flow fallback: #access_token=...&type=invite|recovery
      if (typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
        const hashParams = new URLSearchParams(window.location.hash.slice(1));
        const type = hashParams.get('type');
        if (type === 'invite' || type === 'recovery') {
          const { data } = await supabase.auth.getUser();
          if (data?.user) {
            setMode('set-password');
            setInvitedEmail(data.user.email ?? null);
            setFlowReason(type);
            window.history.replaceState({}, '', '/login');
          }
        }
      }
    })();
    // run once on mount — consume invite/recovery token if present
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast({ title: '로그인 실패', description: error.message, variant: 'destructive' });
      return;
    }
    router.replace(sp.get('next') ?? '/');
    router.refresh();
  }

  async function setNewPassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) { toast({ title: '비밀번호는 8자 이상이어야 합니다', variant: 'destructive' }); return; }
    if (password !== password2) { toast({ title: '두 비밀번호가 일치하지 않습니다', variant: 'destructive' }); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast({ title: '설정 실패', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '비밀번호가 설정되었습니다', description: '로그인 상태로 이동합니다.' });
    router.replace('/');
    router.refresh();
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/login`;
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
              <Button type="submit" disabled={busy}>{busy ? '…' : '로그인'}</Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
