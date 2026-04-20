# 결 (Gyeol) · 카드뉴스 MVP

브랜드 톤앤매너에 맞춘 카드뉴스(1~5장)를 자동 생성 · 편집 · 다운로드하는 MVP.

## 디렉터리 구조

```
├── frontend/   Next.js 14 (UI, 편집기, PNG/ZIP 내보내기)
├── backend/    NestJS 10 + Prisma + SQLite (API, DB, 업로드)
└── package.json (concurrently 런처)
```

## 빠른 시작

```bash
# 1) 루트·프론트·백엔드 의존성 설치 + DB 초기화 + 유순 seed
npm install
npm run setup

# 2) 동시 실행 (backend :4000, frontend :3000)
npm run dev
#  → http://localhost:3000  (앱)
#  → http://localhost:4000/health  (헬스체크)
```

개별 실행이 필요할 때:

```bash
npm run dev:backend     # NestJS 4000
npm run dev:frontend    # Next.js 3000
npm run db:push         # Prisma 스키마 동기화
npm run db:seed         # 유순 샘플 데이터 투입
```

## 단계 1 완료 기준 체크

- [x] `frontend/`, `backend/` 분리된 폴더 구조
- [x] 각 서브 프로젝트에서 `npm run dev` 동작
- [x] `GET /health` (backend :4000) — DB 연결 상태 포함

## 단계 2 완료 기준 체크

- [x] `brand_profiles`, `brand_assets`, `projects`, `cards` 테이블
- [x] `backend/prisma/schema.prisma` 마이그레이션 소스
- [x] `backend/prisma/seed.ts` — 유순 브랜드 + 샘플 프로젝트 5카드
- [x] 이미지 저장 정책: 기본 **로컬** (`backend/public/uploads/`), S3 전환 지점은 `backend/src/upload` 한 곳

## 단계 3 완료 기준 체크

- [x] `POST /api/projects` — 프로젝트 생성 (DTO 검증)
- [x] `GET  /api/projects/:id` — 상세 (카드·브랜드 포함)
- [x] `PUT  /api/cards/:id` — 카드 단건 업데이트
- [x] `POST /api/generate/cards` — 카드 자동 생성 (GPT 또는 템플릿 폴백)
- [x] Swagger UI — `http://localhost:4000/docs`
- [x] 필수값 누락·enum 불일치·범위 위반 시 `400`, 미존재 id는 `404`
- [x] DTO/응답 스펙 문서 — [`API.md`](./API.md)

## 단계 4 완료 기준 체크 (텍스트 생성 엔진)

- [x] **입력 모드 2개** — `mode: "auto"`(프롬프트 + count) / `mode: "manual"`(카드별 입력)
- [x] **출력 JSON 고정** — 카드마다 `{ title, body, subtext, cta, layout, imageUrl, id }`
- [x] **안전 가드 확장** — `sanitize.ts` 13개 규칙(의학 10 + 과장 5), 양 모드 공통 적용
- [x] **콘텐츠 프레임** — 임산부·영유아·시니어 키워드 자동 매칭으로 "유순 임산부/유아 5장" 등에서 재현성 있는 구조
- [x] **카드별 수정 구조 유지** — title·body·subtext·cta·이미지 인라인 편집
- [x] **샘플 출력 문서** — [`SAMPLES.md`](./SAMPLES.md) 에 임산부·영유아·시니어 3개 프롬프트 결과 수록

> **주의**: 단계 4 는 DB `cards` 테이블에 `subtext`·`cta` 컬럼을 추가합니다. 기존 DB 가 있다면 `npm run db:push` 로 스키마 동기화 후 `npm run db:seed` 를 다시 실행하세요.

## 단계 5 완료 기준 체크 (이미지 슬롯)

- [x] **우선순위 기반 이미지 할당** — 사용자 업로드/GPT → 브랜드 에셋 → 프레임 기본 배경
- [x] **기본 배경 5종** — `backend/public/uploads/defaults/bg-{morning,meal,program,care,calm}.svg` (1080×1080 SVG)
- [x] **빈 페이지 방지** — 브랜드도 이미지도 없는 상태에서 `POST /api/generate/cards` 호출 시 모든 카드에 기본 배경이 자동 삽입됨
- [x] **배경 카탈로그 API** — `GET /api/backgrounds` 응답을 그대로 프론트 스와치 피커에 렌더
- [x] **이미지 교체 UI** — 파일 업로드·제거·기본 배경 5종 스와치 모두 각 카드 편집 영역에서 1클릭

## 단계 6 완료 기준 체크 (편집기 UI)

