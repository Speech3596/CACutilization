// §5-2a "Deca~ / 중등 제외" 레벨 필터링 규칙
//
// 2개 독립 토글로 분리되어 있음:
//   exclude_upper_levels  → Deca·Hendeca 만 제외 (중등은 분모 포함)
//   exclude_middle_levels → 중등(X/W/Y/Z, 통합 L, phase='중등'/'고등') 만 제외

export const UPPER_LEVEL_RE   = /^(deca|hendeca)\b/i;   // 초등 상위 (Deca, Hendeca)
export const MIDDLE_GROUP_RE  = /^[xwyz]\s*\d/i;         // X/W/Y/Z + 숫자
export const STANDALONE_L_RE  = /^l\s*\d/i;              // L + 숫자 (통합 L)
export const PENTA_L_RE       = /^penta\s*l/i;           // Penta L* (초등)

/** Deca·Hendeca 여부 (초등 상위 그룹) */
export function isUpperElementary(level: string | null | undefined): boolean {
  const v = (level ?? '').toString().trim();
  if (PENTA_L_RE.test(v)) return false;
  return UPPER_LEVEL_RE.test(v);
}

/** 중등/고등 여부 (X/W/Y/Z, 통합 L, phase='중등'/'고등') */
export function isMiddleOrHigh(level: string | null | undefined, phase: string | null | undefined): boolean {
  const v = (level ?? '').toString().trim();
  const p = (phase ?? '').toString().trim();

  if (PENTA_L_RE.test(v)) return false;   // Penta L* 은 초등

  if (MIDDLE_GROUP_RE.test(v)) return true;
  if (STANDALONE_L_RE.test(v)) return true;
  if (p === '중등' || p === '고등') return true;

  return false;
}

/**
 * 하위 호환용: 두 그룹을 모두 제외 대상으로 판정.
 * true  → 제외 (Deca~ · Hendeca · 중등 · 고등)
 * false → 포함 (Penta, Hexa, Hepta, Octa, Nona, Penta L*)
 */
export function isUpperOrMiddle(level: string | null | undefined, phase: string | null | undefined): boolean {
  return isUpperElementary(level) || isMiddleOrHigh(level, phase);
}
