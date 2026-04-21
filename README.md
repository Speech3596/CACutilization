# CANB CAC 접속 로그 분석 시스템

## 1. 프로젝트 개요

캔비어학원(CANB) 학습 플랫폼의 **접속 로그 엑셀**과 **등록 학생 엑셀**을 비교하여,
지정 기간 동안 등록 학생들이 얼마나 학습 플랫폼에 접속했는지를 **캠퍼스·담임 단위 리포트**로
생성하는 내부 웹 시스템입니다. Next.js 14 App Router + TypeScript + Tailwind + shadcn/ui로
구현되고, 인프라는 **Supabase Free Tier + Vercel Hobby**만 사용합니다. 총 12명(admin 1 /
hq_viewer 1 / campus_manager 10) 규모의 내부 사용을 전제로 설계되었습니다.

---

## 2. 사전 준비

- **Node.js 20+** (LTS 권장) 및 npm
- **GitHub 계정** (private repo 생성 권한) + [gh CLI](https://cli.github.com/)
- **Supabase 계정** (Free Tier)
- **Vercel 계정** (Hobby)

---

## 3. Supabase 설정 단계

### 3-1. 프로젝트 생성
1. <https://supabase.com/dashboard> → **New project** → 이름 `canb-cac-log`, 리전 `Northeast Asia (Seoul)` 권장
2. DB 비밀번호 별도 저장
3. 프로젝트 생성 후 **Project Settings → API** 에서 아래 값 확인
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (노출 금지)

### 3-2. 스키마 마이그레이션 실행
- **방법 A — SQL Editor 붙여넣기** (권장, 빠름)
  1. Supabase 대시보드 → **SQL Editor** → `New query`
  2. `supabase/migrations/0001_init.sql` 전체 내용 붙여넣기 → **Run**
- **방법 B — Supabase CLI**
  ```bash
  npx supabase link --project-ref <PROJECT_REF>
  npx supabase db push
  ```

### 3-3. 시드 데이터 실행
- SQL Editor → `supabase/seed.sql` 내용 붙여넣기 → **Run**
- `campuses` 테이블에 10개 캠퍼스(수지/죽전/송도/마곡/이매 직영, 김포/운정/영통/식사/동대문 가맹)가 들어갔는지 확인

### 3-4. Storage 버킷 3개 생성
대시보드 → **Storage** → **Create bucket** 로 아래 **세 개** 모두 생성 (모두 **Private**):

| 버킷명 | 용도 |
|---|---|
| `student-snapshots` | 학생 엑셀 원본 보관(최근 30개 롤링) |
| `access-logs` | IT 접속 로그 엑셀 원본 보관 |
| `reports` | 생성된 리포트 xlsx 캐시 |

**버킷 정책(Policy)**: 서버 라우트에서 `service_role`로만 접근하므로 기본 Private 상태로 두면 됩니다.
추가 RLS 정책은 `0001_init.sql` 내 storage 정책 블록에서 이미 정의됩니다.

### 3-5. Auth 이메일 템플릿 한국어화 (선택)
대시보드 → **Authentication → Email Templates**
- `Invite user` → 제목/본문을 한국어로 교체 (예: "CANB CAC 시스템 초대")
- `Reset password` → 제목/본문 한국어로 교체
- Redirect URL에 배포된 Vercel 도메인(`https://<your-app>.vercel.app`)을 Site URL로 등록 (Authentication → URL Configuration)

---

## 4. 로컬 실행

```bash
# 1) 환경변수
cp .env.local.example .env.local
#   → NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY
#     SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SITE_URL 채우기

# 2) 의존성 설치
npm install

# 3) 최초 Admin 1명 생성 (이메일로 초대 메일 수신 후 비밀번호 설정)
npm run seed:admin -- --email=you@example.com
#   임시 비밀번호를 바로 지정하려면: --password=Init1234!

# 4) 개발 서버
npm run dev            # http://localhost:3000

# 5) 테스트
npm run test           # Vitest (캠퍼스 매핑 / 학생코드 / 레벨필터 / 리포트)
```

---

## 5. GitHub 연결

```bash
git init
git add .
git commit -m "chore: initial commit"
gh repo create canb-cac-log --private --source=. --push
```

---

## 6. Vercel 배포

1. <https://vercel.com/new> → GitHub에서 `canb-cac-log` 레포 Import
2. Framework: **Next.js** 자동 감지
3. **Environment Variables** 등록 (모두 `Production` + `Preview` + `Development`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_SITE_URL` (배포 후 도메인으로 업데이트)
4. **Deploy** 클릭 → 빌드 완료 후 배포 URL을 Supabase `Site URL`(Authentication → URL Configuration)에 반영

---

## 7. 초기 운영 가이드

1. **Admin 로그인**
   - `npm run seed:admin`으로 받은 초대 메일에서 비밀번호 설정 → `/login`으로 로그인
2. **캠퍼스 10개 seed 확인**
   - Admin 메뉴의 **사용자 관리** 화면에서 캠퍼스 드롭다운이 10개 노출되는지 확인
3. **HQ Viewer 초대**
   - `사용자 관리` → 이메일 입력 + 역할 `hq_viewer` 선택 → 초대 메일 발송
4. **캠퍼스 매니저 10명 초대**
   - 각 캠퍼스별로 이메일 입력 + 역할 `campus_manager` + 담당 캠퍼스 선택 → 초대
5. **학생 / 로그 엑셀 업로드**
   - Admin → **업로드** → 학생 스냅샷 업로드 → 로그 파일 업로드
6. **첫 리포트 생성**
   - **리포트** 메뉴 → 스냅샷/로그 선택 → 기간 지정 → "Deca~ / 중등 제외" 체크박스 설정 → 생성
   - 생성된 리포트는 시트 탭(종합/직영 소계/직영 5개/가맹 소계/가맹 5개)으로 즉시 확인, 엑셀 다운로드 가능
   - **My Reports** 메뉴에서 내 다운로드 이력 확인

---

## 8. 문제 해결

| 증상 | 원인 / 해결 |
|---|---|
| 학생 업로드 시 `학생코드 형식 오류` 대량 발생 | 엑셀 `학생코드` 열이 `^CB\d+$`에 맞지 않음. 엑셀 원본에서 `CB` 접두 + 숫자만 유지. |
| 학생 업로드 시 `캠퍼스 매핑 실패` | `소속 센터명` 값에 표준 캠퍼스 키워드(수지/죽전/송도/마곡/이매/김포/운정/영통/식사/동대문)가 포함되어야 함. 예외: `수원` 포함 시 자동으로 `영통`에 매핑. |
| 로그 업로드 시 헤더 인식 실패 | 첫 번째 시트의 1~2행에 `접속일시`, `학생코드`(또는 `학생 ID`) 등 필수 헤더가 있어야 함. 사양은 2행이지만 시스템이 1행도 자동 감지함. |
| 리포트가 `비어 있음`으로 나옴 | 선택한 기간에 해당하는 로그가 없거나, 학생 스냅샷과 로그의 기준일이 어긋남. 스냅샷 `base_date` 재확인. |
| campus_manager가 리포트 조회 시 403/빈 결과 | RLS가 정상 동작 중. `profiles.campus_id`가 본인 담당 캠퍼스로 세팅됐는지 확인. |
| Vercel 배포 후 로그인 리다이렉트 실패 | Supabase `Authentication → URL Configuration`의 Site URL을 배포 도메인으로 갱신했는지 확인. |
| 30개 초과 스냅샷 자동 삭제 동작 확인 | 업로드 API가 `uploaded_at` 오래된 순으로 30개 초과분을 DB + Storage에서 제거. 서버 로그(`/api/uploads/student`)에서 확인. |

---

## 9. 비용 가정

본 시스템은 **12명 / 최근 30개 스냅샷 / 월 수십 건 리포트** 규모를 전제로 모든 프리티어에서 동작합니다.

| 서비스 | 프리 티어 한도 | 본 시스템 예상 사용량 |
|---|---|---|
| Supabase DB | 500 MB | 수십 MB (학생 ~2k × 30 스냅샷 + 로그 수만 행) |
| Supabase Storage | 1 GB | 수백 MB (엑셀 원본 + 리포트 캐시) |
| Supabase Auth | 50,000 MAU | 12 MAU |
| Vercel Hobby | 100 GB 대역폭 / 월, 서버리스 함수 10s 기본 | 리포트 생성은 `maxDuration = 60`으로 설정 (Hobby 허용 한도 내) |

> CANB 로고/파비콘: `app/favicon.ico`, `public/` 디렉토리의 플레이스홀더를 교체하세요.
