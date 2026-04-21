# 프로덕션 운영 — Railway 설정

## 1. Volume 마운트 (업로드 파일 영속화)

Railway 컨테이너 파일시스템은 재배포 시 초기화되므로, 사용자 업로드 이미지가 사라지지 않도록 **Volume** 을 반드시 마운트해야 합니다.

### 설정 순서 (대시보드)

1. Railway 프로젝트 → **backend** 서비스 클릭
2. 상단 탭 **Settings** → 스크롤 내려 **Volumes**
3. **+ Add Volume** 클릭
4. 필드 입력:
   - **Name**: `uploads`
   - **Mount path**: `/app/public/uploads`
   - **Size**: `10 GB` (초기 · 필요 시 확장)
5. **Create** → 서비스 자동 재배포
6. 확인: 서비스 로그에 `Volume 'uploads' mounted at /app/public/uploads` 표시

### 코드 변경 불필요

`backend/src/main.ts` 와 업로드 저장 경로가 이미 `process.cwd()/public/uploads` 를 사용 —  Railway 가 WORKDIR `/app` 이므로 `/app/public/uploads` 와 정확히 일치합니다.

### 기존 파일 이관

Volume 생성 **이전** 에 업로드된 파일(기본 배경 SVG, 시드 이미지 등)은 컨테이너 이미지에 포함된 것이므로 새 Volume 에는 없습니다.

- **기본 배경 5종** (`bg-morning.svg` 등): git 에 있어 이미지 빌드 시 자동 복사됨
- **seed 이미지**: `backend/public/uploads/seed/*.svg` 도 동일
- **사용자 업로드 기존분**: Volume 전환 직후에는 사라짐 (볼륨 마운트가 디렉터리를 덮어씀)

> 운영 중 전환 시에는 `railway run` 으로 컨테이너 접속해 `cp -r /app/public/uploads/* /mnt/uploads/` 같은 수동 마이그레이션 필요. 현재는 사용자 업로드가 테스트 수준이라 바로 전환해도 실질 손실 없음.

### 확인 방법

Volume 마운트 후 이미지 업로드 → 서비스 재배포 트리거 (예: 더미 커밋) → 업로드 URL 재접속 시 여전히 200.

---

## 2. Rate Limit (구현 완료)

`@nestjs/throttler` v6 로 IP 기반 제한을 적용. 다중 버킷 구조:

| 버킷 | 창 | 기본 한도 |
|---|---|---|
| short | 1초 | 10회 |
| medium | 1분 | 60회 |
| long | 1시간 | 500회 |

### 엔드포인트별 override

| Path | Method | 분당 | 시간당 | 이유 |
|---|---|---|---|---|
| `/api/images/generate` | POST | 3 | 30 | Gemini Image ~$0.04/회 |
| `/api/images/edit` | POST | 3 | 30 | 〃 |
| `/api/knowledge/recommend-ideas` | POST | 5 | 50 | Gemini 긴 프롬프트 |
| `/api/generate/cards-from-note` | POST | 5 | 30 | 텍스트+이미지 다중 호출 가능 |
| `/api/generate/cards` | POST | 10 | 100 | 텍스트 카피만 |
| 그 외 | — | 60 | 500 | 기본 버킷 |

### 초과 시 응답

HTTP `429 Too Many Requests` + `Retry-After` 헤더. 프런트는 에러 메시지에 반영.

### Railway Proxy 주의사항

Railway 기본 프록시는 `X-Forwarded-For` 를 잘 전달하므로 `@Ip()` 는 클라이언트 실제 IP 를 반환. 다만 동일 이동통신 NAT 뒤 여러 유저가 같은 IP 로 묶일 수 있어 **IP 만으로는 부족** → 다음 단계(인증 도입)에서 `userId` 기반 제한으로 전환 권장.

---

## 3. 환경 변수 체크리스트

backend 서비스 **Variables** 탭에 아래 항목 설정 확인:

| Key | 필수 | 비고 |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres 서비스에서 참조 (+ Add Reference) |
| `GEMINI_API_KEY` | ✅ | 텍스트·이미지 LLM |
| `OPENAI_API_KEY` | ⚪ 선택 | 설정 시 Gemini 대신 OpenAI 사용 (레거시) |
| `STORAGE_DRIVER` | ⚪ | `local` 만 현재 지원 |
| `PORT` | Railway 자동 | — |

---

## 4. Gemini 비용 한도 (Google Cloud Console)

1. https://console.cloud.google.com/billing → 프로젝트 선택
2. **Budgets & alerts** → **+ CREATE BUDGET**
3. Budget amount: 초기엔 **월 $50** 권장
4. Alert thresholds: 50% / 90% / 100% 이메일
5. Generative Language API 사용량 모니터링: **APIs & Services → Dashboard → Generative Language API**

---

## 5. 비용 산출 (참고)

- 10장 풀 생성 (AI 이미지 포함) ≈ **$0.40 (~530원)**
- 10장 텍스트만 (업로드 이미지) ≈ **$0.003 (~4원)**
- 아이디어 추천 1회 ≈ **$0.003**
- 재생성 2배 잡아 실운영 **~$0.80 / 최종 카드셋**

유저 100명 · 평균 월 2회 생성 = **월 ~$160 비용**. 유료플랜 $9/mo × 20명 전환 시 break-even.
