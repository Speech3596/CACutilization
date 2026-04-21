'use client';

import { METRIC_KEYS, METRIC_LABELS, type MetricValues } from '@/lib/canb/reportCalculator';
import { fmtNumber, fmtRate } from '@/lib/utils';

interface Col {
  key:   string;
  label: string;
  enrolled?: number; // only on campus sheets
  metrics: MetricValues | Record<string, number>;
}

interface Props {
  columns: Col[];
  stickyFirstColumn?: boolean;
}

const RATE_KEYS = new Set(['usage_rate', 'unique_student_rate', 'homeroom_unique_rate']);

export function ReportTable({ columns }: Props) {
  return (
    <div className="table-container max-h-[70vh] rounded-md border">
      <table>
        <thead>
          <tr>
            <th className="sticky-col" style={{ minWidth: 140 }}>지표</th>
            {columns.map((c) => (
              <th key={c.key} className="text-right" style={{ minWidth: 120 }}>
                <div>{c.label}</div>
                <div className="text-[10px] font-normal text-muted-foreground">
                  등록 {fmtNumber((c.metrics as MetricValues).enrolled_count ?? c.enrolled ?? 0)}명
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {METRIC_KEYS.map((k) => (
            <tr key={k}>
              <th className="sticky-col text-left">{METRIC_LABELS[k]}</th>
              {columns.map((c) => {
                const v = (c.metrics as any)[k] ?? 0;
                return (
                  <td key={c.key} className="text-right tabular-nums">
                    {RATE_KEYS.has(k) ? fmtRate(v) : fmtNumber(v)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
