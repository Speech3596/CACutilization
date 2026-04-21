-- CANB CAC Log — initial schema
-- Run in Supabase SQL editor OR via `supabase db push`.

-- =====================================================================
-- 1) 캠퍼스 마스터 (seed 전용, 수정 금지)
-- =====================================================================
create table if not exists campuses (
  id            int primary key,
  name          text not null unique,
  type          text not null check (type in ('direct','franchise')),
  display_order int  not null
);

-- =====================================================================
-- 2) 프로필 (auth.users 확장)
-- =====================================================================
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null unique,
  full_name  text,
  role       text not null check (role in ('admin','hq_viewer','campus_manager')),
  campus_id  int  references campuses(id),
  created_at timestamptz not null default now()
);

-- =====================================================================
-- 3) 학생 스냅샷
-- =====================================================================
create table if not exists student_snapshots (
  id            uuid primary key default gen_random_uuid(),
  base_date     date not null,
  filename      text not null,
  uploaded_by   uuid not null references profiles(id),
  uploaded_at   timestamptz not null default now(),
  row_count     int  not null,
  storage_path  text not null,
  is_active     boolean not null default true,
  unique (base_date)
);

-- =====================================================================
-- 4) 학생 행
-- =====================================================================
create table if not exists students (
  snapshot_id   uuid not null references student_snapshots(id) on delete cascade,
  student_code  text not null,
  campus_raw    text not null,
  campus_id     int  references campuses(id),
  name          text not null,
  teacher       text,
  status        text not null,
  grade         text,
  level         text,
  phase         text,
  raw           jsonb,
  primary key (snapshot_id, student_code)
);
create index if not exists students_snapshot_campus_idx on students (snapshot_id, campus_id);
create index if not exists students_snapshot_teacher_idx on students (snapshot_id, teacher);
create index if not exists students_snapshot_status_idx on students (snapshot_id, status);

-- =====================================================================
-- 5) 로그 업로드
-- =====================================================================
create table if not exists log_uploads (
  id                uuid primary key default gen_random_uuid(),
  filename          text not null,
  uploaded_by       uuid not null references profiles(id),
  uploaded_at       timestamptz not null default now(),
  period_start_auto timestamptz not null,
  period_end_auto   timestamptz not null,
  row_count         int not null,
  storage_path      text not null
);

-- =====================================================================
-- 6) 로그 행
-- =====================================================================
create table if not exists access_logs (
  id              bigserial primary key,
  log_upload_id   uuid not null references log_uploads(id) on delete cascade,
  campus_raw      text not null,
  teacher_name    text,
  student_name    text,
  student_code    text not null,
  access_datetime timestamptz not null
);
create index if not exists access_logs_upload_code_idx on access_logs (log_upload_id, student_code);
create index if not exists access_logs_upload_time_idx on access_logs (log_upload_id, access_datetime);

-- =====================================================================
-- 7) 리포트 (캐시)
-- =====================================================================
create table if not exists reports (
  id                    uuid primary key default gen_random_uuid(),
  student_snapshot_id   uuid not null references student_snapshots(id),
  log_upload_id         uuid not null references log_uploads(id),
  period_start          timestamptz not null,
  period_end            timestamptz not null,
  exclude_upper_levels  boolean not null default false,
  created_by            uuid not null references profiles(id),
  created_at            timestamptz not null default now(),
  data                  jsonb not null,
  xlsx_path             text,
  unique (student_snapshot_id, log_upload_id, period_start, period_end, exclude_upper_levels)
);
create index if not exists reports_created_by_idx on reports (created_by);
create index if not exists reports_created_at_idx on reports (created_at desc);

-- =====================================================================
-- 8) 다운로드 이력
-- =====================================================================
create table if not exists report_downloads (
  id            bigserial primary key,
  report_id     uuid not null references reports(id) on delete cascade,
  user_id       uuid not null references profiles(id),
  downloaded_at timestamptz not null default now()
);

-- =====================================================================
-- RLS
-- =====================================================================
alter table profiles          enable row level security;
alter table campuses          enable row level security;
alter table student_snapshots enable row level security;
alter table students          enable row level security;
alter table log_uploads       enable row level security;
alter table access_logs       enable row level security;
alter table reports           enable row level security;
alter table report_downloads  enable row level security;

