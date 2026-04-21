# 결 · 카드뉴스 API (단계 3)

## Base URL
- 로컬 백엔드: `http://localhost:4000`
- **Swagger UI**: `http://localhost:4000/docs` — 대화형 테스트 가능
- 프론트(`:3000`)는 `/api/*`·`/uploads/*`·`/health` 를 백엔드로 rewrite. 브라우저에서 직접 호출할 때만 절대 경로 사용.

## 공통 규약
- 요청/응답 본문: `application/json`, UTF-8
- 모든 검증은 전역 `ValidationPipe` — 필수값 누락·타입/enum 오류는 `400`
- 리소스 미존재는 `404`

### 에러 응답 포맷
```json
{
  "statusCode": 400,
  "message": [
    "title should not be empty",
    "sizePreset must be one of the following values: 1:1, 4:5, 9:16"
  ],
  "error": "Bad Request"
}
```

```json
{ "statusCode": 404, "message": "project not found", "error": "Not Found" }
```

---

## 단계 3 핵심 엔드포인트

### 1) `POST /api/projects` — 프로젝트 생성

**Request DTO** (`CreateProjectDto`)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `title` | string | ✓ | 1~120자 |
| `prompt` | string | | 0~2000자 |
| `sizePreset` | enum | ✓ | `1:1` \| `4:5` \| `9:16` |
| `inputMode` | enum | ✓ | `auto` \| `manual` |
| `brandId` | string | | 유효한 브랜드 CUID |
| `cards` | `ProjectCardDto[]` | | 최대 5개 |

`ProjectCardDto`

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `order` | int | | ≥ 0 (생략 시 배열 인덱스) |
| `title` | string | ✓ | 최대 120자 |
| `body` | string | ✓ | 최대 1000자 |
| `imageUrl` | string | | 업로드된 URL 또는 seed 경로 |
| `layout` | enum | ✓ | `cover` \| `content` \| `cta` |

**Request 예시**
```json
{
  "title": "유순 하루 일과 소개",
  "prompt": "유순 요양원의 따뜻한 하루 — 산책, 식사, 프로그램",
  "sizePreset": "1:1",
  "inputMode": "auto",
  "brandId": "clz1brandcuid",
  "cards": [
    {
      "order": 0,
      "title": "유순 · 오늘도 평안한 하루",
      "body": "가족처럼 곁에서 돌보는 하루를 소개합니다.",
      "imageUrl": "/uploads/seed/yusoon-morning.svg",
      "layout": "cover"
    }
  ]
}
```

**Response `201`**
```json
{
  "project": {
    "id": "clz1projectcuid",
    "brandId": "clz1brandcuid",
    "title": "유순 하루 일과 소개",
    "prompt": "유순 요양원의 따뜻한 하루 — 산책, 식사, 프로그램",
    "sizePreset": "1:1",
    "inputMode": "auto",
    "createdAt": "2026-04-17T12:00:00.000Z",
    "updatedAt": "2026-04-17T12:00:00.000Z",
    "cards": [
      {
        "id": "clz1card00001",
        "projectId": "clz1projectcuid",
        "order": 0,
        "title": "유순 · 오늘도 평안한 하루",
        "body": "가족처럼 곁에서 돌보는 하루를 소개합니다.",
        "imageUrl": "/uploads/seed/yusoon-morning.svg",
        "layout": "cover",
        "createdAt": "2026-04-17T12:00:00.000Z",
        "updatedAt": "2026-04-17T12:00:00.000Z"
      }
    ]
  }
}
```

**curl**
```bash
curl -X POST http://localhost:4000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title":"테스트","sizePreset":"1:1","inputMode":"auto"}'
```

---

### 2) `GET /api/projects/:id` — 프로젝트 상세

**Response `200`**
```json
{
  "project": {
    "id": "clz1projectcuid",
    "title": "유순 하루 일과 소개",
    "sizePreset": "1:1",
    "inputMode": "auto",
    "cards": [ /* order asc */ ],
    "brand": {
      "id": "clz1brandcuid",
      "name": "유순",
      "tone": "따뜻하고 진솔한…",
      "assets": [ { "id": "...", "url": "/uploads/...", "kind": "image" } ]
    }
  }
}
```

**Error `404`** — 존재하지 않는 id

**curl**
```bash
curl http://localhost:4000/api/projects/clz1projectcuid
```

