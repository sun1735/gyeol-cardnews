import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { createHash } from 'crypto'
import { PrismaService } from '../prisma/prisma.service'
import { sanitizeText } from './sanitize'
import { BG_URLS } from '../backgrounds/defaults'
import {
  OPENAI_RESPONSE_FORMAT,
  validateCard,
  CARD_LIMITS,
  ValidatedCard,
  validateDynamicDesign,
  ValidatedDynamicDesign,
  validateLayoutDsl,
  ValidatedLayoutDsl,
} from './schema'
import { buildStyleRecipe, recipeAsPromptBlock } from './style'
import { checkSafety } from './safety'
import {
  callGeminiJson,
  cardArraySchema,
  dynamicDesignArraySchema,
  layoutDslSchema,
} from './llm-gemini'

type CardSource = 'llm' | 'template'

export interface GenMeta {
  sources: CardSource[]
  retries: number
  source: 'llm' | 'template' | 'mixed'
  durationMs: number
  timedOut: boolean
}

interface LlmAttempt {
  cards: (ValidatedCard | null)[] // 길이 = n, null = 해당 인덱스 카드 검증 실패
  retries: number
  timedOut: boolean
}

// 단일 LLM 호출 타임아웃 — 초과 시 AbortController 로 끊고 재시도 루프로 넘김.
const LLM_TIMEOUT_MS = 15_000

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

type Layout = 'cover' | 'content' | 'cta'

interface ManualCardInput {
  title?: string
  body?: string
  subtext?: string
  cta?: string
  imageUrl?: string
  layout?: Layout
}

interface GenInput {
  mode: 'auto' | 'manual'
  prompt?: string
  count?: number
  brandId?: string
  cards?: ManualCardInput[]
  baseImageUrls?: string[] // Mode A — 프롬프트에 공통 첨부된 참조 이미지 1~3장
  clientIp?: string // 운영 로그 식별용 — DTO 가 아니라 컨트롤러에서 주입
  template?: 'basic' | 'product-ad' | 'promo'
}

interface DesignOut {
  layout: 'split-dark-left' | 'image-top-card-bottom' | 'fullbleed-center-glass'
  palette: { dominant: string; accent: string; textOnDominant: string }
  title: string
  subtitle: string
  body: string
  badgeLabel: string
  ctaLabel: string
  features: { icon: string; label: string }[]
  priceOriginal?: number
  priceSale?: number
  discountPercent?: number
  deadlineText: string
  decorations: string[]
}

interface CardOut {
  id: string
  title: string
  body: string
  subtext: string
  cta: string
  imageUrl?: string
  layout: Layout
  template?: 'basic' | 'product-ad' | 'promo'
  design?: DesignOut
  layoutDsl?: ValidatedLayoutDsl
}

// ============ 콘텐츠 프레임 (프롬프트 키워드 → 제목/본문/기본배경) ============
interface Topic {
  title: string
  body: string
  subtext: string
  bg: string // 단계 5: 토픽별 기본 배경
}

interface Frame {
  keywords: string[]
  coverSubtext: string
  coverCta: string
  coverBg: string // 단계 5
  topics: Topic[]
  ctaTitle: string
  ctaBody: string
  ctaCta: string
  ctaBg: string // 단계 5
}

