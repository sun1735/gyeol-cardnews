# 브랜드 지식노트 기반 카드뉴스 생성 구현안 (실행형)

이 문서는 현재 `결 (Gyeol)` 코드베이스를 기준으로, 아래 기능을 **실제로 구현 가능한 형태**로 정리한 실행 문서다.

- 브랜드 자료(문서/이미지)를 지식노트로 적재
- 간단 프롬프트로 카드뉴스 생성
- 기존 자료에서 적절한 이미지를 자동 선택 후 편집
- 카드별 카피(title/body/subtext/cta) 자동 작성

---

## 1) 구현 목표와 범위

### 목표
- 입력: `"유순 제품 5월 1일부터 온라인 판매 시작. 인스타 피드 카드뉴스 6장"`
- 시스템:
  1. 브랜드 지식노트에서 관련 텍스트/이미지 검색
  2. 카드 스토리보드 구성(cover/content/cta)
  3. 카드별 이미지 후보 선택 + 이미지 편집
  4. 카드별 카피 생성 + 안전 필터 통과
- 출력: 프론트가 즉시 렌더 가능한 `cards[]` JSON

### 범위 (MVP)
- 모드 A 중심: 공통 레퍼런스 이미지 1~3장 + 브랜드 지식노트 자동 활용
- 비동기 Job 기반 생성 (`POST -> jobId`, `GET status`)
- 실패 카드만 재생성 가능한 구조

### 비범위 (후속)
- 실시간 협업 편집
- 카드별 고급 마스킹 UI
- 완전 자동 영상 BGM/자막

---

## 2) 현재 코드 기준 확장 포인트

현재 이미 존재:
- 텍스트 생성: `backend/src/generate/*`
- 이미지 편집: `backend/src/images/editor.ts` (Gemini 이미지 편집)
- 업로드: `backend/src/upload/upload.controller.ts`
- 브랜드/프로젝트/카드/로그: Prisma 모델 존재

추가할 것:
- 지식노트 모델(문서/청크/이미지 태그)
- 검색 서비스(텍스트/이미지 후보 랭킹)
- 생성 잡 API + 상태 조회 API
- 생성 오케스트레이터 서비스

---

## 3) DB 스키마 (Prisma) 확장안

파일: `backend/prisma/schema.prisma`

```prisma
model BrandKnowledgeDoc {
  id          String   @id @default(cuid())
  brandId     String
  title       String
  sourceType  String   // upload | url | note
  sourceUrl   String?
  contentText String   @default("")
  status      String   @default("ready") // ready | indexing | failed
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  brand       BrandProfile @relation(fields: [brandId], references: [id], onDelete: Cascade)
  chunks      BrandKnowledgeChunk[]

  @@index([brandId, createdAt])
  @@map("brand_knowledge_docs")
}

model BrandKnowledgeChunk {
  id          String   @id @default(cuid())
  brandId     String
  docId       String
  chunkIndex  Int
  text        String
  tokenCount  Int      @default(0)
  // MVP: embedding은 외부 벡터 DB 없이 JSON 문자열로 저장해도 시작 가능
  // 운영: pgvector 컬럼으로 전환 권장
  embedding   String?  // JSON stringified vector
  createdAt   DateTime @default(now())

  brand       BrandProfile       @relation(fields: [brandId], references: [id], onDelete: Cascade)
  doc         BrandKnowledgeDoc  @relation(fields: [docId], references: [id], onDelete: Cascade)

  @@index([brandId, docId])
  @@map("brand_knowledge_chunks")
}

model BrandImageAsset {
  id           String   @id @default(cuid())
  brandId      String
  url          String
  label        String   @default("") // 예: "유순 패키지 정면"
  tags         String   @default("") // csv 또는 json string
  usageRights  String   @default("owned") // owned | licensed | unknown
  qualityScore Float    @default(0.5) // 0~1
  createdAt    DateTime @default(now())

  brand        BrandProfile @relation(fields: [brandId], references: [id], onDelete: Cascade)

  @@index([brandId, createdAt])
  @@map("brand_image_assets")
}

model GenerationJob {
  id             String   @id @default(cuid())
  brandId        String?
  mode           String   // note_rag
  status         String   @default("queued") // queued | running | partial | done | failed
  requestJson    String   // 원 요청 payload
  resultJson     String?  // cards 결과
  errorMessage   String?
  progress       Int      @default(0) // 0~100
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([status, createdAt])
  @@map("generation_jobs")
}
```

