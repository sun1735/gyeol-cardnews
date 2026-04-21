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

### backend 서비스 Variables

| Key | 필수 | 비고 |
|---|---|---|
| `DATABASE_URL` | ✅ | Postgres 서비스에서 참조 (+ Add Reference) |
| `GEMINI_API_KEY` | ✅ | 텍스트·이미지 LLM |
| `NEXTAUTH_SECRET` | ✅ (auth on 시) | frontend 와 **동일값** · 랜덤 32자+ |
| `AUTH_MODE` | ⚪ | `disabled` 로 두면 가드 비활성 (현재 기본). `enabled` 시 JWT 필수 |
| `OPENAI_API_KEY` | ⚪ 선택 | 설정 시 Gemini 대신 OpenAI 사용 (레거시) |
| `STORAGE_DRIVER` | ⚪ | `local` 만 현재 지원 |
| `PORT` | Railway 자동 | — |

### frontend 서비스 Variables

| Key | 필수 | 비고 |
|---|---|---|
| `NEXT_PUBLIC_API_ORIGIN` | ✅ | backend URL (https://...-production.up.railway.app) |
| `NEXTAUTH_URL` | ✅ | frontend URL (예: https://note2card.com) |
| `NEXTAUTH_SECRET` | ✅ | backend 와 **동일값** · 랜덤 32자+ |
| `GOOGLE_CLIENT_ID` | ✅ | Google Cloud Console OAuth 클라이언트 ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | 위 클라이언트의 시크릿 |

`NEXTAUTH_SECRET` 생성:
```bash
openssl rand -base64 32
```

## 3-A. Google OAuth 설정

1. https://console.cloud.google.com/apis/credentials 접속
2. **+ Create Credentials** → **OAuth client ID**
3. Application type: **Web application**
4. Authorized JavaScript origins:
   - `https://<frontend>.up.railway.app`
   - `http://localhost:3000` (개발용)
5. Authorized redirect URIs:
   - `https://<frontend>.up.railway.app/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google`
6. Create → **Client ID · Client Secret** 복사
7. Railway frontend 서비스 Variables 에 등록

**OAuth 동의 화면**도 설정해야 구글에서 로그인 버튼이 동작합니다:
- Google Cloud Console → **OAuth consent screen**
- User Type: **External**
- App name: `Note2Card`
- Support email, Developer contact 입력
- Scopes: `openid email profile` 만 체크
- Test users 에 초기 운영자/테스터 이메일 추가 (Production 전환 전)

## 3-B. 인증 모드 전환

현재는 `AUTH_MODE=disabled` (기본) 로 모든 엔드포인트가 공개입니다. 

운영 전환 순서:
1. 위 환경변수 모두 설정 (backend + frontend)
2. 본인 계정으로 로그인해서 테스트
3. backend `AUTH_MODE=enabled` 로 변경 → 재배포
4. 이후 토큰 없는 요청은 `401 Unauthorized` 반환
5. `@Public()` 데코레이터가 붙은 `/health`, `/api/backgrounds` 는 계속 공개

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