const FRAMES: Frame[] = [
  {
    keywords: ['임산부', '임산', '산모', '임신', '태교', '산전'],
    coverSubtext: '임산부·가족 케어',
    coverCta: '자세히 보기 →',
    coverBg: BG_URLS.care,
    topics: [
      { title: '체계적인 건강 관리', body: '주차별 건강 상태를 함께 살피며 작은 변화도 세심하게 기록합니다.',      subtext: '정기 상담',     bg: BG_URLS.calm },
      { title: '영양과 휴식',        body: '산모와 태아의 균형을 생각한 식단과 편안한 공간을 제공합니다.',        subtext: '맞춤 식단',     bg: BG_URLS.meal },
      { title: '산전 상담',          body: '전문 상담사가 불안한 마음을 듣고 필요한 정보를 정리해 드립니다.',   subtext: '심리 지원',     bg: BG_URLS.calm },
      { title: '가족과 함께',        body: '보호자가 함께 참여하는 프로그램으로 든든한 동행이 되어 드립니다.', subtext: '보호자 연계', bg: BG_URLS.care },
    ],
    ctaTitle: '오늘도 평안한 하루',
    ctaBody: '임산부와 가족을 위한 맞춤 케어를 더 자세히 안내해 드립니다.',
    ctaCta: '상담 예약 →',
    ctaBg: BG_URLS.calm,
  },
  {
    keywords: ['유아', '영아', '아기', '어린이', '영유아', '육아', '데이케어'],
    coverSubtext: '영유아 케어',
    coverCta: '자세히 보기 →',
    coverBg: BG_URLS.care,
    topics: [
      { title: '안전한 환경',       body: '매일 점검하는 청결·소독·동선 설계로 안심할 수 있는 공간을 만듭니다.', subtext: '일일 점검',       bg: BG_URLS.calm },
      { title: '발달 단계 맞춤',   body: '월령에 맞춘 놀이와 활동으로 자연스러운 성장을 함께 지켜봅니다.',        subtext: '연령별 프로그램', bg: BG_URLS.program },
      { title: '건강한 식단',       body: '영양사와 함께 설계한 연령별 식단을 정성껏 차려냅니다.',                subtext: '영양사 설계',     bg: BG_URLS.meal },
      { title: '부모와 소통',       body: '오늘 하루의 이야기를 사진과 메모로 꾸준히 전해드립니다.',               subtext: '일일 알림장',     bg: BG_URLS.care },
    ],
    ctaTitle: '오늘도 평안한 하루',
    ctaBody: '아이의 하루와 부모의 마음 모두 세심히 살피는 이야기를 만나보세요.',
    ctaCta: '상담 예약 →',
    ctaBg: BG_URLS.calm,
  },
  {
    keywords: ['시니어', '어르신', '요양', '노인', '치매', '실버'],
    coverSubtext: '시니어 케어',
    coverCta: '하루 보기 →',
    coverBg: BG_URLS.morning,
    topics: [
      { title: '아침 산책',       body: '햇살 좋은 정원에서 시작하는 느린 산책으로 하루를 엽니다.', subtext: '하루의 시작', bg: BG_URLS.morning },
      { title: '영양 식단',       body: '부드럽고 균형 잡힌 식사를 영양사와 함께 준비합니다.',       subtext: '점심 · 저녁', bg: BG_URLS.meal },
      { title: '정서 프로그램',   body: '노래·그림·원예 등 취향에 맞춘 활동으로 오후를 채웁니다.',    subtext: '오후 활동',   bg: BG_URLS.program },
      { title: '가족 연계',       body: '하루의 기록을 가족에게 자주 전하여 안심의 연결을 이어갑니다.', subtext: '일일 공유', bg: BG_URLS.care },
    ],
    ctaTitle: '오늘도 평안한 하루',
    ctaBody: '가족처럼 돌보는 이야기를 더 듣고 싶다면 문의해 주세요.',
    ctaCta: '상담 문의 →',
    ctaBg: BG_URLS.calm,
  },
]

const DEFAULT_FRAME: Frame = {
  keywords: [],
  coverSubtext: '브랜드 이야기',
  coverCta: '자세히 보기 →',
  coverBg: BG_URLS.calm,
  topics: [
    { title: '핵심 가치',     body: '가장 중요하게 여기는 이야기를 담았습니다.',    subtext: '우리의 철학', bg: BG_URLS.morning },
    { title: '우리의 약속',   body: '정성을 담은 하루가 신뢰를 만든다고 믿습니다.', subtext: '약속',        bg: BG_URLS.meal },
    { title: '함께하는 여정', body: '여러분과 함께 걸어가는 길을 기록합니다.',      subtext: '동행',        bg: BG_URLS.program },
    { title: '따뜻한 돌봄',   body: '세심한 마음이 오늘의 안정으로 이어집니다.',    subtext: '세심함',      bg: BG_URLS.care },
  ],
  ctaTitle: '함께해 주세요',
  ctaBody: '더 궁금한 점이 있다면 언제든 문의해 주세요.',
  ctaCta: '문의하기 →',
  ctaBg: BG_URLS.calm,
}

function pickFrame(prompt: string): Frame {
  for (const f of FRAMES) {
    if (f.keywords.some((k) => prompt.includes(k))) return f
  }
  return DEFAULT_FRAME
}

function randId() {
  return Math.random().toString(36).slice(2, 10)
}

function clamp(n: number | undefined) {
  return Math.min(Math.max(Math.floor(n || 1), 1), 10)
}

function shorten(s: string, max: number): string {
  const t = s.trim().replace(/\s+/g, ' ')
  if (t.length <= max) return t
  const cut = t.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return (space > 6 ? cut.slice(0, space) : cut).trim() + '…'
}

function deriveLayout(i: number, n: number): Layout {
  if (i === 0) return 'cover'
  if (i === n - 1 && n > 1) return 'cta'
  return 'content'
}

function brandImagesOf(brand: any): string[] {
  return brand?.assets?.filter((a: any) => a.kind === 'image').map((a: any) => a.url) ?? []
}

