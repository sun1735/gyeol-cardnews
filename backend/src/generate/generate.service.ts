import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { sanitizeText } from './sanitize'
import { BG_URLS } from '../backgrounds/defaults'

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
}

interface CardOut {
  id: string
  title: string
  body: string
  subtext: string
  cta: string
  imageUrl?: string
  layout: Layout
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
  return Math.min(Math.max(Math.floor(n || 1), 1), 5)
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

// 단계 5: 이미지 우선순위
// 1) 수동 입력 imageUrl (manual 모드) / GPT 응답에 온 imageUrl
// 2) 브랜드 에셋 (선택 시)
// 3) 프레임 기본 배경 (빈 페이지 방지)
function resolveImage(
  manual: string | undefined,
  brandImages: string[],
  frame: Frame,
  layout: Layout,
  topicIdx: number,
): string {
  if (manual) return manual
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

  async run(input: GenInput): Promise<{ cards: CardOut[] }> {
    let brand: any = null
    if (input.brandId) {
      brand = await this.prisma.brandProfile.findUnique({
        where: { id: input.brandId },
        include: { assets: true },
      })
    }
    const cards =
      input.mode === 'manual'
        ? this.fromManual(input.cards ?? [], brand)
        : await this.fromPrompt(input.prompt ?? '', input.count ?? 3, brand)
    return { cards }
  }

  // ── 수동 입력 정규화 ─────────────────────────────
  private fromManual(manual: ManualCardInput[], brand: any): CardOut[] {
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
        layout === 'cover' ? (brandName || '') : `${i + 1} / ${n}`

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
        imageUrl: resolveImage(m.imageUrl, brandImages, frame, layout, topicIdx),
        layout,
      })
    })
  }

  // ── 프롬프트 기반 생성 ────────────────────────────
  private async fromPrompt(prompt: string, countRaw: number, brand: any): Promise<CardOut[]> {
    const n = clamp(countRaw)
    const frame = pickFrame(prompt)
    if (process.env.OPENAI_API_KEY) {
      const gpt = await this.tryGpt(prompt, n, brand, frame)
      if (gpt) return gpt
    }
    return this.template(prompt, n, brand, frame)
  }

  private template(prompt: string, n: number, brand: any, frame: Frame): CardOut[] {
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
        cta = `${i + 1} / ${n}`
      }

      cards.push(
        finalize({
          id: randId(),
          title, body, subtext, cta,
          imageUrl: resolveImage(undefined, brandImages, frame, layout, topicIdx),
          layout,
        }),
      )
    }
    return cards
  }

  private async tryGpt(prompt: string, n: number, brand: any, frame: Frame): Promise<CardOut[] | null> {
    const logger = new (require('@nestjs/common').Logger)('GenerateService')
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          temperature: 0.6,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                '한국어 카드뉴스 카피라이터. 과장/의학적 단정/절대 표현 금지. 따뜻하고 신뢰감 있는 톤. ' +
                '반드시 JSON만 반환하며 각 카드는 {title, body, subtext, cta, layout} 5개 필드를 모두 포함한다.',
            },
            {
              role: 'user',
              content: [
                `주제: ${prompt}`,
                `브랜드: ${brand?.name ?? '미지정'}`,
                `톤: ${brand?.tone ?? '따뜻하고 진솔한'}`,
                `기본 문구: ${brand?.defaultPhrase ?? ''}`,
                `카드 수: ${n}`,
                '',
                'JSON 스키마: {"cards":[{"title":"...","body":"...","subtext":"...","cta":"...","layout":"cover|content|cta"}]}',
                '규칙: 첫 카드 cover, 마지막 cta, 나머지 content. title 18자, body 80자, subtext 20자, cta 12자 이내.',
              ].join('\n'),
            },
          ],
        }),
      })
      if (!res.ok) {
        logger.warn(`OpenAI 응답 비정상 (HTTP ${res.status}) — 템플릿 폴백`)
        return null
      }
      const j: any = await res.json()
      const content = j?.choices?.[0]?.message?.content
      if (!content) {
        logger.warn('OpenAI 응답 content 비어있음 — 템플릿 폴백')
        return null
      }
      const parsed = JSON.parse(content)
      if (!Array.isArray(parsed.cards) || !parsed.cards.length) {
        logger.warn('OpenAI 응답 cards 배열 파싱 실패 — 템플릿 폴백')
        return null
      }

      const brandImages = brandImagesOf(brand)
      return parsed.cards.slice(0, n).map((c: any, i: number) => {
        const layout = (['cover', 'content', 'cta'].includes(c.layout) ? c.layout : deriveLayout(i, n)) as Layout
        const topicIdx = layout === 'content' ? Math.max(0, i - 1) : i
        return finalize({
          id: randId(),
          title: String(c.title ?? ''),
          body: String(c.body ?? ''),
          subtext: String(c.subtext ?? ''),
          cta: String(c.cta ?? ''),
          imageUrl: resolveImage(undefined, brandImages, frame, layout, topicIdx),
          layout,
        })
      })
    } catch (e: any) {
      logger.warn(`OpenAI 호출 실패 — 템플릿 폴백: ${e?.message ?? e}`)
      return null
    }
  }
}
