// 카드 출력 스키마 고정 — OpenAI strict json_schema 와 런타임 검증을 같은 소스에서 공급.

export const LAYOUTS = ['cover', 'content', 'cta'] as const
export type Layout = (typeof LAYOUTS)[number]

export const CARD_LIMITS = {
  title: 18,
  body: 80,
  subtext: 20,
  cta: 12,
} as const

export interface ValidatedCard {
  title: string
  body: string
  subtext: string
  cta: string
  layout: Layout
}

// OpenAI chat.completions 의 response_format 에 그대로 넣는다.
// strict: true 는 모든 property 가 required 여야 함.
export const OPENAI_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    name: 'card_news_response',
    strict: true,
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['cards'],
      properties: {
        cards: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['title', 'body', 'subtext', 'cta', 'layout'],
            properties: {
              title: { type: 'string', description: `한국어 제목, ${CARD_LIMITS.title}자 이내` },
              body: { type: 'string', description: `본문, ${CARD_LIMITS.body}자 이내` },
              subtext: { type: 'string', description: `보조 텍스트, ${CARD_LIMITS.subtext}자 이내 (필요 없으면 빈 문자열)` },
              cta: { type: 'string', description: `행동 유도 문구, ${CARD_LIMITS.cta}자 이내 (필요 없으면 빈 문자열)` },
              layout: { type: 'string', enum: [...LAYOUTS] },
            },
          },
        },
      },
    },
  },
}

// 페이지 번호·순번 표시는 cta/subtext 어디에 있든 전부 제거.
// 카드뉴스 이미지 위에 "1/5" 같은 게 찍히지 않도록 강력 필터.
// 허용되지 않는 패턴 (두 자리 이하 숫자쌍만 — "1000/50" 같은 큰 숫자는 legit 가능성):
//   "1/5"  "2 / 5"  " 3 /10 "  "카드 1/5"  "1 of 5"  "1-5"  "Page 2/5"  "2 of 5 →"  "(2/5)"
const PATTERNS = [
  /\b\d{1,2}\s*\/\s*\d{1,2}\b/g, // 1/5, 10/10
  /\b\d{1,2}\s+of\s+\d{1,2}\b/gi, // 1 of 5
  /\bpage\s*\d{1,2}\b/gi, // page 2
  /[\(\[【]\s*\d{1,2}\s*\/\s*\d{1,2}\s*[\)\]】]/g, // (1/5), [2/5]
]
function stripPageNumber(s: string): string {
  let out = s
  for (const p of PATTERNS) out = out.replace(p, '')
  // 잔여 기호·공백 정리: "· · " 나 앞뒤 구두점 · 공백
  out = out
    .replace(/[·\-–—•|]+/g, ' ') // 구분자 공백화
    .replace(/\s+/g, ' ')
    .replace(/^[\s,.;:!?/()\[\]【】]+|[\s,.;:!?/()\[\]【】]+$/g, '')
    .trim()
  return out
}

// 파싱 후 카드 1장 검증. 실패 시 null → 상위에서 재시도 또는 템플릿 폴백.
// 길이 초과는 거절하지 않고 truncate — 모델이 조금 넘기는 게 빈도 높음.
export function validateCard(raw: unknown): ValidatedCard | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const title = coerceString(r.title, CARD_LIMITS.title)
  const body = coerceString(r.body, CARD_LIMITS.body)
  const subtext = stripPageNumber(coerceString(r.subtext, CARD_LIMITS.subtext) ?? '')
  const cta = stripPageNumber(coerceString(r.cta, CARD_LIMITS.cta) ?? '')
  const layout = (LAYOUTS as readonly string[]).includes(String(r.layout))
    ? (r.layout as Layout)
    : null

  // 핵심 필드(title·body·layout) 누락 → 카드 실패
  if (!title || !body || !layout) return null
  return { title, body, subtext, cta, layout }
}

function coerceString(v: unknown, maxLen: number): string | null {
  if (typeof v !== 'string') return null
  const trimmed = v.trim().replace(/\s+/g, ' ')
  if (!trimmed) return null
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen).trim() : trimmed
}

// product-ad 템플릿 카피 검증. 핵심 필드(title/body/ctaLabel/layout) 필수.
// features/colors 는 없어도 빈 배열로 반환 — 프런트에서 숨김 처리.
export interface ProductAdFeatureOut {
  icon: string
  label: string
}
export interface ValidatedProductAdCard {
  title: string
  subtitle: string
  body: string
  badgeLabel: string
  features: ProductAdFeatureOut[]
  colors: string[]
  priceOriginal: number | null
  priceSale: number | null
  discountPercent: number | null
  deadlineText: string
  ctaLabel: string
  layout: Layout
}

const HEX_RE = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/

export const PRODUCT_AD_LIMITS = {
  title: 24,
  subtitle: 40,
  body: 120,
  badgeLabel: 14,
  featureLabel: 12,
  deadlineText: 20,
  ctaLabel: 16,
} as const

