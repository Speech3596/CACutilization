'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ReportTabs } from '@/components/ReportTabs';
import { useToast } from '@/components/ui/toast';
import { formatKstDate } from '@/lib/utils';
import type { ReportResult } from '@/lib/canb/reportCalculator';
import { Download } from 'lucide-react';

interface Snap { id: string; base_date: string; filename: string; row_count: number; }
interface LogUp { id: string; filename: string; period_start_auto: string; period_end_auto: string; row_count: number; }
interface Campus { id: number; name: string; type: 'direct'|'franchise'; display_order: number; }

interface Props {
  profile: { id: string; email: string; full_name: string | null; role: 'admin'|'hq_viewer'|'campus_manager'; campus_id: number | null };
  snapshots: Snap[];
  logs: LogUp[];
  campuses: Campus[];
}

function toDateInput(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
function toIsoStart(dateInput: string): string {
  return new Date(`${dateInput}T00:00:00+09:00`).toISOString();
}
function toIsoEnd(dateInput: string): string {
  return new Date(`${dateInput}T23:59:59.999+09:00`).toISOString();
}

export function ReportsClient({ profile, snapshots, logs, campuses }: Props) {
  const { toast } = useToast();
  const [snapshotId, setSnapshotId] = useState<string>(snapshots[0]?.id ?? '');
  const [logId, setLogId]           = useState<string>(logs[0]?.id ?? '');
  const selectedLog = useMemo(() => logs.find((l) => l.id === logId), [logs, logId]);
  const [startDate, setStartDate] = useState<string>(selectedLog ? toDateInput(selectedLog.period_start_auto) : '');
  const [endDate, setEndDate]     = useState<string>(selectedLog ? toDateInput(selectedLog.period_end_auto) : '');
  const [excludeUpper, setExcludeUpper] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedLog) {
      setStartDate(toDateInput(selectedLog.period_start_auto));
      setEndDate(toDateInput(selectedLog.period_end_auto));
    }
  }, [selectedLog]);

  const canQuery = snapshotId && logId && startDate && endDate;

  async function runReport() {
    if (!canQuery) return;
    setBusy(true);
    setResult(null);
    setReportId(null);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          student_snapshot_id: snapshotId,
          log_upload_id: logId,
          period_start: toIsoStart(startDate),
          period_end:   toIsoEnd(endDate),
          exclude_upper_levels: excludeUpper
        })
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || '리포트 생성 실패');
      setResult(j.data as ReportResult);
      setReportId(j.id as string);
      if (j.cached) toast({ title: '캐시된 리포트를 재사용합니다.' });
    } catch (e: any) {
      toast({ title: '리포트 생성 실패', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  }

  const campusName = (id: number | null) => campuses.find((c) => c.id === id)?.name ?? '—';
  const banner = excludeUpper ? 'Deca~ / 중등 제외: 적용' : '전체 학생 포함';

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-2xl font-bold">리포트</h1>
        <p className="text-sm text-muted-foreground">
          {profile.role === 'campus_manager'
            ? <>본인 캠퍼스({campusName(profile.campus_id)})의 데이터만 표시됩니다.</>
            : '학생 스냅샷과 로그, 기간을 선택해 리포트를 생성합니다.'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>필터</CardTitle>
          <CardDescription>조회 후 결과는 자동으로 캐시됩니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-6 md:items-end">
            <div className="grid gap-1.5 md:col-span-2">
              <Label>학생 스냅샷 (기준일)</Label>
              <Select value={snapshotId} onValueChange={setSnapshotId}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {snapshots.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.base_date} · {s.row_count.toLocaleString()}명 · {s.filename}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5 md:col-span-2">
              <Label>접속 로그</Label>
              <Select value={logId} onValueChange={setLogId}>
                <SelectTrigger><SelectValue placeholder="선택" /></SelectTrigger>
                <SelectContent>
                  {logs.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{formatKstDate(l.period_start_auto)}~{formatKstDate(l.period_end_auto)} · {l.row_count.toLocaleString()}행</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>기간 시작</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label>기간 종료</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div className="md:col-span-6 flex flex-wrap items-center gap-3 justify-between pt-2">
              {profile.role === 'campus_manager' && (
                <div className="text-sm text-muted-foreground">캠퍼스 필터 고정: <b>{campusName(profile.campus_id)}</b></div>
              )}
              <div className="ml-auto flex items-center gap-3">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={excludeUpper} onCheckedChange={(v) => setExcludeUpper(!!v)} />
                      Deca~ / 중등 제외
                    </label>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    체크 시 Deca·Hendeca 그룹과 중등(X/W/Y/Z, L 통합) 학생을 분모와 로그 카운트 양쪽에서 완전 제외합니다.
                  </TooltipContent>
                </Tooltip>
                <Button onClick={runReport} disabled={!canQuery || busy}>{busy ? '생성 중…' : '조회'}</Button>
                {reportId && (
                  <Button variant="outline" asChild>
                    <Link href={`/api/reports/${reportId}/xlsx`} target="_blank"><Download className="h-4 w-4" /> 엑셀 다운로드</Link>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <>
          <div className={`rounded-md border px-3 py-2 text-sm ${excludeUpper ? 'border-primary bg-accent text-accent-foreground' : 'bg-muted'}`}>
            <b>{banner}</b> · 등록 학생 {result.counts.enrolled_total.toLocaleString()}명 · 기간 로그 {result.counts.logs_in_period.toLocaleString()}건 (매칭 {result.counts.logs_matched_to_enrolled.toLocaleString()}건)
          </div>
          <ReportTabs result={result} campusId={profile.role === 'campus_manager' ? profile.campus_id : null} />
        </>
      )}
    </div>
  );
}
