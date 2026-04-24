import { describe, expect, it } from 'vitest';
import { computeReport, type StudentRow, type LogRow } from '@/lib/canb/reportCalculator';

// 미니 데이터셋:
//   - 수지(1): 학생 3명 — 담임 A (2명 CB1, CB2), 담임 B (1명 CB3)
//   - 김포(6): 학생 2명 — 담임 C (1명 CB4), 담임 D (1명 CB5, 단계=W4 → 중등)
//
// 로그(기간: 2026-03-01 ~ 2026-03-31):
//   CB1 × 3 (담임 A와 일치)
//   CB1 × 1 (강사 다른 이름 — homeroom 불일치)
//   CB2 × 2 (담임 A 일치 1건 + 다른 이름 1건)
//   CB3 × 0
//   CB4 × 2 (담임 C 일치)
//   CB5 × 5 (담임 D 일치)  ← exclude_upper_levels=true일 때 전부 제외
//   CBGhost × 1 (매칭 실패 — 버려짐)
//
// 기대:
//   [exclude OFF, 모든 학생 포함]
//     enrolled_total = 5, 로그 in period = 14(ghost 포함), matched = 13
//     종합 유니크 학생=4 (CB1 CB2 CB4 CB5), 담임-일치 유니크=4 (CB1,CB2,CB4,CB5)
//   [exclude ON]
//     enrolled_total = 4 (CB5 제외), matched = 8 (CB5의 5건 제외, ghost 제외, CB1×4+CB2×2+CB4×2)
//     유니크 학생 = 3, 담임일치 유니크 = 3

function mkStudents(): StudentRow[] {
  return [
    { student_code: 'CB1', campus_raw: '수지캔비어학원', campus_id: 1, name: 'S1', teacher: 'A', status: '등록', grade: null, level: 'Hexa 1', phase: '초등' },
    { student_code: 'CB2', campus_raw: '수지캔비어학원', campus_id: 1, name: 'S2', teacher: 'A', status: '등록', grade: null, level: 'Hexa 1', phase: '초등' },
    { student_code: 'CB3', campus_raw: '수지캔비어학원', campus_id: 1, name: 'S3', teacher: 'B', status: '등록', grade: null, level: 'Penta 2', phase: '초등' },
    { student_code: 'CB4', campus_raw: '김포캔비어학원', campus_id: 6, name: 'S4', teacher: 'C', status: '등록', grade: null, level: 'Hexa 1', phase: '초등' },
    { student_code: 'CB5', campus_raw: '김포캔비어학원', campus_id: 6, name: 'S5', teacher: 'D', status: '등록', grade: null, level: 'W4', phase: '중등' },
    // 퇴원 학생 → 필터 아웃
    { student_code: 'CB9', campus_raw: '수지캔비어학원', campus_id: 1, name: 'Sx', teacher: 'A', status: '퇴원', grade: null, level: 'Hexa 1', phase: '초등' }
  ];
}

const d = (iso: string) => new Date(`${iso}+09:00`);

function mkLogs(): LogRow[] {
  return [
    { student_code: 'CB1', teacher_name: 'A',   access_datetime: d('2026-03-05T10:00:00') },
    { student_code: 'CB1', teacher_name: 'A',   access_datetime: d('2026-03-06T10:00:00') },
    { student_code: 'CB1', teacher_name: 'A',   access_datetime: d('2026-03-07T10:00:00') },
    { student_code: 'CB1', teacher_name: 'X',   access_datetime: d('2026-03-08T10:00:00') },
    { student_code: 'CB2', teacher_name: 'A',   access_datetime: d('2026-03-09T10:00:00') },
    { student_code: 'CB2', teacher_name: 'Y',   access_datetime: d('2026-03-10T10:00:00') },
    { student_code: 'CB4', teacher_name: 'C',   access_datetime: d('2026-03-11T10:00:00') },
    { student_code: 'CB4', teacher_name: 'C',   access_datetime: d('2026-03-12T10:00:00') },
    { student_code: 'CB5', teacher_name: 'D',   access_datetime: d('2026-03-13T10:00:00') },
    { student_code: 'CB5', teacher_name: 'D',   access_datetime: d('2026-03-14T10:00:00') },
    { student_code: 'CB5', teacher_name: 'D',   access_datetime: d('2026-03-15T10:00:00') },
    { student_code: 'CB5', teacher_name: 'D',   access_datetime: d('2026-03-16T10:00:00') },
    { student_code: 'CB5', teacher_name: 'D',   access_datetime: d('2026-03-17T10:00:00') },
    { student_code: 'CBGhost', teacher_name: 'Z', access_datetime: d('2026-03-18T10:00:00') }
  ];
}