// 이미지 우선순위
// 1) 수동 입력 imageUrl (manual 모드) / GPT 응답에 온 imageUrl
// 2) Mode A — 프롬프트에 공통 첨부된 참조 이미지 (round-robin 으로 분배)
// 3) 브랜드 에셋 (선택 시)
// 4) 프레임 기본 배경 (빈 페이지 방지)
function resolveImage(
  manual: string | undefined,
  brandImages: string[],
  frame: Frame,
  layout: Layout,
  topicIdx: number,
  baseImages: string[] = [],
  cardIdx = 0,
): string {
  if (manual) return manual
  if (baseImages.length) return baseImages[cardIdx % baseImages.length]
  if (brandImages.length) return brandImages[topicIdx % brandImages.length]
  if (layout === 'cover') return frame.coverBg
  if (layout === 'cta') return frame.ctaBg
  const t = frame.topics[topicIdx % frame.topics.length]
  return t.bg
}

function finalize(c: CardOut): CardOut {
  return {
    id: c.id,
    layout: c.layout,
    title: sanitizeText(c.title),
    body: sanitizeText(c.body),
    subtext: sanitizeText(c.subtext),
    cta: sanitizeText(c.cta),
    imageUrl: c.imageUrl,
  }
}

@Injectable()
export class GenerateService {
  constructor(private prisma: PrismaService) {}

  async run(input: GenInput): Promise<{ cards: CardOut[]; meta: GenMeta }> {
    const t0 = Date.now()

    // 1) 입력 안전 필터 — LLM 호출 전 NSFW/브랜드안전 위반 차단.
    const safetyInputs: string[] = []
    if (input.mode === 'auto') safetyInputs.push(input.prompt ?? '')
    if (input.mode === 'manual') {
      for (const c of input.cards ?? []) {
        safetyInputs.push(c.title ?? '', c.body ?? '', c.subtext ?? '', c.cta ?? '')
      }
    }
    const safety = checkSafety(...safetyInputs)
    if (safety.blocked) {
      await this.writeLog({
        input,
        outcome: 'blocked',
        source: null,
        retries: 0,
        durationMs: Date.now() - t0,
        timedOut: false,
        blockedBy: safety.category,
      })
      throw new BadRequestException(
        `입력에 허용되지 않는 표현이 포함되어 있습니다: ${safety.label} ("${safety.matched}")`,
      )
    }

    // 2) 브랜드 조회
    let brand: any = null
    if (input.brandId) {
      brand = await this.prisma.brandProfile.findUnique({
        where: { id: input.brandId },
        include: { assets: true },
      })
    }

    // 3) 생성 — baseImages 는 양 모드에서 공통 우선순위 적용
    const baseImages = (input.baseImageUrls ?? []).filter(
      (u): u is string => typeof u === 'string' && !!u.trim(),
    )
    // product-ad / promo 는 1장씩만 생성 (AI 구도 탐색용)
    const template = input.template ?? 'basic'
    const effectiveCount =
      template === 'product-ad' || template === 'promo' ? 1 : input.count ?? 3
    try {
      const built =
        input.mode === 'manual'
          ? this.wrapManual(input.cards ?? [], brand, baseImages)
          : await this.fromPrompt(input.prompt ?? '', effectiveCount, brand, baseImages)

      // LayoutDSL 자유 배치 — product-ad/promo 일 때 LLM 이 블록 배치를 매번 새로 설계.
      if (template === 'product-ad' || template === 'promo') {
        const dsls = await this.generateLayoutDsls(
          input.prompt ?? built.cards[0]?.title ?? '',
          built.cards.length,
          brand,
          template,
        )
        built.cards = built.cards.map((c, i) => {
          const dsl = dsls[i]
          const next: CardOut = { ...c, template }
          if (dsl) {
            next.layoutDsl = dsl
            // top-level 텍스트 필드는 DSL 블록에서 추출해 동기화
            const titleBlock = dsl.blocks.find((b: any) => b.type === 'title')
            const bodyBlock = dsl.blocks.find((b: any) => b.type === 'body')
            const subBlock = dsl.blocks.find((b: any) => b.type === 'subtitle')
            const ctaBlock = dsl.blocks.find((b: any) => b.type === 'cta')
            next.title = sanitizeText(titleBlock?.text ?? c.title)
            next.body = sanitizeText(bodyBlock?.text ?? c.body)
            next.subtext = sanitizeText(subBlock?.text ?? c.subtext)
            next.cta = sanitizeText(ctaBlock?.text ?? c.cta)
          }
          return next
        })
      } else {
        built.cards = built.cards.map((c) => ({ ...c, template: 'basic' as const }))
      }

      const meta: GenMeta = { ...built.meta, durationMs: Date.now() - t0 }
      const outcome: 'success' | 'partial' =
        meta.source === 'template' && input.mode === 'auto' && process.env.OPENAI_API_KEY
          ? 'partial'
          : meta.source === 'mixed'
            ? 'partial'
            : 'success'
      await this.writeLog({
        input,
        outcome,
        source: meta.source,
        retries: meta.retries,
        durationMs: meta.durationMs,
        timedOut: meta.timedOut,
        blockedBy: null,
      })
      return { cards: built.cards, meta }
    } catch (e) {
      await this.writeLog({
        input,
        outcome: 'failed',
        source: null,
        retries: 0,
        durationMs: Date.now() - t0,
        timedOut: false,
        blockedBy: null,
      })
      throw e
    }
  }

