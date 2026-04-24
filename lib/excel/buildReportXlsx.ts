import ExcelJS from 'exceljs';
import { METRIC_KEYS, METRIC_LABELS, type MetricValues, type ReportResult } from '@/lib/canb/reportCalculator';
import { CAMPUS_BY_ID } from '@/lib/canb/campusMapping';

type MetricKind = 'count_view' | 'count_student' | 'rate';

/** 숫자/단위 포맷: 0 → '-', count → '1,234 건/명', rate → '99.9%' */
function fmtTotal(v: number, unit: '건' | '명'): string {
  if (v === 0) return '-';
  return `${v.toLocaleString('ko-KR')} ${unit}`;
}
function fmtRate(v: number): string {
  if (v === 0) return '-';
  return `${v.toFixed(1)}%`;
}
function fmtEnrolled(v: number): string {
  if (v === 0) return '-';
  return `${v.toLocaleString('ko-KR')} 명`;
}

function metricRow(key: string): { label: string; kind: MetricKind } {
  switch (key) {
    case 'total_views':           return { label: METRIC_LABELS.total_views,           kind: 'count_view'    };
    case 'usage_rate':             return { label: METRIC_LABELS.usage_rate,             kind: 'rate'          };
    case 'unique_student_views':   return { label: METRIC_LABELS.unique_student_views,   kind: 'count_student' };
    case 'unique_student_rate':    return { label: METRIC_LABELS.unique_student_rate,    kind: 'rate'          };
    case 'homeroom_unique_views':  return { label: METRIC_LABELS.homeroom_unique_views,  kind: 'count_student' };
    case 'homeroom_unique_rate':   return { label: METRIC_LABELS.homeroom_unique_rate,   kind: 'rate'          };
    default: return { label: key, kind: 'count_view' };
  }
}

function fmtMetric(v: number, kind: MetricKind): string {
  if (kind === 'rate')          return fmtRate(v);
  if (kind === 'count_student') return fmtTotal(v, '명');
  return fmtTotal(v, '건');
}

interface BuildOpts {
  studentSnapshotLabel: string;
  logUploadLabel:       string;
  periodStartLabel:     string;
  periodEndLabel:       string;
  /**
   * 캠퍼스 관리자용 필터. 지정 시:
   *  - 첫 번째 시트: 전체/소속구분(직영/가맹) 소계/자기 캠퍼스 합계 3개 컬럼 요약
   *  - 두 번째 시트: 자기 캠퍼스의 담임 상세
   *  다른 캠퍼스 합계·담임 데이터는 출력하지 않는다.
   */
  restrictCampusId?: number | null;
}

/**
 * §5-4 시트 구조로 xlsx 생성 → Buffer
 *   전체 모드: 종합 → 직영 소계 → 직영 캠퍼스 5개 → 가맹 소계 → 가맹 캠퍼스 5개
 *   캠퍼스 제한 모드: 요약(전체/구분 소계/자기캠퍼스) → 자기 캠퍼스 담임 상세
 */
export async function buildReportXlsx(result: ReportResult, opts: BuildOpts): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CANB CAC Log';
  wb.created = new Date();

  const flagParts: string[] = [];
  if (result.input.exclude_upper_levels)  flagParts.push('Deca·Hendeca 제외');
  if (result.input.exclude_middle_levels) flagParts.push('중등 제외');
  const flagText = flagParts.length === 0 ? '전체 학생 포함' : flagParts.join(' · ');
  const headerNote = `학생 스냅샷: ${opts.studentSnapshotLabel} | 로그: ${opts.logUploadLabel} | 기간: ${opts.periodStartLabel} ~ ${opts.periodEndLabel} | ${flagText}`;

  if (opts.restrictCampusId != null) {
    buildCampusScopedWorkbook(wb, result, opts.restrictCampusId, headerNote);
  } else {
    buildFullWorkbook(wb, result, headerNote);
  }

  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab as ArrayBuffer);
}

// =====================================================================
// 전체 (admin / hq_viewer)
// =====================================================================
function buildFullWorkbook(wb: ExcelJS.Workbook, result: ReportResult, headerNote: string) {
  addAggregateSheet(wb, '종합',      result.overall.columns,   headerNote);
  addAggregateSheet(wb, '직영 소계', result.direct.columns,    headerNote);
  for (const campus of result.campuses.filter((s) => isDirectId(s.campus_id))) {
    addCampusSheet(wb, campus, headerNote);
  }
  addAggregateSheet(wb, '가맹 소계', result.franchise.columns, headerNote);
  for (const campus of result.campuses.filter((s) => isFranchiseId(s.campus_id))) {
    addCampusSheet(wb, campus, headerNote);
  }
}

