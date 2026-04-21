// §5 Report calculation.
//
//  - enrolled 학생 = 상태 == "등록"
//  - exclude_upper_levels 옵션이 true면 Deca·Hendeca·중등·고등 제외 (§5-2a)
//  - logs = ACCESS_DATETIME ∈ [period_start, period_end]
//  - STUDENT_CODE → 학생(enrolled) 미매칭 로그는 **완전 제외** (§5-2(5))
//  - 학생의 담임 기준 그룹핑 (§5-2(6))

import { CAMPUSES, CAMPUS_BY_ID, CampusMaster, DIRECT_CAMPUSES, FRANCHISE_CAMPUSES, mapCampusRaw } from './campusMapping';
import { isUpperOrMiddle } from './levelFilter';

// =====================================================================
// Input types
// =====================================================================
export interface StudentRow {
  student_code: string;
  campus_raw:   string;
  campus_id:    number | null;   // pre-mapped (§3-1)
  name:         string;
  teacher:      string | null;   // 담임 (원문)
  status:       string;          // 등록/퇴원 등
  grade:        string | null;
  level:        string | null;   // 단계 (G열)
  phase:        string | null;   // 교육 단계
}

export interface LogRow {
  student_code:    string;
  teacher_name:    string | null; // 로그 강사명
  access_datetime: string | Date;
}

export interface ReportInput {
  students:             StudentRow[];
  logs:                 LogRow[];
  period_start:         Date;
  period_end:           Date;
  exclude_upper_levels: boolean;
}

// =====================================================================
// Output types (§5-3 six metrics × §5-4 sheet structure)
// =====================================================================
export const METRIC_KEYS = [
  'total_views',
  'usage_rate',
  'unique_student_views',
  'unique_student_rate',
  'homeroom_unique_views',
  'homeroom_unique_rate'
] as const;
export type MetricKey = typeof METRIC_KEYS[number];

export const METRIC_LABELS: Record<MetricKey, string> = {
  total_views:           '총 조회수',
  usage_rate:            '사용률',
  unique_student_views:  '학생 고유 조회수',
  unique_student_rate:   '학생 고유 사용률',
  homeroom_unique_views: '담임 고유 조회수',
  homeroom_unique_rate:  '담임 고유 사용률'
};

export interface MetricValues {
  total_views:            number;  // rate fields are percentages 0..100
  usage_rate:             number;
  unique_student_views:   number;
  unique_student_rate:    number;
  homeroom_unique_views:  number;
  homeroom_unique_rate:   number;
  enrolled_count:         number;
}

/** Column within a campus sheet — 캠퍼스 합계 + 담임 N개 + (옵션) 미지정 */
export interface TeacherColumn {
  key:       string;            // e.g. 'total', '이승환', '__unassigned__'
  label:     string;            // UI label
  enrolled:  number;            // 담당 등록 학생 수 (정렬 기준)
  metrics:   MetricValues;
}

export interface CampusSheet {
  campus_id:   number | null;   // null → aggregate (종합/소계)
  campus_name: string;
  columns:     TeacherColumn[]; // 첫 컬럼은 '캠퍼스 합계', 마지막이 '미지정' (있을 때만)
}

export interface AggregateSheet {
  key:     'overall' | 'direct' | 'franchise';
  name:    string;                    // '종합' | '직영 소계' | '가맹 소계'
  columns: Array<{
    key:     string;                  // 'overall' | 'direct' | 'franchise' | campus name
    label:   string;
    metrics: MetricValues;
  }>;
}

export interface ReportResult {
  input: {
    period_start:         string;
    period_end:           string;
    exclude_upper_levels: boolean;
  };
  counts: {
    enrolled_total:           number; // exclude 필터 후 등록 학생 수
    enrolled_direct:          number;
    enrolled_franchise:       number;
    logs_in_period:           number;
    logs_matched_to_enrolled: number;
  };
  overall:   AggregateSheet;
  direct:    AggregateSheet;
  franchise: AggregateSheet;
  campuses:  CampusSheet[];  // 10개 (등록 학생 0명이어도 빈 시트 생성)
}

// =====================================================================
// Helpers
// =====================================================================
function pct(num: number, den: number): number {
  if (den <= 0) return 0;
  return Math.round((num / den) * 1000) / 10; // 소수 1자리
}

