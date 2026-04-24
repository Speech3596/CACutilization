-- 0003: "Deca~ / 중등 제외" 체크박스를 두 개로 분리.
--   exclude_upper_levels  → Deca·Hendeca 만 제외 (중등은 분모 포함)
--   exclude_middle_levels → 중등(X/W/Y/Z, 통합 L, phase='중등'/'고등') 만 제외 (Deca~ 은 분모 포함)
-- 두 옵션을 모두 체크하면 기존 v2 의 "Deca~/중등 제외" 와 동일한 의미.

alter table reports
  add column if not exists exclude_middle_levels boolean not null default false;

-- 기존 unique 제약을 제거하고 새 컬럼 포함해 재생성.
do $$
declare
  cons_name text;
begin
  select conname into cons_name
  from pg_constraint
  where conrelid = 'public.reports'::regclass
    and contype  = 'u'
    and pg_get_constraintdef(oid) ilike '%exclude_upper_levels%'
    and pg_get_constraintdef(oid) not ilike '%exclude_middle_levels%';
  if cons_name is not null then
    execute format('alter table public.reports drop constraint %I', cons_name);
  end if;
end$$;

alter table reports
  add constraint reports_input_unique
  unique (student_snapshot_id, log_upload_id, period_start, period_end, exclude_upper_levels, exclude_middle_levels);