-- Helpers --------------------------------------------------------------
create or replace function current_profile_role() returns text
  language sql stable security definer set search_path = public, auth
  as $$ select role from profiles where id = auth.uid() $$;

create or replace function current_profile_campus_id() returns int
  language sql stable security definer set search_path = public, auth
  as $$ select campus_id from profiles where id = auth.uid() $$;

-- profiles -------------------------------------------------------------
drop policy if exists profiles_self_select on profiles;
create policy profiles_self_select on profiles
  for select using (id = auth.uid() or current_profile_role() = 'admin');

drop policy if exists profiles_admin_manage on profiles;
create policy profiles_admin_manage on profiles
  for all using (current_profile_role() = 'admin')
  with check (current_profile_role() = 'admin');

-- campuses -------------------------------------------------------------
drop policy if exists campuses_all_read on campuses;
create policy campuses_all_read on campuses
  for select using (auth.uid() is not null);

-- student_snapshots ----------------------------------------------------
drop policy if exists ss_read on student_snapshots;
create policy ss_read on student_snapshots
  for select using (
    current_profile_role() in ('admin','hq_viewer')
    or (current_profile_role() = 'campus_manager')
  );
drop policy if exists ss_admin_mutate on student_snapshots;
create policy ss_admin_mutate on student_snapshots
  for all using (current_profile_role() = 'admin')
  with check (current_profile_role() = 'admin');

-- students -------------------------------------------------------------
drop policy if exists students_read on students;
create policy students_read on students
  for select using (
    current_profile_role() in ('admin','hq_viewer')
    or (current_profile_role() = 'campus_manager'
        and campus_id = current_profile_campus_id())
  );
drop policy if exists students_admin_mutate on students;
create policy students_admin_mutate on students
  for all using (current_profile_role() = 'admin')
  with check (current_profile_role() = 'admin');

-- log_uploads ----------------------------------------------------------
drop policy if exists lu_read on log_uploads;
create policy lu_read on log_uploads
  for select using (
    current_profile_role() in ('admin','hq_viewer','campus_manager')
  );
drop policy if exists lu_admin_mutate on log_uploads;
create policy lu_admin_mutate on log_uploads
  for all using (current_profile_role() = 'admin')
  with check (current_profile_role() = 'admin');

-- access_logs ----------------------------------------------------------
drop policy if exists al_read on access_logs;
create policy al_read on access_logs
  for select using (
    current_profile_role() in ('admin','hq_viewer')
    or (
      current_profile_role() = 'campus_manager'
      and exists (
        select 1 from students s
          where s.student_code = access_logs.student_code
            and s.campus_id    = current_profile_campus_id()
      )
    )
  );
drop policy if exists al_admin_mutate on access_logs;
create policy al_admin_mutate on access_logs
  for all using (current_profile_role() = 'admin')
  with check (current_profile_role() = 'admin');

-- reports --------------------------------------------------------------
drop policy if exists reports_read on reports;
create policy reports_read on reports
  for select using (
    current_profile_role() in ('admin','hq_viewer')
    or created_by = auth.uid()
  );
drop policy if exists reports_insert on reports;
create policy reports_insert on reports
  for insert with check (
    current_profile_role() in ('admin','hq_viewer','campus_manager')
    and created_by = auth.uid()
  );
drop policy if exists reports_admin_update on reports;
create policy reports_admin_update on reports
  for update using (current_profile_role() = 'admin')
  with check (current_profile_role() = 'admin');

-- report_downloads -----------------------------------------------------
drop policy if exists rd_insert_self on report_downloads;
create policy rd_insert_self on report_downloads
  for insert with check (user_id = auth.uid());
drop policy if exists rd_read on report_downloads;
create policy rd_read on report_downloads
  for select using (
    user_id = auth.uid() or current_profile_role() = 'admin'
  );

-- =====================================================================
-- 스토리지 버킷은 Supabase UI 또는 다음 스니펫으로 생성하세요.
--   insert into storage.buckets (id, name, public) values
--     ('student-snapshots','student-snapshots', false),
--     ('access-logs','access-logs', false),
--     ('reports','reports', false);
-- 그리고 admin 전용 insert/update/delete 정책, 인증된 사용자 select 정책을 추가.
-- =====================================================================
