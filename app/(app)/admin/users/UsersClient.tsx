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

const ROLE_LABEL: Record<string, string> = { admin: '관리자', hq_viewer: '본사 뷰어', campus_manager: '캠퍼스 매니저' };

export function UsersClient({ profiles, campuses }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState({ email: '', full_name: '', role: 'campus_manager', campus_id: '' });
  const [busy, setBusy] = useState(false);

  const campusName = (id: number | null) => campuses.find((c) => c.id === id)?.name ?? '—';

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        email: form.email.trim(),
        full_name: form.full_name.trim() || null,
        role: form.role,
        campus_id: form.role === 'campus_manager' ? Number(form.campus_id) || null : null
      };
      const r = await fetch('/api/users/invite', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || '초대 실패');
      toast({ title: '초대 메일 발송', description: form.email });
      setForm({ email: '', full_name: '', role: 'campus_manager', campus_id: '' });
      router.refresh();
    } catch (err: any) {
      toast({ title: '초대 실패', description: err.message, variant: 'destructive' });
    } finally { setBusy(false); }
  }

  async function updateRole(p: Profile, role: string, campus_id: number | null) {
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
      body: JSON.stringify({ email: p.email, full_name: p.full_name, role: p.role, campus_id: p.campus_id, reinvite: true })
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({ title: '재초대 실패', description: j.message ?? '', variant: 'destructive' });
      return;
    }
    toast({ title: '재초대 메일 발송' });
  }

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">계정 관리</h1>
        <p className="text-sm text-muted-foreground">이메일 초대 → 사용자가 비밀번호 설정 → 역할 부여.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>계정 초대</CardTitle>
          <CardDescription>Supabase Auth Invite 메일을 발송합니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={invite} className="grid gap-3 md:grid-cols-5 md:items-end">
            <div className="grid gap-1.5 md:col-span-2">
              <Label>이메일</Label>
              <Input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>이름</Label>
              <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label>역할</Label>
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="hq_viewer">본사 뷰어</SelectItem>
                  <SelectItem value="campus_manager">캠퍼스 매니저</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>캠퍼스 {form.role === 'campus_manager' ? '(필수)' : '(선택 불가)'}</Label>
              <Select
                value={form.campus_id}
                onValueChange={(v) => setForm({ ...form, campus_id: v })}
              >
                <SelectTrigger disabled={form.role !== 'campus_manager'}><SelectValue placeholder="캠퍼스 선택" /></SelectTrigger>
                <SelectContent>
                  {campuses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.type === 'direct' ? '직영' : '가맹'})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-5 flex justify-end">
              <Button type="submit" disabled={busy}>{busy ? '…' : '초대 메일 보내기'}</Button>
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
                <tr><th>이메일</th><th>이름</th><th>역할</th><th>캠퍼스</th><th>생성</th><th></th></tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id}>
                    <td>{p.email}</td>
                    <td>{p.full_name ?? '—'}</td>
                    <td>
                      <Select value={p.role} onValueChange={(v) => updateRole(p, v, v === 'campus_manager' ? p.campus_id : null)}>
                        <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">관리자</SelectItem>
                          <SelectItem value="hq_viewer">본사 뷰어</SelectItem>
                          <SelectItem value="campus_manager">캠퍼스 매니저</SelectItem>
                        </SelectContent>
                      </Select>
                    </td>
                    <td>
                      <Select
                        value={p.campus_id ? String(p.campus_id) : ''}
                        onValueChange={(v) => updateRole(p, p.role, Number(v))}
                      >
                        <SelectTrigger className="h-8 w-36" disabled={p.role !== 'campus_manager'}><SelectValue placeholder={p.role === 'campus_manager' ? campusName(p.campus_id) : '—'} /></SelectTrigger>
                        <SelectContent>
                          {campuses.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td>{formatKstDateTime(p.created_at)}</td>
                    <td className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => reinvite(p)}>재초대</Button>
                      <Button variant="ghost" size="icon" onClick={() => remove(p)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">역할을 관리자로 바꾸려면 현재 로그인 계정이 admin이어야 합니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
