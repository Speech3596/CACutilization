-- 0002: reports 의 student_snapshot_id / log_upload_id 외래키를 ON DELETE SET NULL 로 완화.
-- 이유: reports.data(JSONB)에 이미 계산된 전체 결과가 저장되므로, 원본 업로드가 지워져도
--       리포트 자체는 보존해야 함. 또한 관리자가 오래된 업로드를 삭제할 수 있어야 함.
-- UI 는 snap?.base_date / lu?.filename 처럼 nullable 을 허용하도록 수정됨.

alter table reports alter column student_snapshot_id drop not null;
alter table reports alter column log_upload_id       drop not null;

alter table reports drop constraint if exists reports_student_snapshot_id_fkey;
alter table reports drop constraint if exists reports_log_upload_id_fkey;

alter table reports
  add constraint reports_student_snapshot_id_fkey
  foreign key (student_snapshot_id) references student_snapshots(id) on delete set null;

alter table reports
  add constraint reports_log_upload_id_fkey
  foreign key (log_upload_id) references log_uploads(id) on delete set null;