export function validateProductAdCard(raw: unknown): ValidatedProductAdCard | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const title = coerceString(r.title, PRODUCT_AD_LIMITS.title)
  const subtitle = coerceString(r.subtitle, PRODUCT_AD_LIMITS.subtitle) ?? ''
  const body = coerceString(r.body, PRODUCT_AD_LIMITS.body)
  const badgeLabel = coerceString(r.badgeLabel, PRODUCT_AD_LIMITS.badgeLabel) ?? ''
  const deadlineText = coerceString(r.deadlineText, PRODUCT_AD_LIMITS.deadlineText) ?? ''
  const ctaLabel = coerceString(r.ctaLabel, PRODUCT_AD_LIMITS.ctaLabel)

  // features — 최대 4개
  const featuresRaw = Array.isArray(r.features) ? r.features : []
  const features: ProductAdFeatureOut[] = []
  for (const f of featuresRaw.slice(0, 4)) {
    if (!f || typeof f !== 'object') continue
    const fo = f as Record<string, unknown>
    const icon = typeof fo.icon === 'string' ? fo.icon.trim().slice(0, 4) : ''
    const label = coerceString(fo.label, PRODUCT_AD_LIMITS.featureLabel) ?? ''
    if (!icon || !label) continue
    features.push({ icon, label })
  }

  // colors — HEX 만 통과
  const colorsRaw = Array.isArray(r.colors) ? r.colors : []
  const colors: string[] = []
  for (const c of colorsRaw.slice(0, 6)) {
    if (typeof c !== 'string') continue
    const v = c.trim()
    if (!HEX_RE.test(v)) continue
    colors.push(v.startsWith('#') ? v : `#${v}`)
  }

  const priceOriginal = coerceNumber(r.priceOriginal)
  const priceSale = coerceNumber(r.priceSale)
  const discountPercent = (() => {
    const n = coerceNumber(r.discountPercent)
    if (n === null) return null
    return Math.max(1, Math.min(99, Math.round(n)))
  })()

  const layout = (LAYOUTS as readonly string[]).includes(String(r.layout))
    ? (r.layout as Layout)
    : null

  if (!title || !body || !ctaLabel || !layout) return null
  return {
    title,
    subtitle,
    body,
    badgeLabel,
    features,
    colors,
    priceOriginal,
    priceSale,
    discountPercent,
    deadlineText,
    ctaLabel,
    layout,
  }
}

function coerceNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string') {
    const n = Number(v.replace(/[^\d.\-]/g, ''))
    if (Number.isFinite(n) && n !== 0) return n
  }
  return null
}

// DynamicDesign — AI 가 결정한 layout·palette·decorations 검증.
export type DynamicLayout = 'split-dark-left' | 'image-top-card-bottom' | 'fullbleed-center-glass'
const DYNAMIC_LAYOUTS: readonly DynamicLayout[] = [
  'split-dark-left',
  'image-top-card-bottom',
  'fullbleed-center-glass',
]
const HEX_COLOR_RE = /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/

export interface ValidatedDynamicDesign {
  layout: DynamicLayout
  palette: { dominant: string; accent: string; textOnDominant: string }
  title: string
  subtitle: string
  body: string
  badgeLabel: string
  ctaLabel: string
  features: { icon: string; label: string }[]
  priceOriginal: number | null
  priceSale: number | null
  discountPercent: number | null
  deadlineText: string
  decorations: string[]
  cardLayout: Layout
}

function normHex(v: unknown, fallback: string): string {
  if (typeof v !== 'string') return fallback
  const t = v.trim()
  if (!HEX_COLOR_RE.test(t)) return fallback
  return t.startsWith('#') ? t : `#${t}`
}

export function validateDynamicDesign(raw: unknown): ValidatedDynamicDesign | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>

  const layout = (DYNAMIC_LAYOUTS as readonly string[]).includes(String(r.layout))
    ? (r.layout as DynamicLayout)
    : null
  if (!layout) return null

  const paletteRaw = (r.palette ?? {}) as Record<string, unknown>
  const palette = {
    dominant: normHex(paletteRaw.dominant, '#1a1a2e'),
    accent: normHex(paletteRaw.accent, '#e94560'),
    textOnDominant: normHex(paletteRaw.textOnDominant, '#ffffff'),
  }

  const title = coerceString(r.title, 24)
  const subtitle = coerceString(r.subtitle, 40) ?? ''
  const body = coerceString(r.body, 120)
  const badgeLabel = coerceString(r.badgeLabel, 14) ?? ''
  const ctaLabel = coerceString(r.ctaLabel, 16)
  const deadlineText = coerceString(r.deadlineText, 20) ?? ''

  const featuresRaw = Array.isArray(r.features) ? r.features : []
  const features: { icon: string; label: string }[] = []
  for (const f of featuresRaw.slice(0, 4)) {
    if (!f || typeof f !== 'object') continue
    const fo = f as Record<string, unknown>
    const icon = typeof fo.icon === 'string' ? fo.icon.trim().slice(0, 4) : ''
    const label = coerceString(fo.label, 12) ?? ''
    if (icon && label) features.push({ icon, label })
  }

  const priceOriginal = coerceNumber(r.priceOriginal)
  const priceSale = coerceNumber(r.priceSale)
  const discountPercent = (() => {
    const n = coerceNumber(r.discountPercent)
    return n === null ? null : Math.max(1, Math.min(99, Math.round(n)))
  })()

  const decorationsRaw = Array.isArray(r.decorations) ? r.decorations : []
  const decorations = decorationsRaw
    .filter((d): d is string => typeof d === 'string')
    .map((d) => d.trim())
    .filter((d) => d.length > 0 && d.length < 40)
    .slice(0, 4)

  const cardLayout = (LAYOUTS as readonly string[]).includes(String(r.cardLayout))
    ? (r.cardLayout as Layout)
    : 'cover'

  if (!title || !body || !ctaLabel) return null
  return {
    layout,
    palette,
    title,
    subtitle,
    body,
    badgeLabel,
    ctaLabel,
    features,
    priceOriginal,
    priceSale,
    discountPercent,
    deadlineText,
    decorations,
    cardLayout,
  }
}