function toTime(v: string | Date): number {
  if (v instanceof Date) return v.getTime();
  const d = new Date(v);
  return d.getTime();
}

function teacherKey(raw: string | null | undefined): { key: string; label: string } {
  const t = (raw ?? '').trim();
  if (!t) return { key: '__unassigned__', label: '미지정' };
  return { key: t, label: t };
}

/** 특정 학생 집합 + 매칭 로그 집합에서 6개 지표 계산 */
function computeMetrics(
  enrolledCodes: Set<string>,
  matchedLogs:   Array<{ student_code: string; teacher_name: string | null }>,
  // homeroom 일치 판정: student_code → 학생의 담임명(원문)
  teacherByCode: Map<string, string | null>
): MetricValues {
  const enrolled_count = enrolledCodes.size;

  const total_views = matchedLogs.length;

  const studentsWithAnyLog = new Set<string>();
  const studentsWithHomeroomLog = new Set<string>();
  for (const row of matchedLogs) {
    studentsWithAnyLog.add(row.student_code);
    const hr = teacherByCode.get(row.student_code);
    const hrN = (hr ?? '').trim();
    const lgN = (row.teacher_name ?? '').trim();
    if (hrN && lgN && hrN === lgN) {
      studentsWithHomeroomLog.add(row.student_code);
    }
  }
  const unique_student_views  = studentsWithAnyLog.size;
  const homeroom_unique_views = studentsWithHomeroomLog.size;

  // 사용률 정의 (§5-3):
  //   usage_rate            = 총조회수 / 전체학생수        → 100% 초과 가능 (학생당 여러 건 접속)
  //   unique_student_rate   = 학생고유조회수 / 전체학생수  → 최대 100%
  //   homeroom_unique_rate  = 담임고유조회수 / 전체학생수  → 최대 100%,
  //                           homeroom_unique ⊆ unique_student 이므로 학생고유사용률 이하.
  return {
    enrolled_count,
    total_views,
    usage_rate:            pct(total_views,           enrolled_count),
    unique_student_views,
    unique_student_rate:   pct(unique_student_views,  enrolled_count),
    homeroom_unique_views,
    homeroom_unique_rate:  pct(homeroom_unique_views, enrolled_count)
  };
}

