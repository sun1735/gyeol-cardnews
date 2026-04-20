// 입력 프롬프트 · 수동 카드 입력의 NSFW · 브랜드 안전 키워드 필터.
// sanitize.ts 가 "출력" 완화용이라면, 여기는 "입력" 거절용 — 400 에러로 LLM 호출 전에 차단.
//
// 룰 운영 방침:
//   - 카테고리별로 묶어서 로그 분석을 쉽게 함 ("왜 차단됐는지")
//   - 과도 차단을 피하기 위해 짧은 단어(아기, 성장 등)는 피하고 복합어·명확한 위험 단어만
//   - 정치·종교·의료단정 등 브랜드 안전 위험은 MVP 에선 차단 대신 경고로 두되, 운영에서 확장 가능

export type SafetyCategory =
  | 'nsfw'
  | 'violence'
  | 'drug'
  | 'hate'
  | 'personal_info'

interface SafetyRule {
  category: SafetyCategory
  pattern: RegExp
  label: string
}

const RULES: SafetyRule[] = [
  // NSFW / 성인
  { category: 'nsfw', label: '성인 콘텐츠', pattern: /19\s?금|성인\s?용|야동|누드|에로|음란|섹스/ },

  // 폭력 · 자해
  { category: 'violence', label: '폭력 · 자해', pattern: /살해|자살|자해|폭행|학대|고문/ },

  // 마약 · 불법
  { category: 'drug', label: '마약 · 불법 물질', pattern: /마약|필로폰|대마초|코카인|헤로인/ },

  // 혐오 · 차별
  { category: 'hate', label: '혐오 · 차별', pattern: /(인종|민족|종교|성별|장애인)\s?(비하|차별|혐오)/ },

  // 개인정보 (주민번호·전화번호 패턴)
  { category: 'personal_info', label: '개인정보', pattern: /\b\d{6}\s?-\s?\d{7}\b/ }, // 주민번호 꼴
]

export interface SafetyBlock {
  blocked: true
  category: SafetyCategory
  label: string
  matched: string
}

export interface SafetyOk {
  blocked: false
}

export type SafetyResult = SafetyBlock | SafetyOk

// 여러 필드를 한꺼번에 검사. 첫 매칭에서 반환.
export function checkSafety(...inputs: Array<string | null | undefined>): SafetyResult {
  for (const s of inputs) {
    if (!s) continue
    for (const rule of RULES) {
      const m = s.match(rule.pattern)
      if (m) {
        return { blocked: true, category: rule.category, label: rule.label, matched: m[0] }
      }
    }
  }
  return { blocked: false }
}