---

### 3) `PUT /api/cards/:id` — 카드 단건 업데이트

**Request DTO** (`UpdateCardDto`) — 모든 필드 선택. 제공된 것만 반영.

| 필드 | 타입 | 제약 |
|---|---|---|
| `title` | string | 최대 120자 |
| `body` | string | 최대 1000자 |
| `imageUrl` | string \| null | `null` 또는 빈 문자열 → 이미지 제거 |
| `layout` | enum | `cover` \| `content` \| `cta` |
| `order` | int | ≥ 0 |

**Request 예시**
```json
{
  "title": "영양 식단",
  "body": "영양사가 함께 설계한 부드럽고 균형 잡힌 식사를 준비합니다.",
  "imageUrl": "/uploads/1700000000-abc123.png",
  "layout": "content",
  "order": 2
}
```

**Response `200`**
```json
{
  "card": {
    "id": "clz1card00002",
    "projectId": "clz1projectcuid",
    "order": 2,
    "title": "영양 식단",
    "body": "영양사가 함께 설계한 부드럽고 균형 잡힌 식사를 준비합니다.",
    "imageUrl": "/uploads/1700000000-abc123.png",
    "layout": "content",
    "createdAt": "2026-04-17T12:00:00.000Z",
    "updatedAt": "2026-04-17T12:05:00.000Z"
  }
}
```

**curl**
```bash
curl -X PUT http://localhost:4000/api/cards/clz1card00002 \
  -H "Content-Type: application/json" \
  -d '{"title":"수정","layout":"content"}'
```

---

### 4) `POST /api/generate/cards` — 카드 자동 생성 (**단계 4: 입력 모드 2개 · 출력 4필드 고정**)

**Request DTO** (`GenerateCardsDto`) — `mode` 에 따라 필수 필드가 분기됩니다.

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `mode` | enum | ✓ | `auto` \| `manual` |
| `prompt` | string | mode=auto | 1~2000자 |
| `count` | int | mode=auto | 1~5 |
| `cards` | `ManualCardInputDto[]` | mode=manual | 1~5개 |
| `brandId` | string | | 양 모드 공통, 유효 브랜드 CUID |

`ManualCardInputDto` — 각 필드 모두 선택. 비워두면 브랜드·레이아웃 기반 기본값으로 채워집니다.

| 필드 | 타입 | 제약 |
|---|---|---|
| `title` | string | 최대 120자 |
| `body` | string | 최대 1000자 |
| `subtext` | string | 최대 200자 |
| `cta` | string | 최대 60자 |
| `imageUrl` | string | |
| `layout` | enum | `cover` \| `content` \| `cta` (생략 시 카드 순서로 자동) |

**Auto Request 예시**
```json
{
  "mode": "auto",
  "prompt": "유순 임산부와 유아를 위한 케어 서비스 안내",
  "count": 5,
  "brandId": "clz1brandcuid"
}
```

**Manual Request 예시**
```json
{
  "mode": "manual",
  "brandId": "clz1brandcuid",
  "cards": [
    { "title": "오늘의 메뉴" },
    { "title": "아침",  "body": "현미죽과 계절 과일" },
    { "title": "점심",  "body": "고등어 구이 + 시금치나물" },
    { "title": "간식",  "body": "따뜻한 유자차와 약과" },
    { }
  ]
}
```

**Response `200`** — DB 저장 없이 결과만 반환. **출력 카드마다 5개 텍스트 필드 고정**.
```json
{
  "cards": [
    {
      "id": "abc12345",
      "title": "유순 · 유순 임산부와 유아를 위한 케어…",
      "body": "유순 임산부와 유아를 위한 케어 서비스 안내",
      "subtext": "유순 · 임산부·가족 케어",
      "cta": "자세히 보기 →",
      "layout": "cover",
      "imageUrl": "/uploads/seed/yusoon-morning.svg"
    },
    {
      "id": "def67890",
      "title": "체계적인 건강 관리",
      "body": "주차별 건강 상태를 함께 살피며 작은 변화도 세심하게 기록합니다.",
      "subtext": "정기 상담",
      "cta": "2 / 5",
      "layout": "content",
      "imageUrl": "/uploads/seed/yusoon-meal.svg"
    },
    {
      "id": "ghi11223",
      "title": "오늘도 평안한 하루",
      "body": "임산부와 가족을 위한 맞춤 케어를 더 자세히 안내해 드립니다.",
      "subtext": "유순 드림",
      "cta": "상담 예약 →",
      "layout": "cta"
    }
  ]
}
```

