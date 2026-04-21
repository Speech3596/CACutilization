'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UploadDropzone } from '@/components/UploadDropzone';
import { useToast } from '@/components/ui/toast';
import { formatKstDate, formatKstDateTime } from '@/lib/utils';
import { Trash2 } from 'lucide-react';

interface Snapshot { id: string; base_date: string; filename: string; row_count: number; uploaded_at: string; is_active: boolean; }
interface LogUp    { id: string; filename: string; row_count: number; period_start_auto: string; period_end_auto: string; uploaded_at: string; }

interface Props { snapshots: Snapshot[]; logs: LogUp[]; }

export function UploadsClient({ snapshots, logs }: Props) {
  const router = useRouter();
  const { toast } = useToast();

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">업로드 관리</h1>
        <p className="text-sm text-muted-foreground">학생 스냅샷과 접속 로그 엑셀 파일을 업로드합니다.</p>
      </div>

      <StudentSection snapshots={snapshots} onChange={() => router.refresh()} toast={toast} />
      <LogSection logs={logs} onChange={() => router.refresh()} toast={toast} />
    </div>
  );
}

function StudentSection({ snapshots, onChange, toast }: { snapshots: Snapshot[]; onChange: () => void; toast: ReturnType<typeof useToast>['toast']; }) {
  const [pending, setPending] = useState<{ file: File; baseDate: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    const m = file.name.match(/(\d{4}-\d{2}-\d{2})/);
    setPending({ file, baseDate: m?.[1] ?? new Date().toISOString().slice(0, 10) });
  }

  async function submit() {
    if (!pending) return;
    setBusy(true);
    const fd = new FormData();
    fd.append('file', pending.file);
    fd.append('base_date', pending.baseDate);
    try {
      const r = await fetch('/api/uploads/student', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || '업로드 실패');
      toast({ title: '업로드 완료', description: `${j.row_count.toLocaleString()}명 저장 · 기준일 ${j.base_date}${j.auto_deleted ? ' · 가장 오래된 스냅샷 1건 자동 삭제' : ''}` });
      setPending(null);
      onChange();
    } catch (e: any) {
      toast({ title: '업로드 실패', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('이 학생 스냅샷을 삭제하시겠습니까?')) return;
    const r = await fetch(`/api/uploads/student/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({ title: '삭제 실패', description: j.message ?? '', variant: 'destructive' });
      return;
    }
    toast({ title: '삭제되었습니다' });
    onChange();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>학생 스냅샷</CardTitle>
        <CardDescription>시트명: <code>학생 상세</code> · 최대 30개 보관 (초과 시 가장 오래된 1건 자동 삭제)</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <UploadDropzone onFile={onFile} busy={busy} label="학생 엑셀 파일 선택" />
        {pending && (
          <div className="flex items-end gap-3 rounded-md border p-3">
            <div className="grid gap-1.5">
              <Label>파일</Label>
              <div className="text-sm">{pending.file.name}</div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="bd">기준일</Label>
              <Input id="bd" type="date" value={pending.baseDate} onChange={(e) => setPending({ ...pending, baseDate: e.target.value })} />
            </div>
            <Button onClick={submit} disabled={busy}>{busy ? '업로드 중…' : '업로드'}</Button>
            <Button variant="outline" onClick={() => setPending(null)} disabled={busy}>취소</Button>
          </div>
        )}

        <div className="table-container max-h-96 rounded-md border">
          <table>
            <thead>
              <tr>
                <th>기준일</th>
                <th>파일명</th>
                <th className="text-right">행수</th>
                <th>활성</th>
                <th>업로드</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {snapshots.length === 0 && <tr><td colSpan={6} className="text-muted-foreground text-center py-4">업로드 내역이 없습니다.</td></tr>}
              {snapshots.map((s) => (
                <tr key={s.id}>
                  <td>{s.base_date}</td>
                  <td className="max-w-xs truncate">{s.filename}</td>
                  <td className="text-right">{s.row_count.toLocaleString()}</td>
                  <td>{s.is_active ? '✓' : '—'}</td>
                  <td>{formatKstDateTime(s.uploaded_at)}</td>
                  <td>
                    <Button variant="ghost" size="icon" onClick={() => remove(s.id)}><Trash2 className="h-4 w-4" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function LogSection({ logs, onChange, toast }: { logs: LogUp[]; onChange: () => void; toast: ReturnType<typeof useToast>['toast']; }) {
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setBusy(true);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const r = await fetch('/api/uploads/log', { method: 'POST', body: fd });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || '업로드 실패');
      toast({ title: '업로드 완료', description: `${j.row_count.toLocaleString()} 행 · ${formatKstDate(j.period_start_auto)} ~ ${formatKstDate(j.period_end_auto)}` });
      onChange();
    } catch (e: any) {
      toast({ title: '업로드 실패', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  }

  async function remove(id: string) {
    if (!confirm('이 로그 업로드를 삭제하시겠습니까?')) return;
    const r = await fetch(`/api/uploads/log/${id}`, { method: 'DELETE' });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      toast({ title: '삭제 실패', description: j.message ?? '', variant: 'destructive' });
      return;
    }
    toast({ title: '삭제되었습니다' });
    onChange();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>접속 로그</CardTitle>
        <CardDescription>첫 시트 자동 인식 · STUDENT_CODE 엄격 검증 · MIN/MAX 타임스탬프로 기간 자동 계산</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <UploadDropzone onFile={onFile} busy={busy} label="접속 로그 엑셀 파일 선택" />

        <div className="table-container max-h-96 rounded-md border">
          <table>
            <thead>
              <tr>
                <th>기간</th>
                <th>파일명</th>
                <th className="text-right">행수</th>
                <th>업로드</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && <tr><td colSpan={5} className="text-muted-foreground text-center py-4">업로드 내역이 없습니다.</td></tr>}
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{formatKstDate(l.period_start_auto)} ~ {formatKstDate(l.period_end_auto)}</td>
                  <td className="max-w-xs truncate">{l.filename}</td>
                  <td className="text-right">{l.row_count.toLocaleString()}</td>
                  <td>{formatKstDateTime(l.uploaded_at)}</td>
                  <td><Button variant="ghost" size="icon" onClick={() => remove(l.id)}><Trash2 className="h-4 w-4" /></Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
