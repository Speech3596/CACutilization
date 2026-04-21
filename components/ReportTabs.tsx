'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportTable } from '@/components/ReportTable';
import type { ReportResult } from '@/lib/canb/reportCalculator';

interface Props {
  result:     ReportResult;
  campusId?:  number | null;  // campus_manager — 본인 캠퍼스만 노출
}

export function ReportTabs({ result, campusId }: Props) {
  const directIds    = [1, 2, 3, 4, 5];
  const franchiseIds = [6, 7, 8, 9, 10];

  // campus_manager: 본인 캠퍼스 탭만 보여주기
  if (campusId) {
    const mine = result.campuses.find((s) => s.campus_id === campusId);
    if (!mine) return <div className="text-sm text-muted-foreground">할당된 캠퍼스 데이터를 찾을 수 없습니다.</div>;
    return (
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{mine.campus_name}</h2>
        <ReportTable columns={mine.columns.map((c) => ({ ...c, enrolled: c.enrolled, metrics: c.metrics }))} />
      </div>
    );
  }

  const defaultValue = 'overall';
  return (
    <Tabs defaultValue={defaultValue}>
      <TabsList>
        <TabsTrigger value="overall">종합</TabsTrigger>
        <TabsTrigger value="direct">직영 소계</TabsTrigger>
        {directIds.map((id) => {
          const s = result.campuses.find((x) => x.campus_id === id)!;
          return <TabsTrigger key={id} value={`c-${id}`}>{s.campus_name}</TabsTrigger>;
        })}
        <TabsTrigger value="franchise">가맹 소계</TabsTrigger>
        {franchiseIds.map((id) => {
          const s = result.campuses.find((x) => x.campus_id === id)!;
          return <TabsTrigger key={id} value={`c-${id}`}>{s.campus_name}</TabsTrigger>;
        })}
      </TabsList>

      <TabsContent value="overall">
        <ReportTable columns={result.overall.columns.map((c) => ({ key: c.key, label: c.label, metrics: c.metrics }))} />
      </TabsContent>
      <TabsContent value="direct">
        <ReportTable columns={result.direct.columns.map((c) => ({ key: c.key, label: c.label, metrics: c.metrics }))} />
      </TabsContent>
      <TabsContent value="franchise">
        <ReportTable columns={result.franchise.columns.map((c) => ({ key: c.key, label: c.label, metrics: c.metrics }))} />
      </TabsContent>

      {result.campuses.map((s) => (
        <TabsContent key={s.campus_id!} value={`c-${s.campus_id}`}>
          <ReportTable columns={s.columns.map((c) => ({ key: c.key, label: c.label, enrolled: c.enrolled, metrics: c.metrics }))} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