**동작**
- `mode=auto`: 프롬프트의 키워드(`임산부` / `유아` / `시니어` / 기본)로 **콘텐츠 프레임**을 매칭 → 동일 입력 ↔ 동일 구조 보장
- `mode=manual`: 사용자 입력 + 비어있는 필드를 브랜드·레이아웃 기반 기본값으로 보강
- `OPENAI_API_KEY` 설정 시 `gpt-4o-mini` 호출 (실패 시 템플릿 폴백) — 없으면 곧바로 템플릿
- 양 모드 모두 `sanitize.ts` 로 과장/의학적 단정 표현 자동 완화 (13개 규칙)
- `brandId` 지정 시 브랜드 이미지 에셋이 카드에 순환 배정 (CTA 카드 제외)
- 첫 카드는 `cover`, 마지막은 `cta`, 가운데는 `content` (명시 시 그대로 사용)

**curl**
```bash
# auto
curl -X POST http://localhost:4000/api/generate/cards \
  -H "Content-Type: application/json" \
  -d '{"mode":"auto","prompt":"유순 임산부/유아 5장","count":5}'

# manual
curl -X POST http://localhost:4000/api/generate/cards \
  -H "Content-Type: application/json" \
  -d '{"mode":"manual","cards":[{"title":"오늘 메뉴"},{"title":"아침"},{"title":"점심"},{"title":"간식"},{}]}'
```

상세 샘플 출력은 [`SAMPLES.md`](./SAMPLES.md).

---

## 실패 케이스 매트릭스

| 요청 | 응답 |
|---|---|
| `POST /api/projects` body `{}` | `400` — title·sizePreset·inputMode 누락 |
| `POST /api/projects` `sizePreset:"2:1"` | `400` — enum 불일치 |
| `POST /api/projects` `cards` 6개 이상 | `400` — ArrayMaxSize |
| `GET  /api/projects/:id` 잘못된 id | `404` — `project not found` |
| `PUT  /api/cards/:id` `{"layout":"bogus"}` | `400` — enum 불일치 |
| `PUT  /api/cards/:id` 잘못된 id | `404` — `card not found` |
| `POST /api/generate/cards` `{"mode":"auto","count":10}` | `400` — Max(5) 위반 |
| `POST /api/generate/cards` `{"mode":"auto"}` | `400` — prompt·count 누락 |
| `POST /api/generate/cards` `{"mode":"manual"}` | `400` — cards 누락 |
| `POST /api/generate/cards` `{"mode":"bogus",...}` | `400` — mode enum 불일치 |

---

## 기타 기 구현 엔드포인트

| Method | Path | 요약 |
|---|---|---|
| GET | `/health` | 서버/DB 상태 |
| GET · POST | `/api/brands` | 브랜드 목록·생성 |
| GET · PATCH · DELETE | `/api/brands/:id` | 브랜드 상세·수정·삭제 |
| GET | `/api/projects` | 프로젝트 목록 |
| PATCH | `/api/projects/:id` | 프로젝트 업데이트 (cards 전달 시 전체 교체) |
| DELETE | `/api/projects/:id` | 프로젝트 삭제 (카드 cascade) |
| POST | `/api/upload` | 이미지 업로드 (`multipart/form-data`, 필드명 `file`) |
| GET | `/api/backgrounds` | **단계 5** 기본 배경 템플릿 5종 목록 |

---

## `GET /api/backgrounds` — 기본 배경 카탈로그 (단계 5)

이미지가 없는 카드에 자동 할당되는 5장의 SVG 기본 배경. 프론트 스와치 피커가 이 응답을 그대로 사용.

