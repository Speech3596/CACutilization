-- Seed CANB campuses (unchanged; rerunnable)

insert into campuses (id, name, type, display_order) values
  (1, '수지',   'direct',    1),
  (2, '죽전',   'direct',    2),
  (3, '송도',   'direct',    3),
  (4, '마곡',   'direct',    4),
  (5, '이매',   'direct',    5),
  (6, '김포',   'franchise', 6),
  (7, '운정',   'franchise', 7),
  (8, '영통',   'franchise', 8),
  (9, '식사',   'franchise', 9),
  (10, '동대문','franchise', 10)
on conflict (id) do update
  set name = excluded.name,
      type = excluded.type,
      display_order = excluded.display_order;
