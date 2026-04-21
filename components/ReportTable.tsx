'use client';

import { METRIC_KEYS, METRIC_LABELS, type MetricValues } from '@/lib/canb/reportCalculator';
import { fmtNumber, fmtRate } from '@/lib/utils';

interface Col {
  key:   string;
  label: string;
  enrolled?: number; // only on campus sheets (담당 등록 학생 수)
  metrics: MetricValues | Record<string, number>;
}

interface Props {
  /** 행으로 쌓을 엔티티(캠퍼스 또는 담임) 목록. prop 명은 하위 호환을 위해 유지. */
  columns: Col[];
  /** 좌측 머리 열의 라벨. 기본 '구분'. */
  rowHeader?: string;
}

const RATE_KEYS = new Set(['usage_rate', 'unique_student_rate', 'homeroom_unique_rate']);

export function ReportTable({ columns, rowHeader = '구분' }: Props) {
  return (
    <div className="table-container max-h-[70vh] rounded-md border">
      <table>
        <thead>
          <tr>
            <th className="sticky-col text-left" style={{ minWidth: 180 }}>{rowHeader}</th>
            {METRIC_KEYS.map((k) => (
              <th key={k} className="text-right" style={{ minWidth: 110 }}>
                {METRIC_LABELS[k]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((c) => {
            const m = c.metrics as MetricValues;
            const enrolled = m.enrolled_count ?? c.enrolled ?? 0;
            return (
              <tr key={c.key}>
                <th className="sticky-col text-left">
                  <div>{c.label}</div>
                  <div className="text-[10px] font-normal text-muted-foreground">
                    등록 {fmtNumber(enrolled)}명
                  </div>
                </th>
                {METRIC_KEYS.map((k) => {
                  const v = (c.metrics as any)[k] ?? 0;
                  return (
                    <td key={k} className="text-right tabular-nums">
                      {RATE_KEYS.has(k) ? fmtRate(v) : fmtNumber(v)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
