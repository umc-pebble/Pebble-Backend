# Pebble Backend

> 할 일은 가볍게, 마감은 확실하게. 맥락을 설계하는 계층형 여정 관리 시스템 **Pebble**의 Node.js 백엔드.

---

## 📢 프로젝트 소개 (Project Overview)

Pebble(페블)은 `Category → Milestone → Task`의 3단계 계층 구조를 통해 사용자가 지금 하는 일이 어떤 상위 목표를 위한 과정인지 한눈에 조망하고, 중요 데드라인을 놓치지 않으며 다음 행동을 자연스럽게 이어나갈 수 있도록 돕는 서비스입니다.

본 레포지토리는 Pebble의 **REST API 서버**입니다. 인증, 일정 관리, 팔로우, 징검다리(활동 기록), 리포트 등 모든 핵심 비즈니스 로직을 담당합니다.

---

## 👥 팀원 및 백엔드 역할 분담 (Team & Roles)

| 이름 | 역할 및 담당 도메인 | Github |
|---|---|---|
| 언년 / 하은현 | • 백엔드 팀장<br>• 레포 초기 셋팅, 구조 설계 | [@gkdmsgus](https://github.com/gkdmsgus) |
| 지헨 / 한동혁 | • (추후 회의를 통해 담당 도메인 확정) | [@Asterisk0707](https://github.com/Asterisk0707) |
| 도요 / 장문선 | • (추후 회의를 통해 담당 도메인 확정) | [@munwalk](https://github.com/munwalk) |
| 비비 / 김서연 | • (추후 회의를 통해 담당 도메인 확정) | [@seozzik](https://github.com/seozzik) |
| 준 / 박서연 | • (추후 회의를 통해 담당 도메인 확정) | [@Park-seoyun](https://github.com/Park-seoyun) |
| 하갱 / 김하경 | • (추후 회의를 통해 담당 도메인 확정) | [@Hagyeong13](https://github.com/Hagyeong13) |

---

## 📡 API 도메인 목록

| 도메인 | 경로 | 주요 기능 |
|---|---|---|
| Auth | `/api/v1/auth` | 자체 로그인/회원가입, 구글·네이버 소셜 로그인, 토큰 재발급 |
| User | `/api/v1/users` | 프로필 조회·수정, 프로필 이미지 업로드, 회원탈퇴 |
| Category | `/api/v1/categories` | 카테고리 CRUD, 공유 카테고리 관리 |
| Milestone | `/api/v1/milestones` | 마일스톤 CRUD, 정렬 |
| Task | `/api/v1/tasks` | 태스크 CRUD, 완료 처리, 정렬 |
| Follow | `/api/v1/follows` | 팔로우 요청·수락·거절, 목록 조회 |
| Activity | `/api/v1/activity` | 징검다리(활동 기록) 조회 |
| Notification | `/api/v1/notifications` | 알림 목록 조회·삭제, 읽음 처리 |
| Report | `/api/v1/reports` | 월말 리포트 조회·다운로드 |
| Subscription | `/api/v1/subscriptions` | 구독 상태·결제 내역 조회 |

---

## 📔 Tech Stack

| 분류 | 기술 | 비고 |
|---|---|---|
| Runtime | Node.js 20+ | LTS 버전 사용 |
| Framework | Express | REST API 서버 |
| Language | TypeScript | 엄격 타입 적용 |
| ORM | Prisma | MySQL 연동, 타입 자동 생성 |
| Database | MySQL 8.0 | 관계형 DB |
| Storage | Supabase Storage | 프로필 이미지, 리포트 GIF |
| Auth | JWT + OAuth2 | Google, Naver 소셜 로그인 |
| Validation | zod | 요청 바디·쿼리 검증 |
| Quality | ESLint, Prettier | 코드 품질 및 포맷팅 |

---

## ⚙️ Prerequisites (사전 요구 사항)

- **Node.js**: v20.x (LTS) 이상
- **npm**: v10.x 이상
- **MySQL**: 8.0 이상

> Tip: 팀원 간 노드 버전을 통일하기 위해 **NVM** 사용을 권장합니다. `nvm use 20` 명령어로 버전을 맞춰주세요.

---

## 🚀 Getting Started (설치 및 실행)

### 1. 프로젝트 클론

```bash
git clone git@github.com:umc-pebble/Pebble-Backend.git
cd Pebble-Backend
```

### 2. 패키지 설치

```bash
npm install
```

### 3. 환경변수 설정 (.env)

```bash
cp .env.example .env
# .env 파일에 값 입력
```

### 4. DB 마이그레이션

```bash
npx prisma migrate dev
```

### 5. 개발 서버 실행

```bash
npm run dev
```

`http://localhost:3000`으로 서버가 실행됩니다.

---

## 📂 Project Structure (폴더 구조)

기능(Feature) 중심 아키텍처를 채택했습니다.

```
src/
├── auth/                  # 도메인 폴더 (기능별)
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.repository.ts
│   └── auth.route.ts
├── user/
├── category/
├── milestone/
├── task/
├── follow/
├── notification/
├── subscription/
├── report/
├── config/               # 환경변수, DB 연결, 외부 서비스 설정
├── middlewares/          # 인증(JWT), 에러 핸들링
├── utils/                # 공통 유틸 함수
└── app.ts
```

**개발 원칙**

- Controller는 req/res만, Service는 비즈니스 로직만, Repository는 DB 쿼리만 담당합니다.
- Controller에 DB 쿼리 직접 작성 금지 — 반드시 Repository를 경유합니다.

---

## 🛠️ 스크립트

```bash
npm run dev          # 개발 서버 실행 (ts-node-dev, 핫 리로드)
npm run build        # TypeScript 컴파일
npm start            # 프로덕션 서버 실행
npm run lint         # ESLint 검사
npm run type-check   # TypeScript 타입 검사
```

---

## 🤝 Contribution Guide (협업 규칙)

### 1. Git Flow 및 브랜치 전략

```
main (배포용) → dev → feat/#이슈번호
```

| 타입 | 설명 | 예시 |
|---|---|---|
| feat | 새로운 기능 추가 | `feat/#5` |
| fix | 버그 수정 | `fix/#12` |
| refactor | 리팩토링 | `refactor/#8` |
| docs | 문서 수정 | `docs/#3` |
| chore | 패키지·빌드 설정 변경 | `chore/#1` |

- PR은 **`dev`로만** 머지, `main`은 팀장만 머지합니다.
- 팀장 승인 없이 강제 머지는 금지합니다.

### 2. Commit Convention

```
feat(user): 네이버 로그인 추가
fix(auth): 토큰 만료 예외 처리 수정
refactor(task): 완료 처리 로직 분리
```

### 3. Code Quality (PR 전 필수 확인)

```bash
npm run type-check && npm run lint
```

---

## 🚀 PR 컨벤션 (Pull Request Convention)

### 1. PR 제목 규칙

형식: `태그: 작업 내용 요약 (#이슈번호)`

예시: `feat: 네이버 소셜 로그인 구현 (#5)`

### 2. PR 본문 작성 규칙

- **개요**: 핵심 작업 내용 2~3줄 요약
- **주요 변경 사항**: 도메인별 세부 구현 내역
- **테스트 결과**: API 테스트 스크린샷 첨부 (필수)
- **관련 이슈**: `Closes #이슈번호`

### 3. 코드 리뷰 규칙 (P-Rule)

| 태그 | 의미 |
|---|---|
| [P1] 필수 | 버그, 보안 취약점, 아키텍처 규칙 위반 — 반드시 수정 후 Merge |
| [P2] 권장 | 더 나은 구현 방법 제안 — 합당한 이유가 있다면 유지 가능 |
| [P3] 의견 | 가벼운 제안, 칭찬 등 |

### 4. 머지(Merge) 조건

- 팀원 중 **최소 1명 이상의 Approve**를 받아야 합니다.
- `npm run type-check && npm run lint`를 로컬에서 통과해야 합니다.
- **API 테스트 스크린샷**이 PR 본문에 첨부되어야 합니다.
- 모든 피드백 반영 후, PR을 올린 본인이 직접 Merge합니다.

---

## 🔗 링크

- [ERD](https://app.notion.com/p/38a643b12bce8197adabf0c1d6ff7a50)
- [코드 컨벤션](https://app.notion.com/p/38b643b12bce81f1b970ccd62b67f968)
- API 문서 — 준비 중

---

## ⚠️ Troubleshooting

**Q. `npx prisma migrate dev` 실행 시 DB 연결 오류가 나요.**

`.env`의 `DATABASE_URL`을 확인해 주세요. MySQL이 실행 중인지, 유저명·비밀번호·DB명이 정확한지 점검하세요.

```bash
mysql -u root -p -e "SHOW DATABASES;"
```

**Q. `npm install` 시 의존성 충돌 에러(ERESOLVE)가 발생해요.**

`node -v`로 v20 이상인지 확인 후 아래를 시도해 주세요.

```bash
npm cache clean --force
npm install --legacy-peer-deps
```

**Q. import한 모듈을 찾을 수 없다는 에러가 나요.**

VS Code에서 `Ctrl+Shift+P → TypeScript: Restart TS server`를 실행해 주세요.
