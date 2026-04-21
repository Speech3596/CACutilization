'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/components/ui/toast';

export default function LoginPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const supabase = createSupabaseBrowserClient();

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast({ title: '로그인 실패', description: error.message, variant: 'destructive' });
      return;
    }
    const next = sp.get('next') ?? '/';
    router.replace(next);
    router.refresh();
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin}/login`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    setBusy(false);
    if (error) { toast({ title: '메일 발송 실패', description: error.message, variant: 'destructive' }); return; }
    toast({ title: '메일을 발송했습니다', description: '받은 편지함을 확인하세요.' });
    setResetMode(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl text-primary">CANB · CAC 로그 리포트</CardTitle>
          <CardDescription>{resetMode ? '비밀번호 재설정 메일을 보냅니다.' : '이메일과 비밀번호로 로그인하세요.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={resetMode ? sendReset : signIn} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">이메일</Label>
              <Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            {!resetMode && (
              <div className="grid gap-1.5">
                <Label htmlFor="password">비밀번호</Label>
                <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            <Button type="submit" disabled={busy}>{busy ? '…' : resetMode ? '재설정 메일 보내기' : '로그인'}</Button>
            <button
              type="button"
              onClick={() => setResetMode((v) => !v)}
              className="text-xs text-muted-foreground hover:text-primary self-start"
            >
              {resetMode ? '← 로그인으로 돌아가기' : '비밀번호를 잊으셨나요?'}
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