- [x] **카드 리스트 / 현재 카드 선택** — 상단 썸네일 스트립(sticky), 선택 시 teal 링 + 해당 카드로 스크롤
- [x] **텍스트 인라인 편집** — title / body / subtext / cta 입력 시 프리뷰 즉시 반영 (React state 단일 출처)
- [x] **이미지 교체** — 파일 업로드 · 이미지 제거 · 기본 배경 스와치 5색 모두 카드 편집 영역에서 1클릭
- [x] **사이즈 프리셋 전환** — 1:1 / 4:5 / 9:16 3버튼 토글, 전환 시 모든 카드 프리뷰가 즉시 새 비율로 리렌더
- [x] **카드 추가 / 삭제 / 순서 이동** — 썸네일 strip 및 그리드 끝의 ＋ 버튼(최대 5장), 각 카드 헤더에 ↑ ↓ 삭제 버튼
- [x] **레이아웃 변경** — 카드 헤더의 cover/content/cta 드롭다운으로 개별 카드 레이아웃 직접 지정

## 단계 7 완료 기준 체크 (내보내기)

- [x] **카드별 PNG 렌더링** — 각 카드 `PNG 다운로드` 버튼 (html-to-image, pixelRatio 기반 업스케일)
- [x] **일괄 ZIP 다운로드** — 좌측 패널 `전체 ZIP 다운로드` 버튼 (jszip, 5장까지 한 파일)
- [x] **파일명 규칙** — `{브랜드명}_{YYYYMMDD}_{NN}.png` / `{브랜드명}_{YYYYMMDD}.zip` (브랜드 미선택 시 `결` 사용)
- [x] **해상도 정확성** — 1:1 = 1080×1080, 4:5 = 1080×1350, 9:16 = 1080×1920 (±1px rounding)
- [x] **내보내기 상태 UI** — ZIP 버튼 disabled + "내보내는 중…" 표시 + 파일명·해상도 미리보기
- [x] **파일명 안전성** — Windows/macOS 에서 부적절한 `\ / : * ? " < > |` 및 공백은 자동 제거

### 파일명 예시

브랜드 "유순", 2026-04-17, 카드 5장:
- PNG: `유순_20260417_01.png`, `유순_20260417_02.png`, …, `유순_20260417_05.png`
- ZIP: `유순_20260417.zip` (내부 파일명도 동일 규칙)

브랜드 미선택 시:
- PNG: `결_20260417_01.png`
- ZIP: `결_20260417.zip`

## 단계 9 완료 기준 체크 (QA / 안정화)

- [x] **E2E 시나리오 10개** — `scripts/e2e.mjs` 로 실행 가능 (`npm run e2e`)
- [x] **핵심 흐름 통과율** — `10 / 10 PASS · 100%` (요구 90%+ 충족)
- [x] **치명 오류 0건** — 생성·저장 불가 없음 (모든 시나리오 완료)
- [x] **에러 로깅/재시도** — OpenAI 호출 실패 시 Nest Logger 로 경고 남기고 템플릿 폴백으로 자동 재시도
- [x] **검증 파이프** — 필수값 누락·enum 불일치 → 400, 미존재 id → 404

### E2E 시나리오

| # | 시나리오 | 검증 |
|---|---|---|
| S1 | 프롬프트 자동 생성 | 5장 · 5 필드 고정 · cover/cta · 주제 키워드 반영 |
| S2 | 수동 입력 생성 | 빈 필드 자동 보강 · 입력값 보존 · 이미지 채워짐 |
| S3 | 이미지 없음 케이스 | `/uploads/defaults/*` 기본 배경 폴백 |
| S4 | 사이즈 프리셋 왕복 | 1:1 · 4:5 · 9:16 DB 왕복 |
| S5 | PNG 렌더 필드 완전성 | 모든 카드 7개 필드 + 배경 카탈로그 API |
| S6 | 에러 — 필수값 누락 | 400 + 상세 메시지 배열 |
| S7 | 에러 — 존재하지 않는 id | 404 |
| S8 | 안전 가드 | 완치/100%/부작용없음/기적 자동 완화 |
| S9 | DB 왕복 | 프로젝트·카드 CRUD + `PUT /api/cards/:id` |
| S10 | 헬스체크 | status·db·uptime |

### 실행

```bash
# 백엔드를 먼저 기동해야 함 (다른 터미널)
npm run dev:backend

# E2E 실행
npm run e2e
#  → 10건 PASS, 0 FAIL, 100.0%
```

OpenAI 키가 설정돼 있으면 S1·S3·S5 는 GPT 응답 경로를 실제로 타고(수초 소요), 없으면 템플릿 폴백으로 즉시 완료됩니다.

