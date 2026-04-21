import * as XLSX from 'xlsx';
import { STUDENT_CODE_RE } from '@/lib/canb/studentCodeValidator';

export const LOG_REQUIRED_HEADERS = ['캠퍼스명','강사명','학생명','STUDENT_CODE','ACCESS_DATETIME'] as const;

export interface ParsedLog {
  campus_raw:       string;
  teacher_name:     string | null;
  student_name:     string;
  student_code:     string;
  access_datetime:  Date;
}

export interface LogParseError {
  kind: 'missing_sheet' | 'missing_header' | 'bad_student_code' | 'bad_datetime';
  message: string;
  rowIndex?: number;
  column?: string;
  rawValue?: string;
  sheetName?: string;
}

export interface LogParseResult {
  sheetName: string;
  logs:      ParsedLog[];
  period_start_auto?: Date;
  period_end_auto?:   Date;
  errors:    LogParseError[];
}

/**
 * Parse an access log workbook.
 *   - 첫 시트 자동 인식
 *   - 헤더 = 1행 또는 2행 (자동 감지). 일부 파일은 1행이 공백
 *   - STUDENT_CODE 엄격 검증
 *   - ACCESS_DATETIME → Date (KST 문자열 가정, Excel serial도 지원)
 */
// Excel 은 날짜 셀을 "로컬 시계" 기준 serial 로 저장한다 (TZ 정보 없음).
// CANB 로그 원본은 KST(UTC+9) 기준이므로, serial/문자열 모두 KST 로 해석해야 한다.
// cellDates:true 는 내부적으로 serial 을 UTC 로 변환해 Date 를 만들어버려 ~9h 밀린다.
// 따라서 cellDates:false 로 raw 값을 받고 coerceDate 에서 직접 KST 로 해석한다.
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export function parseLogWorkbook(buf: ArrayBuffer): LogParseResult {
  const wb = XLSX.read(buf, { type: 'array', cellDates: false });
  const errors: LogParseError[] = [];
  if (wb.SheetNames.length === 0) {
    errors.push({ kind: 'missing_sheet', message: '시트를 찾을 수 없습니다.' });
    return { sheetName: '', logs: [], errors };
  }
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true });
  if (rows.length === 0) {
    errors.push({ kind: 'missing_header', message: '빈 시트입니다.', sheetName });
    return { sheetName, logs: [], errors };
  }

  // 헤더 자동 감지 (1행 or 2행)
  let headerRow = -1;
  for (let r = 0; r < Math.min(3, rows.length); r++) {
    const cells = (rows[r] as unknown[]).map((c) => String(c ?? '').trim());
    if (LOG_REQUIRED_HEADERS.every((h) => cells.includes(h))) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) {
    errors.push({
      kind: 'missing_header',
      message: `필수 헤더(${LOG_REQUIRED_HEADERS.join(', ')})를 1~2행에서 찾지 못했습니다.`,
      sheetName
    });
    return { sheetName, logs: [], errors };
  }
  const header = (rows[headerRow] as unknown[]).map((c) => String(c ?? '').trim());
  const idx: Record<string, number> = {};
  for (let i = 0; i < header.length; i++) idx[header[i]] = i;

  const logs: ParsedLog[] = [];
  let minTs = Number.POSITIVE_INFINITY;
  let maxTs = Number.NEGATIVE_INFINITY;

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue;
    const rowIndex = r + 1;

    const code = String(row[idx['STUDENT_CODE']] ?? '').trim();
    if (!STUDENT_CODE_RE.test(code)) {
      errors.push({
        kind: 'bad_student_code',
        message: `학생코드 형식 위반: "${code}" (^CB\\d+$)`,
        rowIndex, column: 'E', rawValue: code, sheetName
      });
      continue;
    }

    const dtRaw = row[idx['ACCESS_DATETIME']];
    const dt = coerceDate(dtRaw);
    if (!dt) {
      errors.push({
        kind: 'bad_datetime',
        message: `ACCESS_DATETIME 파싱 실패: "${String(dtRaw)}"`,
        rowIndex, column: 'E', rawValue: String(dtRaw ?? ''), sheetName
      });
      continue;
    }
    const t = dt.getTime();
    if (t < minTs) minTs = t;
    if (t > maxTs) maxTs = t;

    logs.push({
      campus_raw:      String(row[idx['캠퍼스명']] ?? '').trim(),
      teacher_name:    String(row[idx['강사명']]  ?? '').trim() || null,
      student_name:    String(row[idx['학생명']]  ?? '').trim(),
      student_code:    code,
      access_datetime: dt
    });
  }

  return {
    sheetName,
    logs,
    period_start_auto: Number.isFinite(minTs) ? new Date(minTs) : undefined,
    period_end_auto:   Number.isFinite(maxTs) ? new Date(maxTs) : undefined,
    errors
  };
}

function coerceDate(v: unknown): Date | null {
  if (v == null || v === '') return null;

  // 숫자 serial: "1899-12-30 기준 일수" (Excel 기준). 이는 KST 로컬 시계이므로
  //   실제 UTC = KST - 9h = (epoch + v*86400000) - 9h
  if (typeof v === 'number') {
    const epoch = Date.UTC(1899, 11, 30);
    return new Date(epoch + v * 86400000 - KST_OFFSET_MS);
  }

  if (v instanceof Date) {
    // XLSX 가 이미 Date 로 변환한 경우(cellDates:true 경로): UTC 로 간주되어 있음.
    // KST 해석으로 교정하려면 -9h.
    return new Date(v.getTime() - KST_OFFSET_MS);
  }

  // 문자열: TZ 오프셋이 없으면 KST 로 간주.
  const s = String(v).trim();
  const hasOffset = /[Zz]|[+-]\d{2}:?\d{2}$/.test(s);
  const normalized = s.replace(' ', 'T');
  const withTz = hasOffset ? normalized : `${normalized}+09:00`;
  const d = new Date(withTz);
  if (isNaN(d.getTime())) return null;
  return d;
}