  private wrapManual(manual: ManualCardInput[], brand: any, baseImages: string[]): {
    cards: CardOut[]
    meta: Omit<GenMeta, 'durationMs'>
  } {
    const cards = this.fromManual(manual, brand, baseImages)
    return {
      cards,
      meta: {
        sources: cards.map(() => 'template' as const),
        retries: 0,
        source: 'template',
        timedOut: false,
      },
    }
  }

  private async writeLog(args: {
    input: GenInput
    outcome: 'success' | 'partial' | 'failed' | 'blocked'
    source: GenMeta['source'] | null
    retries: number
    durationMs: number
    timedOut: boolean
    blockedBy: string | null
  }): Promise<void> {
    const logger = new Logger('GenerateService')
    const { input } = args
    const promptText =
      input.mode === 'auto'
        ? input.prompt ?? ''
        : (input.cards ?? []).map((c) => [c.title, c.body, c.subtext, c.cta].join(' ')).join(' | ')
    const promptHash = promptText
      ? createHash('sha256').update(promptText).digest('hex').slice(0, 16)
      : null
    const promptPreview = promptText ? promptText.slice(0, 80) : null
    try {
      await this.prisma.generationLog.create({
        data: {
          mode: input.mode,
          brandId: input.brandId ?? null,
          promptHash,
          promptPreview,
          count: input.mode === 'auto' ? input.count ?? 0 : (input.cards ?? []).length,
          outcome: args.outcome,
          source: args.source ?? null,
          retries: args.retries,
          durationMs: args.durationMs,
          timedOut: args.timedOut,
          blockedBy: args.blockedBy,
          clientIp: input.clientIp ?? null,
        },
      })
    } catch (e: any) {
      // 감사 로그 실패가 사용자 요청을 깨뜨리면 안 되므로 경고만 남기고 삼킨다.
      logger.warn(`GenerationLog 저장 실패 (무시하고 진행): ${e?.message ?? e}`)
    }
  }

  // ── 수동 입력 정규화 ─────────────────────────────
  private fromManual(manual: ManualCardInput[], brand: any, baseImages: string[] = []): CardOut[] {
    const n = manual.length
    const brandImages = brandImagesOf(brand)
    const brandName: string = brand?.name ?? ''
    const brandPhrase: string = brand?.defaultPhrase ?? ''
    const frame = DEFAULT_FRAME // 수동 모드는 프롬프트가 없으므로 기본 프레임으로 배경 폴백

    return manual.map((m, i) => {
      const layout: Layout = m.layout ?? deriveLayout(i, n)

      const titleFallback =
        layout === 'cta' ? brandPhrase || '함께해 주세요'
        : layout === 'cover' ? (brandName || '새로운 이야기')
        : `포인트 ${i}`

      const bodyFallback =
        layout === 'cta' ? '더 궁금한 점이 있다면 언제든 문의해 주세요.'
        : layout === 'cover' ? (brandPhrase || '정성을 담아 준비했습니다.')
        : ''

      const subtextFallback =
        layout === 'cover' ? (brandName || '') : ''

      const ctaFallback =
        layout === 'cta' ? '문의하기 →'
        : layout === 'cover' ? '자세히 보기 →'
        : ''

      const topicIdx = layout === 'content' ? Math.max(0, i - 1) : i

      return finalize({
        id: randId(),
        title: m.title || titleFallback,
        body: m.body || bodyFallback,
        subtext: m.subtext || subtextFallback,
        cta: m.cta || ctaFallback,
        imageUrl: resolveImage(m.imageUrl, brandImages, frame, layout, topicIdx, baseImages, i),
        layout,
      })
    })
  }

