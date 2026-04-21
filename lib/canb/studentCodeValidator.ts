export const STUDENT_CODE_RE = /^CB\d+$/;

export function isValidStudentCode(v: string | null | undefined): boolean {
  if (v == null) return false;
  return STUDENT_CODE_RE.test(String(v));
}

export interface CodeIssue {
  rowIndex: number;       // 1-based
  column:   string;       // Excel column letter (e.g. 'F' or 'E')
  rawValue: string;
  sheetName:string;
}

export function validateStudentCodes(
  rows: Array<{ rowIndex: number; value: unknown }>,
  ctx: { column: string; sheetName: string }
): CodeIssue[] {
  const issues: CodeIssue[] = [];
  for (const r of rows) {
    const str = r.value == null ? '' : String(r.value).trim();
    if (!STUDENT_CODE_RE.test(str)) {
      issues.push({
        rowIndex: r.rowIndex,
        column:   ctx.column,
        rawValue: str,
        sheetName: ctx.sheetName
      });
    }
  }
  return issues;
}