// =====================================================================
// 캠퍼스 관리자 전용
// 보안: 다른 캠퍼스 합계/담임명이 절대 포함되지 않아야 함.
// =====================================================================
function buildCampusScopedWorkbook(
  wb: ExcelJS.Workbook,
  result: ReportResult,
  campusId: number,
  headerNote: string
) {
  const master = CAMPUS_BY_ID[campusId];
  const campusSheet = result.campuses.find((s) => s.campus_id === campusId);

  // 요약 시트 — 전체 / (직영|가맹) 소계 / 자기 캠퍼스 합계
  const overallCol = result.overall.columns.find((c) => c.key === 'overall');
  const groupKey: 'direct' | 'franchise' = master?.type === 'franchise' ? 'franchise' : 'direct';
  const groupCol = result.overall.columns.find((c) => c.key === groupKey);
  const ownTotalCol = campusSheet?.columns.find((c) => c.key === 'total');

  const summaryCols: Array<{ key: string; label: string; metrics: MetricValues | Record<string, number> }> = [];
  if (overallCol) summaryCols.push({ key: 'overall', label: 'CANB 전체', metrics: overallCol.metrics });
  if (groupCol)   summaryCols.push({ key: groupKey, label: groupKey === 'direct' ? '직영 소계' : '가맹 소계', metrics: groupCol.metrics });
  if (ownTotalCol) summaryCols.push({ key: 'own', label: `${master?.name ?? '내 캠퍼스'} 합계`, metrics: ownTotalCol.metrics });

  addAggregateSheet(wb, '요약', summaryCols, headerNote);

  // 자기 캠퍼스 상세 (담임 포함)
  if (campusSheet) {
    addCampusSheet(wb, campusSheet, headerNote);
  }
}

// =====================================================================
// Sheet builders
// =====================================================================
function addAggregateSheet(
  wb: ExcelJS.Workbook,
  name: string,
  cols: Array<{ label: string; metrics: MetricValues | Record<string, number> }>,
  headerNote: string
) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });
  ws.getRow(1).values = [headerNote];
  ws.mergeCells(1, 1, 1, Math.max(2, cols.length + 1));
  styleHeaderNote(ws.getRow(1));

  ws.getRow(2).values = ['', ...cols.map((c) => `${c.label}`)];
  ws.getRow(3).values = ['전체 학생수', ...cols.map((c) => fmtEnrolled((c.metrics as Record<string, number>).enrolled_count ?? 0))];
  styleColumnHeader(ws.getRow(2));
  styleEnrolledRow(ws.getRow(3));

  METRIC_KEYS.forEach((k, i) => {
    const meta = metricRow(k);
    const rowIdx = 4 + i;
    const row = ws.getRow(rowIdx);
    row.values = [
      meta.label,
      ...cols.map((c) => fmtMetric(((c.metrics as Record<string, number>)[k]) ?? 0, meta.kind))
    ];
    styleDataRow(row);
  });

  ws.getColumn(1).width = 20;
  for (let c = 2; c <= cols.length + 1; c++) ws.getColumn(c).width = 18;
}

function addCampusSheet(wb: ExcelJS.Workbook, sheet: ReportResult['campuses'][number], headerNote: string) {
  const ws = wb.addWorksheet(sheet.campus_name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 3 }] });
  ws.getRow(1).values = [headerNote];
  ws.mergeCells(1, 1, 1, Math.max(2, sheet.columns.length + 1));
  styleHeaderNote(ws.getRow(1));

  ws.getRow(2).values = ['', ...sheet.columns.map((c) => c.label)];
  ws.getRow(3).values = ['전체 학생수', ...sheet.columns.map((c) => fmtEnrolled(c.enrolled))];
  styleColumnHeader(ws.getRow(2));
  styleEnrolledRow(ws.getRow(3));

  METRIC_KEYS.forEach((k, i) => {
    const meta = metricRow(k);
    const row = ws.getRow(4 + i);
    row.values = [
      meta.label,
      ...sheet.columns.map((c) => fmtMetric((c.metrics as any)[k] ?? 0, meta.kind))
    ];
    styleDataRow(row);
  });

  ws.getColumn(1).width = 20;
  for (let c = 2; c <= sheet.columns.length + 1; c++) ws.getColumn(c).width = 18;
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
function styleEnrolledRow(row: ExcelJS.Row) {
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  row.getCell(1).font = { bold: true };
  row.font = { size: 10 };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8E8EF' } };
  row.eachCell((cell) => { cell.border = thinBorder(); });
}
function styleDataRow(row: ExcelJS.Row) {
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  row.getCell(1).font = { bold: true };
  row.eachCell((cell) => {
    cell.border = thinBorder();
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