  // ── 프롬프트 기반 생성 (재시도 + 카드별 부분 폴백) ────────────────────────────
  private async fromPrompt(
    prompt: string,
    countRaw: number,
    brand: any,
    baseImages: string[] = [],
  ): Promise<{ cards: CardOut[]; meta: Omit<GenMeta, 'durationMs'> }> {
    const n = clamp(countRaw)
    const frame = pickFrame(prompt)
    const templateCards = this.template(prompt, n, brand, frame, baseImages)

    // LLM 우선순위: Gemini 가 있으면 Gemini (재시도 포함), 없으면 OpenAI, 없으면 템플릿.
    let llmAttempt: LlmAttempt | null = null
    if (process.env.GEMINI_API_KEY) {
      llmAttempt = await this.callGeminiWithRetry(prompt, n, brand)
    } else if (process.env.OPENAI_API_KEY) {
      llmAttempt = await this.callLlmWithRetry(prompt, n, brand)
    }

    const brandImages = brandImagesOf(brand)
    const sources: CardSource[] = []
    const cards: CardOut[] = []
    for (let i = 0; i < n; i++) {
      const v = llmAttempt?.cards[i] ?? null
      if (v) {
        const topicIdx = v.layout === 'content' ? Math.max(0, i - 1) : i
        cards.push(
          finalize({
            id: randId(),
            title: v.title,
            body: v.body,
            subtext: v.subtext,
            cta: v.cta,
            imageUrl: resolveImage(undefined, brandImages, frame, v.layout, topicIdx, baseImages, i),
            layout: v.layout,
          }),
        )
        sources.push('llm')
      } else {
        cards.push(templateCards[i])
        sources.push('template')
      }
    }
    const allLlm = sources.every((s) => s === 'llm')
    const allTpl = sources.every((s) => s === 'template')
    const source: GenMeta['source'] = allLlm ? 'llm' : allTpl ? 'template' : 'mixed'
    return {
      cards,
      meta: {
        sources,
        retries: llmAttempt?.retries ?? 0,
        source,
        timedOut: llmAttempt?.timedOut ?? false,
      },
    }
  }

  private template(prompt: string, n: number, brand: any, frame: Frame, baseImages: string[] = []): CardOut[] {
    const brandImages = brandImagesOf(brand)
    const brandName: string = brand?.name ?? ''
    const brandPhrase: string = brand?.defaultPhrase || frame.ctaTitle
    const key = shorten(prompt, 22) || brandName || '새로운 이야기'

    const cards: CardOut[] = []
    for (let i = 0; i < n; i++) {
      const layout = deriveLayout(i, n)
      let title = '', body = '', subtext = '', cta = ''
      const topicIdx = layout === 'content' ? (i - 1) % Math.max(frame.topics.length, 1) : i

      if (layout === 'cover') {
        title = brandName ? `${brandName} · ${key}` : key
        body = prompt.trim() ? shorten(prompt, 80) : '정성을 담아 준비했습니다.'
        subtext = brandName ? `${brandName} · ${frame.coverSubtext}` : frame.coverSubtext
        cta = frame.coverCta
      } else if (layout === 'cta') {
        title = brandPhrase
        body = frame.ctaBody
        subtext = brandName ? `${brandName} 드림` : ''
        cta = frame.ctaCta
      } else {
        const topic = frame.topics[topicIdx]
        title = topic.title
        body = topic.body
        subtext = topic.subtext
        cta = ''
      }

      cards.push(
        finalize({
          id: randId(),
          title, body, subtext, cta,
          imageUrl: resolveImage(undefined, brandImages, frame, layout, topicIdx, baseImages, i),
          layout,
        }),
      )
    }
    return cards
  }