> 운영 권장: Postgres + pgvector 사용 시 `embedding` 타입을 `Unsupported("vector(1536)")`로 교체.

---

## 4) API 계약 (프론트/백엔드)

### 4.1 지식노트 문서 등록
`POST /api/knowledge/docs`

```json
{
  "brandId": "clz_brand",
  "title": "유순 브랜드 소개서",
  "sourceType": "note",
  "contentText": "유순은 ...",
  "sourceUrl": ""
}
```

응답:
```json
{ "docId": "clz_doc", "status": "ready" }
```

### 4.2 지식노트 이미지 등록
`POST /api/knowledge/images`

```json
{
  "brandId": "clz_brand",
  "url": "/uploads/1711111111-abcd.png",
  "label": "유순 제품 메인컷",
  "tags": ["제품", "화이트배경", "패키지정면"],
  "usageRights": "owned",
  "qualityScore": 0.92
}
```

### 4.3 카드 생성 Job 시작
`POST /api/generate/cards-from-note`

```json
{
  "brandId": "clz_brand",
  "prompt": "유순 5/1 온라인 판매 시작 인스타 피드 카드뉴스 6장",
  "count": 6,
  "baseImageUrls": ["/uploads/171...png"],
  "sizePreset": "1:1"
}
```

응답:
```json
{ "jobId": "clz_job", "status": "queued" }
```

### 4.4 생성 상태 조회
`GET /api/generate/jobs/:jobId`

진행중:
```json
{ "jobId": "clz_job", "status": "running", "progress": 55 }
```

완료:
```json
{
  "jobId": "clz_job",
  "status": "done",
  "progress": 100,
  "cards": [
    {
      "id": "tmp1",
      "layout": "cover",
      "title": "유순 온라인 판매 시작",
      "body": "5월 1일부터 공식 온라인 스토어에서...",
      "subtext": "출시 안내",
      "cta": "지금 확인하기 →",
      "imageUrl": "/uploads/edited-1.png"
    }
  ]
}
```

---

## 5) 생성 파이프라인 (오케스트레이션)

파일 제안:
- `backend/src/knowledge/*`
- `backend/src/generate-note/*`

실행 순서:
1. `prompt` 안전성 체크 (`generate/safety.ts` 재사용)
2. `brandId` 기반 지식노트/이미지 후보 로드
3. 텍스트 검색 Top-K (MVP는 키워드 BM25 유사, 후속 embedding 검색)
4. 카드 스토리보드 생성
5. 카드별 이미지 선택
6. 이미지 편집 병렬 실행 (`images/editor.ts`)
7. 카드 카피 생성 (`generate.service.ts` 로직 재사용 또는 확장)
8. 사실성/금칙어/길이 검증
9. `GenerationJob.resultJson` 저장 후 완료 처리

---

## 6) 카드 스토리보드 규칙 (MVP 고정)

- 카드1: `cover` (출시 메시지 + 핵심 훅)
- 카드2~N-1: `content` (혜택/성분/사용법/후기/차별점)
- 카드N: `cta` (구매 유도 + 링크/문의)

카드 수가 6장이라면:
- cover 1
- content 4
- cta 1

---

## 7) 이미지 선택 랭킹 (개선된 방식)

카드별 이미지 후보 점수:

`finalScore = 0.45 * semantic + 0.25 * brandFit + 0.20 * quality + 0.10 * recency`

- `semantic`: 프롬프트/카드요약과 태그 유사도
- `brandFit`: 브랜드 primary/secondary tone 태그 일치
- `quality`: blur/noise/해상도 기준 점수
- `recency`: 최신 캠페인 반영 가중치

상위 1개를 base로 선택하고, 실패 시 2~3순위 fallback.

---

## 8) Claude Code가 바로 작업할 TODO (체크리스트)

### Phase 1 — 데이터/엔드포인트
- [ ] Prisma에 `BrandKnowledgeDoc`, `BrandKnowledgeChunk`, `BrandImageAsset`, `GenerationJob` 추가
- [ ] `knowledge` 모듈 생성 (`docs`, `images` CRUD)
- [ ] Swagger DTO/예시 반영

### Phase 2 — 생성 잡
- [ ] `POST /api/generate/cards-from-note`
- [ ] `GET /api/generate/jobs/:id`
- [ ] Job 상태 전이 (`queued -> running -> done/partial/failed`)

### Phase 3 — 오케스트레이터
- [ ] 텍스트 검색기 구현 (`KnowledgeSearchService`)
- [ ] 이미지 후보 랭커 구현 (`ImageRankerService`)
- [ ] 카드별 이미지 편집 병렬화 (`Promise.allSettled`)
- [ ] 부분 실패 재시도 (카드 단위 최대 2회)