// =====================================================================
// Main
// =====================================================================
export function computeReport(input: ReportInput): ReportResult {
  const periodStart = input.period_start.getTime();
  const periodEnd   = input.period_end.getTime();

  // 1) 등록 학생 필터
  let enrolled = input.students.filter((s) => (s.status ?? '').trim() === '등록');

  // 2) exclude_upper_levels (§5-2a)
  if (input.exclude_upper_levels) {
    enrolled = enrolled.filter((s) => !isUpperOrMiddle(s.level, s.phase));
  }

  // 3) campus 매핑 (일단 pre-mapped 사용, 없으면 on-the-fly)
  const enrolledWithCampus = enrolled
    .map((s) => {
      const cId = s.campus_id ?? (mapCampusRaw(s.campus_raw)?.id ?? null);
      return { ...s, campus_id: cId };
    })
    .filter((s) => s.campus_id != null) as (StudentRow & { campus_id: number })[];

  const enrolledSet    = new Set(enrolledWithCampus.map((s) => s.student_code));
  const teacherByCode  = new Map(enrolledWithCampus.map((s) => [s.student_code, s.teacher] as const));
  const campusByCode   = new Map(enrolledWithCampus.map((s) => [s.student_code, s.campus_id] as const));

  // 4) 로그 필터: 기간 ∈ [start, end] AND code ∈ enrolled
  const logsInPeriod = input.logs.filter((l) => {
    const t = toTime(l.access_datetime);
    return t >= periodStart && t <= periodEnd;
  });

  const matched = logsInPeriod.filter((l) => enrolledSet.has(l.student_code));

  // 5) 캠퍼스 시트
  const campusSheets: CampusSheet[] = CAMPUSES.map((campus) => {
    const campusStudents = enrolledWithCampus.filter((s) => s.campus_id === campus.id);
    const campusCodes    = new Set(campusStudents.map((s) => s.student_code));
    const campusLogs     = matched.filter((l) => campusCodes.has(l.student_code));

    // 담임별 학생 그룹핑
    const byTeacher = new Map<string, { label: string; students: Set<string> }>();
    for (const s of campusStudents) {
      const { key, label } = teacherKey(s.teacher);
      const g = byTeacher.get(key) ?? { label, students: new Set<string>() };
      g.students.add(s.student_code);
      byTeacher.set(key, g);
    }

    // 캠퍼스 합계
    const totalMetrics = computeMetrics(campusCodes, campusLogs, teacherByCode);

    // 담임별 columns
    const teacherCols: TeacherColumn[] = [];
    for (const [key, g] of byTeacher.entries()) {
      const logs = campusLogs.filter((l) => g.students.has(l.student_code));
      const metrics = computeMetrics(g.students, logs, teacherByCode);
      teacherCols.push({
        key,
        label: g.label,
        enrolled: g.students.size,
        metrics
      });
    }

    // 정렬: 담당 등록 학생 수 DESC, 단 '__unassigned__'는 맨 끝
    const unassigned = teacherCols.find((c) => c.key === '__unassigned__');
    const assigned   = teacherCols.filter((c) => c.key !== '__unassigned__');
    assigned.sort((a, b) => b.enrolled - a.enrolled || a.label.localeCompare(b.label, 'ko'));

    const columns: TeacherColumn[] = [
      { key: 'total', label: '캠퍼스 합계', enrolled: campusCodes.size, metrics: totalMetrics },
      ...assigned,
      ...(unassigned ? [unassigned] : [])
    ];

    return {
      campus_id: campus.id,
      campus_name: campus.name,
      columns
    };
  });

  // 6) 집계 시트 (§5-6)
  const enrolledByType = (type: 'direct' | 'franchise'): Set<string> =>
    new Set(
      enrolledWithCampus
        .filter((s) => CAMPUS_BY_ID[s.campus_id]?.type === type)
        .map((s) => s.student_code)
    );

  const directCodes    = enrolledByType('direct');
  const franchiseCodes = enrolledByType('franchise');
  const allCodes       = new Set([...directCodes, ...franchiseCodes]);

  const metricsFor = (codes: Set<string>): MetricValues => {
    const logs = matched.filter((l) => codes.has(l.student_code));
    return computeMetrics(codes, logs, teacherByCode);
  };

  const buildCampusCell = (c: CampusMaster) => {
    const sheet = campusSheets.find((s) => s.campus_id === c.id)!;
    return {
      key: String(c.id),
      label: c.name,
      metrics: sheet.columns[0].metrics // 캠퍼스 합계
    };
  };

  const overall: AggregateSheet = {
    key: 'overall',
    name: '종합',
    columns: [
      { key: 'overall',   label: 'CANB 전체', metrics: metricsFor(allCodes) },
      { key: 'direct',    label: '직영 소계', metrics: metricsFor(directCodes) },
      { key: 'franchise', label: '가맹 소계', metrics: metricsFor(franchiseCodes) },
      ...DIRECT_CAMPUSES.map(buildCampusCell),
      ...FRANCHISE_CAMPUSES.map(buildCampusCell)
    ]
  };

  const directAgg: AggregateSheet = {
    key: 'direct',
    name: '직영 소계',
    columns: [
      { key: 'direct', label: '직영 소계', metrics: metricsFor(directCodes) },
      ...DIRECT_CAMPUSES.map(buildCampusCell)
    ]
  };

  const franchiseAgg: AggregateSheet = {
    key: 'franchise',
    name: '가맹 소계',
    columns: [
      { key: 'franchise', label: '가맹 소계', metrics: metricsFor(franchiseCodes) },
      ...FRANCHISE_CAMPUSES.map(buildCampusCell)
    ]
  };

  return {
    input: {
      period_start: input.period_start.toISOString(),
      period_end:   input.period_end.toISOString(),
      exclude_upper_levels: input.exclude_upper_levels
    },
    counts: {
      enrolled_total:           allCodes.size,
      enrolled_direct:          directCodes.size,
      enrolled_franchise:       franchiseCodes.size,
      logs_in_period:           logsInPeriod.length,
      logs_matched_to_enrolled: matched.length
    },
    overall,
    direct:    directAgg,
    franchise: franchiseAgg,
    campuses:  campusSheets
  };
}