## 단계 10 완료 기준 체크 (릴스 MP4)

- [x] **9:16 MP4 자동 생성** — 카드 프레임(PNG base64) → ffmpeg xfade → 1080×1920 MP4
- [x] **전환 효과 3종** — 페이드(`fade`) · 슬라이드(`slideleft`) · 줌(`zoomin`) — xfade built-in 필터 직접 사용
- [x] **10~20초 자동** — 5장 × 3초 − 4 × 0.5초 = **13초** (기본), 카드당 2~5초 슬라이더로 조정 가능
- [x] **카드 수정 후 재생성** — 프론트가 매 호출 시 html-to-image 로 최신 DOM 프레임을 새로 렌더 → ffmpeg 재빌드
- [x] **9:16 자동 전환** — 현재 프리뷰가 1:1/4:5 이어도 `flushSync` + 더블 rAF 로 9:16 임시 전환 후 렌더, 완료 시 원래 사이즈 복귀
- [x] **파일명 규칙 적용** — `{브랜드명}_{YYYYMMDD}_reel_{suffix}.mp4`
- [x] **번들 ffmpeg** — `@ffmpeg-installer/ffmpeg` 로 플랫폼별 바이너리 자동 설치 (시스템 ffmpeg 불필요)
- [ ] **BGM/자막 옵션** — MVP 범위 제외, 엔드포인트 확장 여지 있음 (추후 `-i bgm.mp3 -c:a aac` 및 `-vf subtitles=...`)

### 흐름

1. 프론트에서 카드 생성/편집
2. 좌측 패널의 **🎬 릴스 MP4 내보내기** 클릭
3. 필요 시 프리뷰 사이즈 9:16 으로 자동 전환 → 각 카드를 1080×1920 PNG 로 렌더 → base64 POST
4. 서버 ffmpeg 가 xfade 체인 빌드 (`scale→pad→setsar` 으로 9:16 정규화 후 체이닝)
5. `/uploads/reels/{브랜드}_{날짜}_reel_{xxx}.mp4` 반환 → 자동 다운로드 + 인라인 비디오 미리보기

### ffmpeg 체인 예시 (5장, fade, 3s)

```
ffmpeg -loop 1 -t 3 -i f0.png … -loop 1 -t 3 -i f4.png \
  -filter_complex "
    [0]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[s0];
    [1]scale=1080:1920:…[s1]; … [s4];
    [s0][s1]xfade=transition=fade:duration=0.5:offset=2.5[v1];
    [v1][s2]xfade=transition=fade:duration=0.5:offset=5[v2];
    [v2][s3]xfade=transition=fade:duration=0.5:offset=7.5[v3];
    [v3][s4]xfade=transition=fade:duration=0.5:offset=10[vout]
  " -map [vout] -c:v libx264 -preset veryfast -pix_fmt yuv420p -r 30 -movflags +faststart output.mp4
```

## API 요약

| Method | Path | 용도 |
|---|---|---|
| GET | `/health` | 서버/DB 헬스체크 |
| GET·POST | `/api/brands` | 브랜드 목록·생성 |
| GET·PATCH·DELETE | `/api/brands/:id` | 브랜드 상세·수정·삭제 |
| GET·POST | `/api/projects` | 카드 프로젝트 목록·**생성(단계 3)** |
| GET·PATCH·DELETE | `/api/projects/:id` | **상세(단계 3)**·수정·삭제(카드 포함) |
| PUT | `/api/cards/:id` | **카드 단건 업데이트(단계 3)** |
| POST | `/api/generate/cards` | **프롬프트 → 카드 자동 생성(단계 3)** |
| POST | `/api/upload` | 이미지 업로드 (`multipart/form-data`) |

전체 DTO·예시 요청/응답·에러 케이스는 [`API.md`](./API.md) 와 Swagger UI (`/docs`) 에서 확인하세요. 프론트엔드는 `next.config.mjs` 의 rewrite 로 `/api/*`·`/uploads/*`·`/health` 를 backend(:4000)에 프록시합니다.

## 이미지 저장 정책

- **MVP: 로컬 디스크** — `backend/public/uploads/` 에 저장, `GET /uploads/<file>` 로 서빙.
- **S3 호환 전환**: `backend/src/upload/upload.controller.ts` 의 `diskStorage` 를 S3 SDK(또는 R2) 드라이버로 교체하면 됨. 모델(`brand_assets.url`, `cards.imageUrl`)은 URL 문자열이므로 스키마 변경 불필요.
