// §5-2a "Deca~ / 중등 제외" 레벨 필터링 규칙

export const UPPER_LEVEL_RE   = /^(deca|hendeca)\b/i;   // 초등 상위 (Deca, Hendeca)
export const MIDDLE_GROUP_RE  = /^[xwyz]\s*\d/i;         // X/W/Y/Z + 숫자
export const STANDALONE_L_RE  = /^l\s*\d/i;              // L + 숫자 (통합 L)
export const PENTA_L_RE       = /^penta\s*l/i;           // Penta L* (초등)

/**
 * true  → 제외 대상(Deca~ · Hendeca · 중등 · 고등)
 * false → 포함 (Penta, Hexa, Hepta, Octa, Nona, Penta L*)
 */
export function isUpperOrMiddle(level: string | null | undefined, phase: string | null | undefined): boolean {
  const v = (level ?? '').toString().trim();
  const p = (phase ?? '').toString().trim();

  // Penta L* 은 초등 그룹이므로 **포함** (우선 예외 처리)
  if (PENTA_L_RE.test(v)) return false;

  if (UPPER_LEVEL_RE.test(v))  return true;
  if (MIDDLE_GROUP_RE.test(v)) return true;
  if (STANDALONE_L_RE.test(v)) return true;

  // 교육 단계 백업 판정 (단계 컬럼 공백인 경우 등)
  if (p === '중등' || p === '고등') return true;

  return false;
}
