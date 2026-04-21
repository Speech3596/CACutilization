import Link from 'next/link';
import { requireProfile } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatKstDate, formatKstDateTime } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export default async function Dashboard() {
  const profile = await requireProfile();
  const supabase = createSupabaseServerClient();

  const [{ data: latestSnapshot }, { data: latestLog }, { data: recentReports }] = await Promise.all([
    supabase.from('student_snapshots').select('base_date, row_count, uploaded_at').order('base_date', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('log_uploads').select('filename, period_start_auto, period_end_auto, row_count, uploaded_at').order('uploaded_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('reports').select('id, period_start, period_end, created_at, exclude_upper_levels').order('created_at', { ascending: false }).limit(5)
  ]);

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-bold">안녕하세요, {profile.full_name ?? profile.email}님</h1>
        <p className="text-sm text-muted-foreground">가장 최근 데이터 현황을 한눈에 확인할 수 있습니다.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>최신 학생 스냅샷</CardTitle>
            <CardDescription>§4-1 학생 데이터</CardDescription>
          </CardHeader>
          <CardContent>
            {latestSnapshot ? (
              <div className="space-y-1">
                <div>기준일: <b>{latestSnapshot.base_date}</b></div>
                <div>행수: {latestSnapshot.row_count.toLocaleString()}</div>
                <div className="text-xs text-muted-foreground">업로드: {formatKstDateTime(latestSnapshot.uploaded_at)}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                아직 업로드된 학생 스냅샷이 없습니다.
                {profile.role === 'admin' && (
                  <> <Link href="/admin/uploads" className="text-primary underline">업로드하기 →</Link></>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최신 접속 로그</CardTitle>
            <CardDescription>§4-2 접속 로그</CardDescription>
          </CardHeader>
          <CardContent>
            {latestLog ? (
              <div className="space-y-1">
                <div>{latestLog.filename}</div>
                <div className="text-sm">기간: {formatKstDate(latestLog.period_start_auto)} ~ {formatKstDate(latestLog.period_end_auto)}</div>
                <div className="text-xs text-muted-foreground">행수: {latestLog.row_count.toLocaleString()} · 업로드: {formatKstDateTime(latestLog.uploaded_at)}</div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">아직 업로드된 로그가 없습니다.</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>최근 리포트</CardTitle>
            <CardDescription>최대 5건</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm"><Link href="/reports">리포트 →</Link></Button>
        </CardHeader>
        <CardContent>
          {!recentReports?.length ? (
            <div className="text-sm text-muted-foreground">최근 리포트가 없습니다.</div>
          ) : (
            <ul className="divide-y">
              {recentReports.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <div className="text-sm">
                    <div>{formatKstDate(r.period_start)} ~ {formatKstDate(r.period_end)}</div>
                    <div className="text-xs text-muted-foreground">
                      생성: {formatKstDateTime(r.created_at)} · Deca~/중등 제외: {r.exclude_upper_levels ? '적용' : '미적용'}
                    </div>
                  </div>
                  <Button asChild variant="ghost" size="sm"><Link href={`/reports/${r.id}`}>열기</Link></Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
