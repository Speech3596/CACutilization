import ExcelJS from 'exceljs';
import { METRIC_KEYS, METRIC_LABELS, type ReportResult } from '@/lib/canb/reportCalculator';

/** 0 → '-', 실수 → '99.9%', 정수 → '1,234' */
function fmtTotal(v: number): string | number {
  if (v === 0) return '-';
  return v;
}
function fmtRate(v: number): string {
  if (v === 0) return '-';
  return `${v.toFixed(1)}%`;
}

function metricRow(key: string): { label: string; kind: 'count' | 'rate' } {
  switch (key) {
    case 'total_views':            return { label: METRIC_LABELS.total_views,           kind: 'count' };
    case 'usage_rate':              return { label: METRIC_LABELS.usage_rate,             kind: 'rate'  };
    case 'unique_student_views':    return { label: METRIC_LABELS.unique_student_views,   kind: 'count' };
    case 'unique_student_rate':     return { label: METRIC_LABELS.unique_student_rate,    kind: 'rate'  };
    case 'homeroom_unique_views':   return { label: METRIC_LABELS.homeroom_unique_views,  kind: 'count' };
    case 'homeroom_unique_rate':    return { label: METRIC_LABELS.homeroom_unique_rate,   kind: 'rate'  };
    default: return { label: key, kind: 'count' };
  }
}

/**
 * §5-4 시트 구조로 xlsx 생성 → Buffer
 *   종합 → 직영 소계 → 수지/죽전/송도/마곡/이매 → 가맹 소계 → 김포/운정/영통/식사/동대문
 */
export async function buildReportXlsx(result: ReportResult, opts: {
  studentSnapshotLabel: string;  // e.g. "2026-04-21"
  logUploadLabel:       string;  // e.g. "CAC 접속로그_20260413.xlsx"
  periodStartLabel:     string;  // "2026-03-04"
  periodEndLabel:       string;
}): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CANB CAC Log';
  wb.created = new Date();

  const headerNote = `학생 스냅샷: ${opts.studentSnapshotLabel} | 로그: ${opts.logUploadLabel} | 기간: ${opts.periodStartLabel} ~ ${opts.periodEndLabel} | Deca~/중등 제외: ${result.input.exclude_upper_levels ? '적용' : '미적용'}`;

  const addAggregateSheet = (
    name: string,
    cols: Array<{ label: string; metrics: Record<string, number> | import('@/lib/canb/reportCalculator').MetricValues }>
  ) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });
    ws.getRow(1).values = [headerNote];
    ws.mergeCells(1, 1, 1, Math.max(2, cols.length + 1));
    styleHeaderNote(ws.getRow(1));

    ws.getRow(2).values = ['', ...cols.map((c) => `${c.label}`)];
    ws.getRow(3).values = ['', ...cols.map((c) => `등록 ${(c.metrics as Record<string, number>).enrolled_count ?? 0}명`)];
    styleColumnHeader(ws.getRow(2));
    styleSubHeader(ws.getRow(3));

    METRIC_KEYS.forEach((k, i) => {
      const meta = metricRow(k);
      const rowIdx = 4 + i;
      const row = ws.getRow(rowIdx);
      row.values = [
        meta.label,
        ...cols.map((c) => {
          const v = ((c.metrics as Record<string, number>)[k]) ?? 0;
          return meta.kind === 'rate' ? fmtRate(v) : fmtTotal(v);
        })
      ];
      styleDataRow(row, meta.kind);
    });

    ws.getColumn(1).width = 20;
    for (let c = 2; c <= cols.length + 1; c++) ws.getColumn(c).width = 16;
  };

  // 1) 종합
  addAggregateSheet('종합', result.overall.columns);
  // 2) 직영 소계
  addAggregateSheet('직영 소계', result.direct.columns);
  // 3) 직영 5개
  for (const campus of result.campuses.filter((s) => isDirectId(s.campus_id))) {
    addCampusSheet(wb, campus, headerNote);
  }
  // 4) 가맹 소계
  addAggregateSheet('가맹 소계', result.franchise.columns);
  // 5) 가맹 5개
  for (const campus of result.campuses.filter((s) => isFranchiseId(s.campus_id))) {
    addCampusSheet(wb, campus, headerNote);
  }

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

function addCampusSheet(wb: ExcelJS.Workbook, sheet: ReportResult['campuses'][number], headerNote: string) {
  const ws = wb.addWorksheet(sheet.campus_name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });
  ws.getRow(1).values = [headerNote];
  ws.mergeCells(1, 1, 1, Math.max(2, sheet.columns.length + 1));
  styleHeaderNote(ws.getRow(1));

  ws.getRow(2).values = ['', ...sheet.columns.map((c) => c.label)];
  ws.getRow(3).values = ['', ...sheet.columns.map((c) => `등록 ${c.enrolled}명`)];
  styleColumnHeader(ws.getRow(2));
  styleSubHeader(ws.getRow(3));

  METRIC_KEYS.forEach((k, i) => {
    const meta = metricRow(k);
    const row = ws.getRow(4 + i);
    row.values = [
      meta.label,
      ...sheet.columns.map((c) =>
        meta.kind === 'rate' ? fmtRate((c.metrics as any)[k] ?? 0) : fmtTotal((c.metrics as any)[k] ?? 0)
      )
    ];
    styleDataRow(row, meta.kind);
  });

  ws.getColumn(1).width = 20;
  for (let c = 2; c <= sheet.columns.length + 1; c++) ws.getColumn(c).width = 16;
}

function isDirectId(id: number | null): boolean {
  return id !== null && id >= 1 && id <= 5;
}
function isFranchiseId(id: number | null): boolean {
  return id !== null && id >= 6 && id <= 10;
}

// ---------- styles ----------
function styleHeaderNote(row: ExcelJS.Row) {
  row.font = { size: 10, color: { argb: 'FF555555' } };
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 18;
}
function styleColumnHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB8116F' } };
  row.height = 22;
  row.eachCell((cell) => { cell.border = thinBorder(); });
}
function styleSubHeader(row: ExcelJS.Row) {
  row.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8E8EF' } };
  row.eachCell((cell) => { cell.border = thinBorder(); });
}
function styleDataRow(row: ExcelJS.Row, kind: 'count' | 'rate') {
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  row.getCell(1).font = { bold: true };
  row.eachCell((cell, col) => {
    cell.border = thinBorder();
    if (col === 1) return;
    if (kind === 'count' && typeof cell.value === 'number') cell.numFmt = '#,##0';
  });
}
function thinBorder(): Partial<ExcelJS.Borders> {
  return {
    top:    { style: 'thin', color: { argb: 'FFDDDDDD' } },
    left:   { style: 'thin', color: { argb: 'FFDDDDDD' } },
    right:  { style: 'thin', color: { argb: 'FFDDDDDD' } },
    bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } }
  };
}