### Phase 4 — 품질/안정화
- [ ] 생성 결과 스키마 검증
- [ ] 안전 가드 + 과장 표현 sanitize
- [ ] e2e 8~10개 시나리오 추가

---

## 9) 코드 뼈대 (NestJS)

### 9.1 Controller 예시
```ts
@Controller('api/generate')
export class GenerateNoteController {
  constructor(private readonly svc: GenerateNoteService) {}

  @Post('cards-from-note')
  async start(@Body() dto: GenerateFromNoteDto) {
    return this.svc.enqueue(dto)
  }

  @Get('jobs/:id')
  async getJob(@Param('id') id: string) {
    return this.svc.getJob(id)
  }
}
```

### 9.2 Service 핵심
```ts
async processJob(jobId: string): Promise<void> {
  await this.jobs.markRunning(jobId, 10)
  const req = await this.jobs.getRequest(jobId)

  const context = await this.knowledgeSearch.retrieve(req.brandId, req.prompt, 8)
  await this.jobs.markRunning(jobId, 30)

  const storyboard = this.storyboard.build(req.prompt, req.count)
  const drafts = await this.copyWriter.generate(storyboard, context)
  await this.jobs.markRunning(jobId, 60)

  const cards = await this.imageComposer.composeAll(drafts, req, context.images)
  await this.jobs.markRunning(jobId, 90)

  const finalCards = this.guardrail.validateAndFix(cards)
  await this.jobs.markDone(jobId, finalCards)
}
```

### 9.3 이미지 편집 병렬 + 부분 실패 허용
```ts
const edited = await Promise.allSettled(
  drafts.map((d, i) => this.images.editForCard(d, selectedImages[i], refs)),
)

return drafts.map((d, i) => {
  const ok = edited[i].status === 'fulfilled'
  return {
    ...d,
    imageUrl: ok ? edited[i].value : selectedImages[i].url, // fallback
  }
})
```

---

## 10) e2e 시나리오 (추가)

1. 브랜드 노트 2건 등록 후 생성 요청 -> `done`
2. 노트 없음 -> 기본 프레임 fallback 동작
3. 이미지 편집 1장 실패 -> partial 완료 + fallback URL 사용
4. 금칙어 프롬프트 -> `400`
5. count=6 -> 카드 수 정확성 검증
6. baseImageUrls 3장 -> 라운드로빈 배치 검증
7. job status progress 증가 검증
8. 결과 JSON 필드 고정 검증(title/body/subtext/cta/layout/imageUrl)

---

## 11) 운영 권장사항 (개선안)

- **Idempotency-Key**: 같은 요청 중복 생성 방지
- **Rate limit**: 브랜드/사용자별 분당 요청 제한
- **Prompt hash 캐시**: 동일 프롬프트 재생성 비용 절감
- **Human-in-the-loop**: 최종 게시 전 1클릭 승인 단계
- **A/B 라우팅**: 이미지 모델 `Gemini`/`gpt-image-1` 선택 가능 구조

---

## 12) Claude Code 실행 프롬프트 (복붙용)

아래 문장을 Claude Code에 그대로 입력하면 이 문서 기준으로 구현하기 좋다.

```text
현재 저장소는 NestJS + Prisma 기반이다.
IMPLEMENTATION_BRAND_NOTE_RAG.md 문서 기준으로 다음을 순서대로 구현해줘:
1) Prisma 스키마 확장(BrandKnowledgeDoc, BrandKnowledgeChunk, BrandImageAsset, GenerationJob)
2) knowledge 모듈 생성(/api/knowledge/docs, /api/knowledge/images)
3) generate-note 모듈 생성(/api/generate/cards-from-note, /api/generate/jobs/:id)
4) GenerateNoteService 오케스트레이션 구현(검색->스토리보드->카피->이미지편집->검증)
5) 기존 generate/safety.ts, sanitize.ts, images/editor.ts 를 재사용하도록 연결
6) Swagger DTO/예시와 e2e 시나리오 8개 추가
완료 후 변경 파일 목록, 실행 명령, 테스트 결과를 알려줘.
```

---

## 13) 결론

이 설계는 현재 코드베이스와 충돌 없이 단계적으로 붙일 수 있고,
모드 A 중심 MVP에서 빠르게 사용자 가치를 검증한 뒤 모드 B(카드별 고급 편집)로 확장하기 좋다.
