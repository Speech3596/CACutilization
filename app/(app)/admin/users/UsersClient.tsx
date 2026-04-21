'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/toast';
import { formatKstDateTime } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface Profile { id: string; email: string; full_name: string | null; role: string; campus_id: number | null; created_at: string; }
interface Campus  { id: number; name: string; type: 'direct'|'franchise'; display_order: number; }

interface Props { profiles: Profile[]; campuses: Campus[]; }

type SlotKey = 'admin' | 'hq_viewer' | `campus_manager:${number}`;

function encodeSlot(role: string, campus_id: number | null): SlotKey | '' {
  if (role === 'admin') return 'admin';
  if (role === 'hq_viewer') return 'hq_viewer';
  if (role === 'campus_manager' && campus_id != null) return `campus_manager:${campus_id}`;
  return '';
}

function decodeSlot(key: string): { role: string; campus_id: number | null } {
  if (key === 'admin') return { role: 'admin', campus_id: null };
  if (key === 'hq_viewer') return { role: 'hq_viewer', campus_id: null };
  if (key.startsWith('campus_manager:')) {
    return { role: 'campus_manager', campus_id: Number(key.split(':')[1]) };
  }
  return { role: '', campus_id: null };
}

function slotLabel(key: string, campuses: Campus[]): string {
  if (key === 'admin') return '관리자';
  if (key === 'hq_viewer') return '본사 뷰어 (HQ Viewer)';
  if (key.startsWith('campus_manager:')) {
    const id = Number(key.split(':')[1]);
    const c = campuses.find((x) => x.id === id);
    return `Campus Director(${c?.name ?? '?'})`;
  }
  return '—';
}

type InviteMode = 'direct' | 'invite';

