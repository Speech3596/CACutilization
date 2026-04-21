import { describe, expect, it } from 'vitest';
import { mapCampusRaw } from '@/lib/canb/campusMapping';

describe('mapCampusRaw (§3-1)', () => {
  it('수지캔비어학원 → 수지', () => {
    expect(mapCampusRaw('수지캔비어학원')?.name).toBe('수지');
  });
  it('수원 포함 → 영통 (예외)', () => {
    expect(mapCampusRaw('경기수원점')?.name).toBe('영통');
    // 수원 예외는 일반 키워드보다 우선해야 한다
    expect(mapCampusRaw('수원식사')?.name).toBe('영통');
  });
  it('파주운정 1관 → 운정', () => {
    expect(mapCampusRaw('파주운정 1관')?.name).toBe('운정');
  });
  it('일산식사 → 식사', () => {
    expect(mapCampusRaw('일산식사')?.name).toBe('식사');
  });
  it('매칭 실패 → null', () => {
    expect(mapCampusRaw('알수없는캠퍼스')).toBeNull();
    expect(mapCampusRaw('')).toBeNull();
    expect(mapCampusRaw(null)).toBeNull();
  });
  it('복수 키워드 → 마스터 순서 우선 (수지가 동대문보다 먼저)', () => {
    expect(mapCampusRaw('수지동대문혼합')?.name).toBe('수지');
  });
});