  // Gemini 경로 (재시도 3회 + 카드별 부분 폴백). 우선 순위: Gemini > OpenAI > 템플릿.
  private async callGeminiWithRetry(prompt: string, n: number, brand: any): Promise<LlmAttempt | null> {
    const BACKOFFS_MS = [500, 1000, 2000]
    const logger = new (require('@nestjs/common').Logger)('GenerateService')
    const recipe = buildStyleRecipe(brand)
    const systemInstruction = [
      '한국어 카드뉴스 카피라이터. 과장/의학적 단정/절대 표현 금지. 따뜻하고 신뢰감 있는 톤.',
      '각 카드는 {title, body, subtext, cta, layout} 5개 필드를 모두 포함한다.',
      '시리즈의 n장은 동일 룩앤필·톤을 공유하며 한 편의 흐름으로 이어진다.',
    ].join(' ')
    const userText = [
      recipeAsPromptBlock(recipe),
      '',
      `주제: ${prompt}`,
      `브랜드: ${brand?.name ?? '미지정'}`,
      `톤: ${brand?.tone ?? '따뜻하고 진솔한'}`,
      `기본 문구: ${brand?.defaultPhrase ?? ''}`,
      `카드 수: ${n}`,
      `규칙: 첫 카드 layout=cover, 마지막 layout=cta, 나머지 layout=content.`,
      `길이 상한: title ${CARD_LIMITS.title}자, body ${CARD_LIMITS.body}자, subtext ${CARD_LIMITS.subtext}자, cta ${CARD_LIMITS.cta}자.`,
      'subtext/cta 불필요 시 빈 문자열로 두고 필드는 반드시 포함.',
      '❌ 절대 금지 (매우 중요): cta·subtext·title·body 어디에도 "1/5", "2/5", "3/10", "1 of 5", "page 2", "(1/5)" 같은 페이지 번호·순번 표시를 넣지 말 것. 카드뉴스 이미지에 찍히면 완전히 지저분해 보임.',
    ].join('\n')

    let anyTimedOut = false
    for (let attempt = 0; attempt <= BACKOFFS_MS.length; attempt++) {
      try {
        const parsed = await callGeminiJson<{ cards: unknown[] }>({
          systemInstruction,
          userText,
          schema: cardArraySchema(n),
          timeoutMs: LLM_TIMEOUT_MS,
          temperature: 0.7,
        })
        const arr = Array.isArray(parsed?.cards) ? parsed.cards : []
        if (arr.length) {
          const out: (ValidatedCard | null)[] = new Array(n).fill(null)
          for (let i = 0; i < Math.min(arr.length, n); i++) out[i] = validateCard(arr[i])
          if (out.some((c) => c !== null)) {
            if (attempt > 0) logger.warn(`Gemini ${attempt}회 재시도 후 성공`)
            return { cards: out, retries: attempt, timedOut: anyTimedOut }
          }
        }
      } catch (e: any) {
        if (e?.name === 'AbortError' || /abort/i.test(e?.message ?? '')) anyTimedOut = true
        logger.warn(`Gemini 시도 ${attempt} 실패: ${e?.message ?? e}`)
      }
      if (attempt < BACKOFFS_MS.length) await sleep(BACKOFFS_MS[attempt])
    }
    return { cards: new Array(n).fill(null), retries: BACKOFFS_MS.length, timedOut: anyTimedOut }
  }

  // 최대 3회 재시도. 어떤 카드라도 유효하게 파싱되면 성공으로 간주 (부분 완성 허용).
  // 모든 카드가 null 이거나 네트워크/파싱 실패면 다음 시도. 개별 호출은 LLM_TIMEOUT_MS 에서 abort.
  private async callLlmWithRetry(prompt: string, n: number, brand: any): Promise<LlmAttempt | null> {
    const BACKOFFS_MS = [500, 1000, 2000]
    const logger = new (require('@nestjs/common').Logger)('GenerateService')
    let anyTimedOut = false
    for (let attempt = 0; attempt <= BACKOFFS_MS.length; attempt++) {
      const { cards: result, timedOut } = await this.callLlmOnce(prompt, n, brand)
      if (timedOut) anyTimedOut = true
      if (result && result.some((c) => c !== null)) {
        if (attempt > 0) logger.warn(`OpenAI ${attempt}회 재시도 후 성공`)
        return { cards: result, retries: attempt, timedOut: anyTimedOut }
      }
      if (attempt < BACKOFFS_MS.length) await sleep(BACKOFFS_MS[attempt])
    }
    return { cards: new Array(n).fill(null), retries: BACKOFFS_MS.length, timedOut: anyTimedOut }
  }

