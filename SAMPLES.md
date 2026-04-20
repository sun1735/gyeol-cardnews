# 유순 · 카드뉴스 자동 생성 샘플 (단계 4)

출력은 **템플릿 폴백** 기준입니다. `OPENAI_API_KEY` 미설정 시에도 동일한 카드 수·구조·필드·톤이 유지되어 "유순 임산부/유아 5장" 같은 테스트에서 **결정적이고 일관된** 결과가 나옵니다.

## 공통 설정
- 브랜드: `유순` (seed 로 자동 생성됨 — `npm run db:seed`)
- `sizePreset`: `1:1`
- `count`: 5
- 브랜드 이미지 3장이 카드 1~4에 순환 배정, CTA 카드는 이미지 없음
- 카드별 필드 고정: `{ id, title, body, subtext, cta, layout, imageUrl }`

브랜드 CUID 는 아래 명령으로 확인:
```bash
curl -s http://localhost:4000/api/brands | jq '.brands[] | select(.name=="유순") | .id'
```

---

## 샘플 1 — 임산부 / 가족 케어

**프롬프트**: `유순 임산부와 가족을 위한 산전 케어 서비스`

```bash
curl -X POST http://localhost:4000/api/generate/cards \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "auto",
    "prompt": "유순 임산부와 가족을 위한 산전 케어 서비스",
    "count": 5,
    "brandId": "<YUSOON_BRAND_ID>"
  }'
```

```json
{
  "cards": [
    {
      "id": "...", "layout": "cover",
      "title": "유순 · 유순 임산부와 가족을 위한 산전 케어…",
      "body": "유순 임산부와 가족을 위한 산전 케어 서비스",
      "subtext": "유순 · 임산부·가족 케어",
      "cta": "자세히 보기 →",
      "imageUrl": "/uploads/seed/yusoon-morning.svg"
    },
    {
      "id": "...", "layout": "content",
      "title": "체계적인 건강 관리",
      "body": "주차별 건강 상태를 함께 살피며 작은 변화도 세심하게 기록합니다.",
      "subtext": "정기 상담", "cta": "2 / 5",
      "imageUrl": "/uploads/seed/yusoon-meal.svg"
    },
    {
      "id": "...", "layout": "content",
      "title": "영양과 휴식",
      "body": "산모와 태아의 균형을 생각한 식단과 편안한 공간을 제공합니다.",
      "subtext": "맞춤 식단", "cta": "3 / 5",
      "imageUrl": "/uploads/seed/yusoon-program.svg"
    },
    {
      "id": "...", "layout": "content",
      "title": "산전 상담",
      "body": "전문 상담사가 불안한 마음을 듣고 필요한 정보를 정리해 드립니다.",
      "subtext": "심리 지원", "cta": "4 / 5",
      "imageUrl": "/uploads/seed/yusoon-morning.svg"
    },
    {
      "id": "...", "layout": "cta",
      "title": "오늘도 평안한 하루",
      "body": "임산부와 가족을 위한 맞춤 케어를 더 자세히 안내해 드립니다.",
      "subtext": "유순 드림", "cta": "상담 예약 →"
    }
  ]
}
```

---

## 샘플 2 — 영유아 데이케어

**프롬프트**: `유순 유아 데이케어의 하루`

```json
{
  "cards": [
    {
      "id": "...", "layout": "cover",
      "title": "유순 · 유순 유아 데이케어의 하루",
      "body": "유순 유아 데이케어의 하루",
      "subtext": "유순 · 영유아 케어",
      "cta": "자세히 보기 →",
      "imageUrl": "/uploads/seed/yusoon-morning.svg"
    },
    {
      "id": "...", "layout": "content",
      "title": "안전한 환경",
      "body": "매일 점검하는 청결·소독·동선 설계로 안심할 수 있는 공간을 만듭니다.",
      "subtext": "일일 점검", "cta": "2 / 5",
      "imageUrl": "/uploads/seed/yusoon-meal.svg"
    },
    {
      "id": "...", "layout": "content",
      "title": "발달 단계 맞춤",
      "body": "월령에 맞춘 놀이와 활동으로 자연스러운 성장을 함께 지켜봅니다.",
      "subtext": "연령별 프로그램", "cta": "3 / 5",
      "imageUrl": "/uploads/seed/yusoon-program.svg"
    },
    {
      "id": "...", "layout": "content",
      "title": "건강한 식단",
      "body": "영양사와 함께 설계한 연령별 식단을 정성껏 차려냅니다.",
      "subtext": "영양사 설계", "cta": "4 / 5",
      "imageUrl": "/uploads/seed/yusoon-morning.svg"
    },
    {
      "id": "...", "layout": "cta",
      "title": "오늘도 평안한 하루",
      "body": "아이의 하루와 부모의 마음 모두 세심히 살피는 이야기를 만나보세요.",
      "subtext": "유순 드림", "cta": "상담 예약 →"
    }
  ]
}
```