**Response 200**
```json
{
  "backgrounds": [
    { "key": "morning", "label": "아침 · 따뜻한 초록",   "url": "/uploads/defaults/bg-morning.svg", "palette": ["#d9e4bc","#6b8e4e"], "tags": ["시니어","산책","자연","morning"] },
    { "key": "meal",    "label": "식사 · 따뜻한 베이지", "url": "/uploads/defaults/bg-meal.svg",    "palette": ["#f5e3c2","#d9a66e"], "tags": ["식사","음식","영양","meal"] },
    { "key": "program", "label": "활동 · 부드러운 보라", "url": "/uploads/defaults/bg-program.svg", "palette": ["#e8dceb","#7d6b8e"], "tags": ["프로그램","활동","놀이","program"] },
    { "key": "care",    "label": "케어 · 따뜻한 살구",   "url": "/uploads/defaults/bg-care.svg",    "palette": ["#fde5d4","#e8a888"], "tags": ["임산부","영유아","케어","care"] },
    { "key": "calm",    "label": "차분 · 잔잔한 하늘",   "url": "/uploads/defaults/bg-calm.svg",    "palette": ["#eaf0f5","#8ea3c0"], "tags": ["기본","마무리","cta","calm"] }
  ]
}
```

### 이미지 할당 우선순위 (생성 엔진)
1. 수동 입력 `imageUrl` (manual 모드) / GPT 응답 — 최우선
2. 브랜드 에셋 (`brandId` 지정 시 순환 배정)
3. **프레임 기본 배경** — 빈 페이지 방지용 최종 폴백
   - 임산부 프레임 → cover/content 4장/cta 가 `care`·`calm`·`meal`·`calm`·`care`·`calm` 로 배정
   - 영유아 프레임 → `care`·`calm`·`program`·`meal`·`care`·`calm`
   - 시니어 프레임 → `morning`·`morning`·`meal`·`program`·`care`·`calm`
   - 기본 프레임   → `calm`·`morning`·`meal`·`program`·`care`·`calm`

카드별 단건 교체는 `PUT /api/cards/:id` 의 `imageUrl` 필드로 가능 (위 URL 중 하나를 보내거나 업로드한 URL 사용).

Swagger UI (`/docs`) 에서 위 전체 경로를 태그별로 확인·테스트할 수 있습니다.

---

## `POST /api/reels` — 9:16 MP4 릴스 생성 (단계 10)

카드 프레임을 PNG base64 로 받아 ffmpeg xfade 로 MP4 를 만들어 `/uploads/reels/` 에 저장하고 URL 반환.

**Request DTO** (`GenerateReelDto`)

| 필드 | 타입 | 필수 | 제약 |
|---|---|---|---|
| `frames` | string[] | ✓ | 2~10개 (base64 이미지 또는 `data:image/*;base64,...`) |
| `transition` | enum | ✓ | `fade` · `slide` · `zoom` |
| `durationPerCard` | number | ✓ | 1.5 ~ 6 (초) |
| `brandName` | string | | 파일명 앞부분, 미지정 시 "결" |

**요청 예시** (요약)
```json
{
  "frames": ["data:image/png;base64,iVBORw0KGgo...", "data:image/png;base64,..."],
  "transition": "fade",
  "durationPerCard": 3,
  "brandName": "유순"
}
```

**Response 200**
```json
{
  "url": "/uploads/reels/유순_20260420_reel_a4b9.mp4",
  "filename": "유순_20260420_reel_a4b9.mp4",
  "duration": 13,
  "width": 1080,
  "height": 1920
}
```

**동작**
- 각 프레임을 tmp PNG 로 저장 → 각 입력을 `-loop 1 -t {duration}` 비디오 스트림으로 취급
- `scale=1080:1920:force_original_aspect_ratio=decrease, pad=1080:1920` 로 9:16 letterbox 강제
- `xfade=transition={name}:duration=0.5:offset={누적}` 체인 (N-1회)
- 인코딩: `libx264`, preset `veryfast`, `yuv420p`, 30fps, `+faststart`
- 총 재생 시간 = `N × durationPerCard − (N−1) × 0.5s`

**에러**
- 400 — frames 개수/타입/enum/범위 위반
- 500 — ffmpeg 실행 실패 (stderr tail 포함)

**전환 효과 매핑**
| API | xfade 필터명 | 설명 |
|---|---|---|
| `fade` | `fade` | 기본 크로스페이드 |
| `slide` | `slideleft` | 좌측 슬라이드 |
| `zoom` | `zoomin` | 줌 인 효과 |

**제약 / 미구현 (MVP)**
- 오디오 없음 (무음 MP4) — 추후 BGM 입력 추가 여지
- 자막 없음 — 추후 `subtitles` 필터 또는 drawtext 로 추가 가능
