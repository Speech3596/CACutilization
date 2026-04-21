import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatKstDate, formatKstDateTime } from '@/lib/utils';
import { Download } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MyReports() {
  const profile = await requireProfile();
  const supabase = createSupabaseServerClient();

  const { data: reports } = await supabase
    .from('reports')
    .select('id, period_start, period_end, created_at, exclude_upper_levels, created_by')
    .eq('created_by', profile.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const { data: downloads } = await supabase
    .from('report_downloads')
    .select('report_id, downloaded_at, reports(id, period_start, period_end, exclude_upper_levels)')
    .eq('user_id', profile.id)
    .order('downloaded_at', { ascending: false })
    .limit(50);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">내 리포트</h1>
        <p className="text-sm text-muted-foreground">내가 생성했거나 다운로드한 리포트 이력입니다.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>내가 생성한 리포트</CardTitle>
          <CardDescription>최대 50건</CardDescription>
        </CardHeader>
        <CardContent>
          {!reports?.length ? <div className="text-sm text-muted-foreground">생성한 리포트가 없습니다.</div> : (
            <ul className="divide-y">
              {reports.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <div className="text-sm">
                    <div>{formatKstDate(r.period_start)} ~ {formatKstDate(r.period_end)}</div>
                    <div className="text-xs text-muted-foreground">생성 {formatKstDateTime(r.created_at)} · 제외 {r.exclude_upper_levels ? '적용' : '미적용'}</div>
                  </div>
                  <div className="flex gap-2">
                    <Button asChild variant="ghost" size="sm"><Link href={`/reports/${r.id}`}>열기</Link></Button>
                    <Button asChild variant="outline" size="sm"><Link href={`/api/reports/${r.id}/xlsx`} target="_blank"><Download className="h-4 w-4" /> xlsx</Link></Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>다운로드 이력</CardTitle>
        </CardHeader>
        <CardContent>
          {!downloads?.length ? <div className="text-sm text-muted-foreground">다운로드 이력이 없습니다.</div> : (
            <ul className="divide-y">
              {downloads.map((d: any, idx: number) => (
                <li key={`${d.report_id}-${idx}`} className="flex items-center justify-between py-2">
                  <div className="text-sm">
                    <div>{d.reports ? `${formatKstDate(d.reports.period_start)} ~ ${formatKstDate(d.reports.period_end)}` : `리포트 ${d.report_id}`}</div>
                    <div className="text-xs text-muted-foreground">다운로드 {formatKstDateTime(d.downloaded_at)}</div>
                  </div>
                  {d.reports && <Button asChild variant="ghost" size="sm"><Link href={`/reports/${d.reports.id}`}>열기</Link></Button>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