---

## 샘플 3 — 시니어 요양

**프롬프트**: `유순 요양원의 따뜻한 하루 일과`

```json
{
  "cards": [
    {
      "id": "...", "layout": "cover",
      "title": "유순 · 유순 요양원의 따뜻한 하루 일과",
      "body": "유순 요양원의 따뜻한 하루 일과",
      "subtext": "유순 · 시니어 케어",
      "cta": "하루 보기 →",
      "imageUrl": "/uploads/seed/yusoon-morning.svg"
    },
    {
      "id": "...", "layout": "content",
      "title": "아침 산책",
      "body": "햇살 좋은 정원에서 시작하는 느린 산책으로 하루를 엽니다.",
      "subtext": "하루의 시작", "cta": "2 / 5",
      "imageUrl": "/uploads/seed/yusoon-meal.svg"
    },
    {
      "id": "...", "layout": "content",
      "title": "영양 식단",
      "body": "부드럽고 균형 잡힌 식사를 영양사와 함께 준비합니다.",
      "subtext": "점심 · 저녁", "cta": "3 / 5",
      "imageUrl": "/uploads/seed/yusoon-program.svg"
    },
    {
      "id": "...", "layout": "content",
      "title": "정서 프로그램",
      "body": "노래·그림·원예 등 취향에 맞춘 활동으로 오후를 채웁니다.",
      "subtext": "오후 활동", "cta": "4 / 5",
      "imageUrl": "/uploads/seed/yusoon-morning.svg"
    },
    {
      "id": "...", "layout": "cta",
      "title": "오늘도 평안한 하루",
      "body": "가족처럼 돌보는 이야기를 더 듣고 싶다면 문의해 주세요.",
      "subtext": "유순 드림", "cta": "상담 문의 →"
    }
  ]
}
```

---

## 재현성 · 프레임 매칭 규칙

- `임산부 / 임산 / 산모 / 임신 / 태교 / 산전` → **임산부 프레임**
- `유아 / 영아 / 아기 / 어린이 / 영유아 / 육아 / 데이케어` → **영유아 프레임**
- `시니어 / 어르신 / 요양 / 노인 / 치매 / 실버` → **시니어 프레임**
- 일치 없음 → **기본 프레임** (핵심 가치 / 약속 / 동행 / 돌봄)

프롬프트에 여러 키워드가 섞여 있으면 위 순서대로 **첫 번째 매칭**이 우선합니다 (예: "유순 임산부/유아 5장" → 임산부 프레임). 같은 프롬프트를 반복 호출하면 **동일한 제목·본문·서브텍스트·CTA** 가 나오며, 이미지 매핑만 브랜드 에셋 수에 따라 순환됩니다.

## 안전 가드

자동/수동 양쪽 모두 `sanitizeText()` 를 거칩니다. 차단 대상 예시:

| 입력 (원문) | 출력 (완화) |
|---|---|
| `임신 부작용 없음 보장` | `임신 안전에 유의한 도와드립` |
| `완치 100% 기적의 효과` | `도움이 되는 충분히 의미 있는 효과` |
| `업계 1위 최고의 서비스` | `신뢰받는 믿을 수 있는 서비스` |
| `의학적으로 증명된 치료` | `전문가 의견을 참고한 치료` |

## 수동 입력(manual) 모드 예시

빈 필드는 브랜드 기반 기본값으로 자동 보강됩니다.

```bash
curl -X POST http://localhost:4000/api/generate/cards \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "manual",
    "brandId": "<YUSOON_BRAND_ID>",
    "cards": [
      { "title": "오늘의 메뉴" },
      { "title": "아침",  "body": "현미죽과 계절 과일" },
      { "title": "점심",  "body": "고등어 구이 + 시금치나물" },
      { "title": "간식",  "body": "따뜻한 유자차와 약과" },
      { }
    ]
  }'
```

비워둔 다섯 번째 카드는 자동으로 CTA 레이아웃 + `오늘도 평안한 하루 / 상담 문의 →` 등으로 채워집니다.
