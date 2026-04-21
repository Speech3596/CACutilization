export type CampusType = 'direct' | 'franchise';

export interface CampusMaster {
  id: number;
  name: string;
  type: CampusType;
  displayOrder: number;
}

export const CAMPUSES: CampusMaster[] = [
  { id: 1,  name: '수지',   type: 'direct',    displayOrder: 1 },
  { id: 2,  name: '죽전',   type: 'direct',    displayOrder: 2 },
  { id: 3,  name: '송도',   type: 'direct',    displayOrder: 3 },
  { id: 4,  name: '마곡',   type: 'direct',    displayOrder: 4 },
  { id: 5,  name: '이매',   type: 'direct',    displayOrder: 5 },
  { id: 6,  name: '김포',   type: 'franchise', displayOrder: 6 },
  { id: 7,  name: '운정',   type: 'franchise', displayOrder: 7 },
  { id: 8,  name: '영통',   type: 'franchise', displayOrder: 8 },
  { id: 9,  name: '식사',   type: 'franchise', displayOrder: 9 },
  { id: 10, name: '동대문', type: 'franchise', displayOrder: 10 }
];

export const CAMPUS_BY_ID: Record<number, CampusMaster> = Object.fromEntries(
  CAMPUSES.map((c) => [c.id, c])
);
export const CAMPUS_BY_NAME: Record<string, CampusMaster> = Object.fromEntries(
  CAMPUSES.map((c) => [c.name, c])
);

export const DIRECT_CAMPUSES     = CAMPUSES.filter((c) => c.type === 'direct');
export const FRANCHISE_CAMPUSES  = CAMPUSES.filter((c) => c.type === 'franchise');

/**
 * Raw campus string → display name (§3-1).
 *
 *   1. 원문에 키워드(수지/죽전/송도/마곡/이매/김포/운정/영통/식사/동대문) 포함 → 해당 표시명
 *   2. 예외: `수원` 포함 → **영통**
 *   3. 복수 키워드 → CAMPUSES 순서 우선 매칭
 *   4. 실패 → null
 */
export function mapCampusRaw(raw: string | null | undefined): CampusMaster | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v) return null;

  // §3-1 (2) 예외: 수원 → 영통
  if (v.includes('수원')) {
    return CAMPUS_BY_NAME['영통'] ?? null;
  }

  // §3-1 (1)(3) 키워드 순서 우선 매칭
  for (const c of CAMPUSES) {
    if (v.includes(c.name)) return c;
  }
  return null;
}

export interface CampusMappingIssue {
  rowIndex: number;   // 1-based Excel row (포함: 헤더)
  rawValue: string;
}

/** 스냅샷 전체에 대한 매핑 + 실패 라인 수집 */
export function mapCampusRows(
  rawValues: Array<{ rowIndex: number; value: string }>
): { ok: Array<{ rowIndex: number; campus: CampusMaster; raw: string }>; issues: CampusMappingIssue[] } {
  const ok: Array<{ rowIndex: number; campus: CampusMaster; raw: string }> = [];
  const issues: CampusMappingIssue[] = [];
  for (const r of rawValues) {
    const m = mapCampusRaw(r.value);
    if (m) ok.push({ rowIndex: r.rowIndex, campus: m, raw: r.value });
    else   issues.push({ rowIndex: r.rowIndex, rawValue: r.value ?? '' });
  }
  return { ok, issues };
}
