import * as XLSX from 'xlsx';
import { STUDENT_CODE_RE } from '@/lib/canb/studentCodeValidator';
import { mapCampusRaw, type CampusMaster } from '@/lib/canb/campusMapping';

export const STUDENT_REQUIRED_HEADERS = [
  '캠퍼스','교육 단계','이름','영문이름','아이디','학생코드','단계','수강반','강의실',
  '담임','강사','구분','상태','교재구매','학교','학년','주소','학생 연락처','학부모 연락처',
  '교과 출판사','차량명','형제 자매'
] as const;

export const STUDENT_SHEET_NAME = '학생 상세';

export interface ParsedStudent {
  student_code: string;
  campus_raw:   string;
  campus_id:    number | null;
  name:         string;
  teacher:      string | null;
  status:       string;
  grade:        string | null;
  level:        string | null;
  phase:        string | null;
  raw:          Record<string, unknown>;
}

export interface StudentParseError {
  kind: 'missing_sheet' | 'missing_header' | 'bad_student_code' | 'bad_campus';
  message: string;
  rowIndex?: number;    // 1-based with header
  column?: string;
  rawValue?: string;
}

export interface StudentParseResult {
  sheetName: string;
  students:  ParsedStudent[];
  baseDateFromFilename?: string;   // YYYY-MM-DD (있을 때만)
  errors:    StudentParseError[];
}

/**
 * Parse a student Excel workbook.
 * - 시트명 "학생 상세" 필수
 * - 헤더 1행 (한글 22개)
 * - 학생코드: ^CB\d+$ 엄격 검증
 * - 캠퍼스: §3-1 매핑, 매칭 실패 행은 에러로 수집
 * - 상태 값은 그대로 저장 (필터는 계산 단계에서)
 */
export function parseStudentWorkbook(buf: ArrayBuffer, filename: string): StudentParseResult {
  const wb = XLSX.read(buf, { type: 'array' });
  const errors: StudentParseError[] = [];

  if (!wb.SheetNames.includes(STUDENT_SHEET_NAME)) {
    errors.push({ kind: 'missing_sheet', message: `시트 "${STUDENT_SHEET_NAME}"를 찾을 수 없습니다. 실제: ${wb.SheetNames.join(', ')}` });
    return { sheetName: '', students: [], errors };
  }
  const ws = wb.Sheets[STUDENT_SHEET_NAME];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length === 0) {
    errors.push({ kind: 'missing_header', message: '비어 있는 시트입니다.' });
    return { sheetName: STUDENT_SHEET_NAME, students: [], errors };
  }

  const header = (rows[0] as unknown[]).map((c) => String(c ?? '').trim());
  const missing = STUDENT_REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length > 0) {
    errors.push({
      kind: 'missing_header',
      message: `필수 컬럼 누락: ${missing.join(', ')}`
    });
    return { sheetName: STUDENT_SHEET_NAME, students: [], errors };
  }

  const idx: Record<string, number> = {};
  for (let i = 0; i < header.length; i++) idx[header[i]] = i;

  const students: ParsedStudent[] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r] as unknown[];
    if (!row || row.every((c) => c == null || String(c).trim() === '')) continue;

    const rowIndex = r + 1; // 1-based including header

    const rawCode = String(row[idx['학생코드']] ?? '').trim();
    if (!STUDENT_CODE_RE.test(rawCode)) {
      errors.push({
        kind: 'bad_student_code',
        message: `학생코드 형식 위반: "${rawCode}" (^CB\\d+$)`,
        rowIndex,
        column: 'F',
        rawValue: rawCode
      });
      continue;
    }

    const campusRaw = String(row[idx['캠퍼스']] ?? '').trim();
    const campus: CampusMaster | null = mapCampusRaw(campusRaw);
    if (!campus) {
      errors.push({
        kind: 'bad_campus',
        message: `캠퍼스 매핑 실패: "${campusRaw}"`,
        rowIndex,
        column: 'A',
        rawValue: campusRaw
      });
      continue;
    }

    const raw: Record<string, unknown> = {};
    for (const h of header) raw[h] = row[idx[h]] ?? '';

    students.push({
      student_code: rawCode,
      campus_raw:   campusRaw,
      campus_id:    campus.id,
      name:         String(row[idx['이름']] ?? '').trim(),
      teacher:      String(row[idx['담임']] ?? '').trim() || null,
      status:       String(row[idx['상태']] ?? '').trim(),
      grade:        String(row[idx['학년']] ?? '').trim() || null,
      level:        String(row[idx['단계']] ?? '').trim() || null,
      phase:        String(row[idx['교육 단계']] ?? '').trim() || null,
      raw
    });
  }

  // 파일명에서 YYYY-MM-DD 추출
  let baseDateFromFilename: string | undefined;
  const m = filename.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) baseDateFromFilename = m[1];

  return {
    sheetName: STUDENT_SHEET_NAME,
    students,
    baseDateFromFilename,
    errors
  };
}
