import { describe, expect, it } from 'vitest';
import { isValidStudentCode } from '@/lib/canb/studentCodeValidator';

describe('studentCodeValidator', () => {
  it('통과: CB00029576', () => { expect(isValidStudentCode('CB00029576')).toBe(true); });
  it('통과: CB1',         () => { expect(isValidStudentCode('CB1')).toBe(true); });
  it('실패: cb00029576 (소문자)', () => { expect(isValidStudentCode('cb00029576')).toBe(false); });
  it('실패: CB-123 (하이픈 포함)', () => { expect(isValidStudentCode('CB-123')).toBe(false); });
  it('실패: 빈 문자열', () => { expect(isValidStudentCode('')).toBe(false); });
  it('실패: null',     () => { expect(isValidStudentCode(null)).toBe(false); });
});