describe('computeReport (§5)', () => {
  it('exclude OFF → 모든 학생 포함', () => {
    const r = computeReport({
      students: mkStudents(),
      logs:     mkLogs(),
      period_start: d('2026-03-01T00:00:00'),
      period_end:   d('2026-03-31T23:59:59'),
      exclude_upper_levels:  false,
      exclude_middle_levels: false
    });
    expect(r.counts.enrolled_total).toBe(5);
    expect(r.counts.enrolled_direct).toBe(3);
    expect(r.counts.enrolled_franchise).toBe(2);
    expect(r.counts.logs_in_period).toBe(14);
    expect(r.counts.logs_matched_to_enrolled).toBe(13); // ghost 제외

    const overall = r.overall.columns.find((c) => c.key === 'overall')!;
    expect(overall.metrics.total_views).toBe(13);
    expect(overall.metrics.unique_student_views).toBe(4);            // CB1,CB2,CB4,CB5
    expect(overall.metrics.usage_rate).toBeCloseTo(80.0, 1);          // 4/5
    expect(overall.metrics.homeroom_unique_views).toBe(4);           // CB1,CB2,CB4,CB5 (각 담임 일치 1건 이상)
    expect(overall.metrics.homeroom_unique_rate).toBeCloseTo(80.0, 1);
  });

  it('중등 제외 ON → CB5(W4 중등) 제외', () => {
    const r = computeReport({
      students: mkStudents(),
      logs:     mkLogs(),
      period_start: d('2026-03-01T00:00:00'),
      period_end:   d('2026-03-31T23:59:59'),
      exclude_upper_levels:  false,
      exclude_middle_levels: true
    });
    expect(r.counts.enrolled_total).toBe(4);
    expect(r.counts.enrolled_franchise).toBe(1);
    expect(r.counts.logs_matched_to_enrolled).toBe(8); // CB1×4 + CB2×2 + CB4×2

    const overall = r.overall.columns.find((c) => c.key === 'overall')!;
    expect(overall.metrics.total_views).toBe(8);
    expect(overall.metrics.unique_student_views).toBe(3); // CB1,CB2,CB4
    expect(overall.metrics.usage_rate).toBeCloseTo(75.0, 1);    // 3/4
    expect(overall.metrics.homeroom_unique_views).toBe(3);      // CB1→A, CB2→A, CB4→C 모두 일치 있음
  });

  it('수지 시트: 담임 A가 담임 B보다 먼저 (학생수 DESC)', () => {
    const r = computeReport({
      students: mkStudents(),
      logs:     mkLogs(),
      period_start: d('2026-03-01T00:00:00'),
      period_end:   d('2026-03-31T23:59:59'),
      exclude_upper_levels:  false,
      exclude_middle_levels: false
    });
    const suji = r.campuses.find((c) => c.campus_id === 1)!;
    // 첫 컬럼 = 캠퍼스 합계
    expect(suji.columns[0].key).toBe('total');
    expect(suji.columns[0].enrolled).toBe(3);
    // 담임 A (2명) → 담임 B (1명)
    expect(suji.columns[1].label).toBe('A');
    expect(suji.columns[2].label).toBe('B');
    // 담임 A의 지표
    expect(suji.columns[1].metrics.total_views).toBe(6);  // CB1×4 + CB2×2
    expect(suji.columns[1].metrics.unique_student_views).toBe(2);
  });
});