  // 1회 호출. cards: null = 전체 실패(네트워크/HTTP/JSON 파싱/타임아웃). 배열 = 인덱스별 검증 결과.
  private async callLlmOnce(
    prompt: string,
    n: number,
    brand: any,
  ): Promise<{ cards: (ValidatedCard | null)[] | null; timedOut: boolean }> {
    const logger = new (require('@nestjs/common').Logger)('GenerateService')
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS)
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        signal: controller.signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.6,
          response_format: OPENAI_RESPONSE_FORMAT,
          messages: [
            {
              role: 'system',
              content: [
                '한국어 카드뉴스 카피라이터. 과장/의학적 단정/절대 표현 금지. 따뜻하고 신뢰감 있는 톤.',
                '각 카드는 {title, body, subtext, cta, layout} 5개 필드를 모두 포함한다.',
                '시리즈의 5장은 동일한 브랜드 룩앤필과 톤을 공유해야 한다 — 단어 선택·문장 리듬·마감 감각을 일관되게 유지한다.',
              ].join(' '),
            },
            {
              role: 'user',
              content: [
                recipeAsPromptBlock(buildStyleRecipe(brand)),
                '',
                `주제: ${prompt}`,
                `브랜드: ${brand?.name ?? '미지정'}`,
                `톤: ${brand?.tone ?? '따뜻하고 진솔한'}`,
                `기본 문구: ${brand?.defaultPhrase ?? ''}`,
                `카드 수: ${n}`,
                '',
                `규칙: 첫 카드 layout=cover, 마지막 layout=cta, 나머지 layout=content.`,
                `길이 상한: title ${CARD_LIMITS.title}자, body ${CARD_LIMITS.body}자, subtext ${CARD_LIMITS.subtext}자, cta ${CARD_LIMITS.cta}자.`,
                `subtext/cta 가 불필요한 카드는 빈 문자열("")로 두고 필드는 반드시 포함한다.`,
                `❌ 절대 금지 (매우 중요): cta·subtext·title·body 어디에도 "1/5", "2/5", "3/10", "1 of 5", "page 2", "(1/5)" 같은 페이지 번호·순번 표시를 넣지 말 것. 카드뉴스 이미지에 찍히면 완전히 지저분해 보임.`,
                `일관성: 위 스타일 가이드의 팔레트/조명/구도/폰트 분위기를 모든 카드에 동일하게 반영한다.`,
              ].join('\n'),
            },
          ],
        }),
      })
      if (!res.ok) {
        logger.warn(`OpenAI 응답 비정상 (HTTP ${res.status})`)
        return { cards: null, timedOut: false }
      }
      const j: any = await res.json()
      const content = j?.choices?.[0]?.message?.content
      if (!content) {
        logger.warn('OpenAI 응답 content 비어있음')
        return { cards: null, timedOut: false }
      }
      const parsed = JSON.parse(content)
      if (!Array.isArray(parsed.cards)) {
        logger.warn('OpenAI 응답 cards 배열 파싱 실패')
        return { cards: null, timedOut: false }
      }

      // 길이 n 을 맞춘다 — 부족한 슬롯은 null (템플릿으로 메꿈), 초과는 절삭.
      const out: (ValidatedCard | null)[] = new Array(n).fill(null)
      for (let i = 0; i < Math.min(parsed.cards.length, n); i++) {
        const v = validateCard(parsed.cards[i])
        if (!v) logger.warn(`카드 ${i} 스키마 검증 실패 — 해당 슬롯만 템플릿으로 폴백`)
        out[i] = v
      }
      return { cards: out, timedOut: false }
    } catch (e: any) {
      const aborted = e?.name === 'AbortError' || controller.signal.aborted
      if (aborted) {
        logger.warn(`OpenAI 호출 타임아웃(${LLM_TIMEOUT_MS}ms) — 재시도로 넘김`)
        return { cards: null, timedOut: true }
      }
      logger.warn(`OpenAI 호출 예외: ${e?.message ?? e}`)
      return { cards: null, timedOut: false }
    } finally {
      clearTimeout(timeoutId)
    }
  }

  // LayoutDSL 자유 배치 — 블록 단위로 LLM 이 직접 배치 설계.
  private async generateLayoutDsls(
    prompt: string,
    n: number,
    brand: any,
    template: 'product-ad' | 'promo',
  ): Promise<(ValidatedLayoutDsl | null)[]> {
    const logger = new Logger('GenerateService')
    if (!process.env.GEMINI_API_KEY) {
      logger.warn('GEMINI_API_KEY 없음 — LayoutDSL 스킵')
      return Array(n).fill(null)
    }
    const recipe = brand ? buildStyleRecipe(brand) : null
    const brandPrimary = typeof brand?.primaryColor === 'string' ? brand.primaryColor : '#4338ca'

    const sys = [
      '한국 SNS 카드뉴스 AI 레이아웃 디자이너. 템플릿을 쓰지 않고 매번 새로운 구도를 설계한다.',
      '출력은 canvas + blocks 배열. blocks 은 5~10개, rect 는 [x,y,w,h] 퍼센트(0~100).',
      '블록 종류: image / title / subtitle / body / badge / price / features / cta / swatch / decor.',
      '규칙: title·body·cta 필수. image 는 30~70% 만 차지. 겹침 시 decor(mask-gradient) 로 가독성 확보.',
      'image.url 은 반드시 "{{image}}". HEX 컬러, 대비 높게. 매 생성마다 다른 구도.',
      '페이지 번호·과장·의학 단정 금지.',
    ].join(' ')
    const userText = [
      recipe ? recipeAsPromptBlock(recipe) : '',
      '',
      `주제: ${prompt}`,
      `브랜드: ${brand?.name ?? '미지정'} (primary ${brandPrimary})`,
      `카드 수: ${n}`,
      `템플릿 방향: ${template === 'promo' ? '이벤트·세일' : '상품 광고'}`,
      'canvas.w=1080, h 는 1080/1350/1920 중 하나.',
    ].filter(Boolean).join('\n')

    try {
      const parsed = await callGeminiJson<{ cards: unknown[] }>({
        systemInstruction: sys,
        userText,
        schema: layoutDslSchema(n),
        timeoutMs: LLM_TIMEOUT_MS,
        temperature: 1.0,
      })
      if (!parsed || !Array.isArray(parsed.cards)) return Array(n).fill(null)
      const out: (ValidatedLayoutDsl | null)[] = []
      for (let i = 0; i < n; i++) {
        out.push(validateLayoutDsl(parsed.cards[i]))
      }
      return out
    } catch (e: any) {
      logger.warn(`Gemini LayoutDSL 실패: ${e?.message ?? e}`)
      return Array(n).fill(null)
    }
  }

  // AI 가 layout·palette·decorations 까지 결정하는 DynamicDesign 카드 생성. (레거시)
  // auto/manual 모드에서 product-ad/promo 템플릿 선택 시 호출 — RAG 없이 프롬프트+브랜드톤으로 생성.
  private async generateDynamicDesigns(
    prompt: string,
    n: number,
    brand: any,
    template: 'product-ad' | 'promo',
  ): Promise<(ValidatedDynamicDesign | null)[]> {
    const logger = new Logger('GenerateService')
    if (!process.env.GEMINI_API_KEY) {
      logger.warn(`GEMINI_API_KEY 없음 — DynamicDesign 스킵`)
      return Array(n).fill(null)
    }
    const recipe = brand ? buildStyleRecipe(brand) : null
    const brandPrimary = typeof brand?.primaryColor === 'string' ? brand.primaryColor : '#4338ca'

    const layoutHint =
      template === 'promo'
        ? '이벤트·세일은 fullbleed-center-glass 또는 image-top-card-bottom 권장.'
        : '상품 광고는 split-dark-left 또는 image-top-card-bottom 권장.'

    const sys = [
      '한국 SNS 카드뉴스 AI 디자이너. 단순한 카피라이터가 아니라 구도·컬러·장식까지 스스로 정한다.',
      '출력은 layout/palette/title/subtitle/body/badgeLabel/ctaLabel/features/priceOriginal/priceSale/discountPercent/deadlineText/decorations/cardLayout.',
      'layout 중 하나를 고르세요:',
      '  · split-dark-left: 좌측 어두운 패널 + 우측 이미지',
      '  · image-top-card-bottom: 상단 이미지 + 하단 솔리드 카드',
      '  · fullbleed-center-glass: 풀블리드 + 중앙 프로스티드 박스 + 큰 숫자',
      layoutHint,
      'palette.dominant = 주 배경 HEX (어두운 톤 권장). palette.accent = 뱃지·CTA 강조색. palette.textOnDominant = dominant 위 글자색.',
      '매 생성마다 layout·palette·decorations 조합을 다르게.',
      'discountPercent 를 포함하면 decorations 에 "discount-circle" 또는 "big-number" 반드시 추가.',
      'icon 은 단일 이모지. 과장·의학적 단정·페이지 번호 금지.',
    ].join(' ')

    const userText = [
      recipe ? recipeAsPromptBlock(recipe) : '',
      '',
      `주제: ${prompt}`,
      `브랜드: ${brand?.name ?? '미지정'} (primary ${brandPrimary})`,
      `카드 수: ${n}`,
      `템플릿 방향: ${template === 'promo' ? '이벤트·세일 (긴장감·대담)' : '상품 광고 (정보 밀집·신뢰)'}`,
      `길이 상한: title ${CARD_LIMITS.title}, body ${CARD_LIMITS.body}, cta ${CARD_LIMITS.cta}`,
    ].filter(Boolean).join('\n')

    try {
      const parsed = await callGeminiJson<{ cards: unknown[] }>({
        systemInstruction: sys,
        userText,
        schema: dynamicDesignArraySchema(n),
        timeoutMs: LLM_TIMEOUT_MS,
        temperature: 0.9,
      })
      if (!parsed || !Array.isArray(parsed.cards)) return Array(n).fill(null)
      const out: (ValidatedDynamicDesign | null)[] = []
      for (let i = 0; i < n; i++) {
        out.push(validateDynamicDesign(parsed.cards[i]))
      }
      return out
    } catch (e: any) {
      logger.warn(`Gemini DynamicDesign 실패 — null 폴백: ${e?.message ?? e}`)
      return Array(n).fill(null)
    }
  }
}
