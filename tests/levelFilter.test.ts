import { describe, expect, it } from 'vitest';
import { isUpperOrMiddle } from '@/lib/canb/levelFilter';

describe('isUpperOrMiddle (§5-2a)', () => {
  // 포함 (false)
  it('Penta L1 → 포함', () => expect(isUpperOrMiddle('Penta L1', '초등')).toBe(false));
  it('Penta L2 → 포함', () => expect(isUpperOrMiddle('Penta L2', '초등')).toBe(false));
  it('Hexa 1   → 포함', () => expect(isUpperOrMiddle('Hexa 1',   '초등')).toBe(false));
  it('Hepta 3  → 포함', () => expect(isUpperOrMiddle('Hepta 3',  '초등')).toBe(false));
  it('Octa 2   → 포함', () => expect(isUpperOrMiddle('Octa 2',   '초등')).toBe(false));
  it('Nona 1   → 포함', () => expect(isUpperOrMiddle('Nona 1',   '초등')).toBe(false));
  it('공백값 + 초등 → 포함', () => expect(isUpperOrMiddle('', '초등')).toBe(false));

  // 제외 (true)
  it('Deca 1    → 제외', () => expect(isUpperOrMiddle('Deca 1',    '초등')).toBe(true));
  it('Hendeca 2 → 제외', () => expect(isUpperOrMiddle('Hendeca 2', '초등')).toBe(true));
  it('W4        → 제외', () => expect(isUpperOrMiddle('W4',        '중등')).toBe(true));
  it('W4S       → 제외', () => expect(isUpperOrMiddle('W4S',       '중등')).toBe(true));
  it('Y3S       → 제외', () => expect(isUpperOrMiddle('Y3S',       '중등')).toBe(true));
  it('X1        → 제외', () => expect(isUpperOrMiddle('X1',        '중등')).toBe(true));
  it('Z2        → 제외', () => expect(isUpperOrMiddle('Z2',        '중등')).toBe(true));
  it('L3        → 제외', () => expect(isUpperOrMiddle('L3',        '중등')).toBe(true));
  it('L1        → 제외', () => expect(isUpperOrMiddle('L1',        '중등')).toBe(true));
  it('교육 단계=중등 + 단계 공백 → 제외', () => expect(isUpperOrMiddle('', '중등')).toBe(true));
  it('교육 단계=고등 → 제외', () => expect(isUpperOrMiddle('', '고등')).toBe(true));
});