export function UsersClient({ profiles, campuses }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<{ email: string; full_name: string; slot: string; password: string }>({ email: '', full_name: '', slot: '', password: '' });
  const [mode, setMode] = useState<InviteMode>('direct');
  const [busy, setBusy] = useState(false);

  const slotOptions: { key: SlotKey; label: string; group: string }[] = [
    { key: 'admin',     label: '관리자',               group: '본사' },
    { key: 'hq_viewer', label: '본사 뷰어 (HQ Viewer)', group: '본사' },
    ...campuses
      .filter((c) => c.type === 'direct')
      .map((c) => ({ key: `campus_manager:${c.id}` as SlotKey, label: `Campus Director(${c.name})`, group: '직영' })),
    ...campuses
      .filter((c) => c.type === 'franchise')
      .map((c) => ({ key: `campus_manager:${c.id}` as SlotKey, label: `Campus Director(${c.name})`, group: '가맹' }))
  ];

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!form.slot) { toast({ title: '역할을 선택하세요', variant: 'destructive' }); return; }
    if (mode === 'direct' && form.password.length < 8) {
      toast({ title: '초기 비밀번호는 8자 이상이어야 합니다', variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      const { role, campus_id } = decodeSlot(form.slot);
      const body: any = {
        email: form.email.trim(),
        full_name: form.full_name.trim() || null,
        role,
        campus_id,
        mode
      };
      if (mode === 'direct') body.password = form.password;

      const r = await fetch('/api/users/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || '생성 실패');
      toast({
        title: mode === 'direct' ? '계정이 생성되었습니다' : '초대 메일 발송',
        description: mode === 'direct'
          ? `${form.email} · 초기 비밀번호는 사용자에게 안전하게 공유하세요.`
          : form.email
      });
      setForm({ email: '', full_name: '', slot: '', password: '' });
      router.refresh();
    } catch (err: any) {
      toast({ title: mode === 'direct' ? '계정 생성 실패' : '초대 실패', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  }

  async function updateSlot(p: Profile, slotKey: string) {
    const { role, campus_id } = decodeSlot(slotKey);
    const r = await fetch(`/api/users/${p.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ role, campus_id })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({ title: '업데이트 실패', description: j.message ?? '', variant: 'destructive' });
      return;
    }
    toast({ title: '업데이트되었습니다' });
    router.refresh();
  }

  async function remove(p: Profile) {
    if (!confirm(`${p.email} 계정을 완전히 삭제하시겠습니까?`)) return;
    const r = await fetch(`/api/users/${p.id}`, { method: 'DELETE' });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({ title: '삭제 실패', description: j.message ?? '', variant: 'destructive' });
      return;
    }
    toast({ title: '삭제되었습니다' });
    router.refresh();
  }

  async function reinvite(p: Profile) {
    const r = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: p.email, full_name: p.full_name, role: p.role, campus_id: p.campus_id, reinvite: true, mode: 'invite' })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({ title: '재초대 실패', description: j.message ?? '', variant: 'destructive' });
      return;
    }
    toast({ title: '재초대 메일 발송' });
  }

  async function resetPassword(p: Profile) {
    const pw = prompt(`${p.email} 계정의 새 비밀번호를 입력하세요 (8자 이상):`);
    if (!pw) return;
    if (pw.length < 8) { toast({ title: '비밀번호는 8자 이상이어야 합니다', variant: 'destructive' }); return; }
    const r = await fetch('/api/users/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: p.email, full_name: p.full_name, role: p.role, campus_id: p.campus_id, mode: 'direct', password: pw })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({ title: '비밀번호 재설정 실패', description: j.message ?? '', variant: 'destructive' });
      return;
    }
    toast({ title: '비밀번호가 재설정되었습니다', description: '사용자에게 새 비밀번호를 안전하게 공유하세요.' });
  }

  const grouped = {
    '본사': slotOptions.filter((o) => o.group === '본사'),
    '직영': slotOptions.filter((o) => o.group === '직영'),
    '가맹': slotOptions.filter((o) => o.group === '가맹')
  };

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">계정 관리</h1>
        <p className="text-sm text-muted-foreground">직접 생성: 관리자가 초기 비밀번호 지정 후 사용자에게 공유. · 메일 초대: Supabase가 링크 발송(하루 발송량 제한 있음).</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>계정 생성 / 초대</CardTitle>
          <CardDescription>역할 · 캠퍼스를 선택하고, 비밀번호를 즉시 지정하거나 초대 메일을 발송합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 inline-flex rounded-md border p-0.5 text-sm">
            <button
              type="button"
              onClick={() => setMode('direct')}
              className={`px-3 py-1 rounded ${mode === 'direct' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              직접 생성
            </button>
            <button
              type="button"
              onClick={() => setMode('invite')}
              className={`px-3 py-1 rounded ${mode === 'invite' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
            >
              메일 초대
            </button>
          </div>

          <form onSubmit={invite} className="grid gap-3 md:grid-cols-4 md:items-end">
            <div className="grid gap-1.5 md:col-span-2">
              <Label>이메일</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>이름</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>역할 · 캠퍼스</Label>
              <Select value={form.slot} onValueChange={(v) => setForm({ ...form, slot: v })}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(grouped) as Array<keyof typeof grouped>).map((g) => (
                    <div key={g}>
                      <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{g}</div>
                      {grouped[g].map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {mode === 'direct' && (
              <div className="grid gap-1.5 md:col-span-2">
                <Label>초기 비밀번호 (8자 이상)</Label>
                <Input
                  type="text"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="예: canb20260421"
                />
                <span className="text-[11px] text-muted-foreground">메일 없이 계정이 즉시 생성됩니다. 비밀번호는 사용자에게 안전하게 공유하세요.</span>
              </div>
            )}
            <div className="md:col-span-4 flex justify-end">
              <Button type="submit" disabled={busy}>
                {busy ? '…' : mode === 'direct' ? '계정 생성' : '초대 메일 보내기'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>사용자 목록</CardTitle>
          <CardDescription>{profiles.length}명</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="table-container rounded-md border">
            <table>
              <thead>
                <tr><th>이메일</th><th>이름</th><th>역할 · 캠퍼스</th><th>생성</th><th></th></tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const currentSlot = encodeSlot(p.role, p.campus_id);
                  return (
                    <tr key={p.id}>
                      <td>{p.email}</td>
                      <td>{p.full_name ?? '—'}</td>
                      <td>
                        <Select value={currentSlot} onValueChange={(v) => updateSlot(p, v)}>
                          <SelectTrigger className="h-8 w-64"><SelectValue placeholder={slotLabel(currentSlot, campuses)} /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(grouped) as Array<keyof typeof grouped>).map((g) => (
                              <div key={g}>
                                <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground">{g}</div>
                                {grouped[g].map((o) => <SelectItem key={o.key} value={o.key}>{o.label}</SelectItem>)}
                              </div>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td>{formatKstDateTime(p.created_at)}</td>
                      <td className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => resetPassword(p)}>비번 재설정</Button>
                        <Button variant="outline" size="sm" onClick={() => reinvite(p)}>재초대</Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">역할을 관리자로 바꾸려면 현재 로그인 계정이 admin이어야 합니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
