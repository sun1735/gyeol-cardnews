// Phase 3 — 검색·카피·이미지 편집을 한 흐름으로 묶는 오케스트레이터.
// 순서:
//   1) 브랜드·knowledge 청크·이미지 라이브러리 로드
//   2) 프롬프트 안전 필터
//   3) 스토리보드 구성 (cover/content/cta)
//   4) LLM 카피 생성 (RAG 컨텍스트 주입, 실패 시 템플릿 폴백)
//   5) 카드별 이미지 후보 랭킹
//   6) Promise.allSettled 병렬 이미지 편집 — 일부 실패 시 원본 URL 폴백
//   7) sanitize + schema 검증

import { Injectable, Logger } from '@nestjs/common'
import { join, normalize } from 'path'
import { PrismaService } from '../prisma/prisma.service'
import { sanitizeText } from '../generate/sanitize'
import { validateCard, CARD_LIMITS, ValidatedCard } from '../generate/schema'
import { buildStyleRecipe, recipeAsPromptBlock, StyleRecipe } from '../generate/style'
import { checkSafety } from '../generate/safety'
import { callGeminiJson, cardArraySchema } from '../generate/llm-gemini'
import { editImageWithGemini, saveEditedImage } from '../images/editor'
import { GenerateFromNoteDto } from './dto/generate-from-note.dto'
import { KnowledgeSearchService, RetrievedChunk } from './knowledge-search.service'
import { ImageRankerService, RankedImage } from './image-ranker.service'

type Layout = 'cover' | 'content' | 'cta'

interface CardOut {
  id: string
  layout: Layout
  title: string
  body: string
  subtext: string
  cta: string
  imageUrl?: string
}

export interface OrchestratorResult {
  cards: CardOut[]
  meta: {
    source: 'note_rag'
    chunksUsed: number
    imagesRanked: number
    edited: number
    durationMs: number
    partial: boolean
  }
  partial: boolean
}

const LLM_TIMEOUT_MS = 20_000

@Injectable()
export class Orchestrator {
  private readonly logger = new Logger('Orchestrator')

  constructor(
    private prisma: PrismaService,
    private search: KnowledgeSearchService,
    private ranker: ImageRankerService,
  ) {}

  async run(
    dto: GenerateFromNoteDto,
    setProgress: (p: number) => Promise<void>,
  ): Promise<OrchestratorResult> {
    const t0 = Date.now()

    // 1) 안전 필터
    const safety = checkSafety(dto.prompt)
    if (safety.blocked) {
      throw new Error(`입력 차단: ${safety.label} ("${safety.matched}")`)
    }

    // 2) 브랜드 조회
    const brand = await this.prisma.brandProfile.findUnique({
      where: { id: dto.brandId },
      include: { assets: true },
    })
    if (!brand) throw new Error('brandId 가 유효하지 않습니다')
    const recipe = buildStyleRecipe(brand)
    await setProgress(10)

    // 3) 지식노트 검색
    const chunks = await this.search.retrieve(dto.brandId, dto.prompt, 8)
    await setProgress(25)

    // 4) 스토리보드 (cover / content / cta)
    const n = dto.count
    const layouts = buildLayouts(n)

    // 5) LLM 카피 생성 (컨텍스트 주입, 실패 시 템플릿 폴백)
    const copies = await this.generateCopy(dto.prompt, n, layouts, brand, recipe, chunks)
    await setProgress(55)

    // 6) 이미지 후보 랭킹
    const ranked = await this.ranker.rankForCards(dto.brandId, dto.prompt, copies)
    const imagesRanked = ranked.filter((r) => !!r).length
    await setProgress(65)

    // 7) 병렬 이미지 편집
    const refs = (dto.baseImageUrls ?? []).filter((u) => u?.startsWith('/uploads/'))
    const editResults = await this.parallelEdit(copies, ranked, refs, recipe)
    const editedCount = editResults.filter((r) => r.status === 'edited').length
    const editFailed = editResults.filter((r) => r.status === 'failed').length
    await setProgress(90)

    // 8) 최종 카드 조립 (sanitize 포함)
    const cards: CardOut[] = copies.map((c, i) => ({
      id: randId(),
      layout: layouts[i],
      title: sanitizeText(c.title),
      body: sanitizeText(c.body),
      subtext: sanitizeText(c.subtext),
      cta: sanitizeText(c.cta),
      imageUrl: editResults[i].url ?? undefined,
    }))

    const partial = editFailed > 0
    return {
      cards,
      partial,
      meta: {
        source: 'note_rag',
        chunksUsed: chunks.length,
        imagesRanked,
        edited: editedCount,
        durationMs: Date.now() - t0,
        partial,
      },
    }
  }

  // 카드 레이아웃별로 LLM 카피 생성. Gemini 2.5 Flash 우선, 실패 시 템플릿 폴백.
  private async generateCopy(
    prompt: string,
    n: number,
    layouts: Layout[],
    brand: any,
    recipe: StyleRecipe,
    chunks: RetrievedChunk[],
  ): Promise<ValidatedCard[]> {
    const templateCopies = buildTemplateCopies(prompt, brand, layouts)
    if (!process.env.GEMINI_API_KEY) {
      this.logger.warn('GEMINI_API_KEY 없음 — 템플릿 폴백 (RAG 컨텍스트 반영 불가)')
      return templateCopies
    }

    const contextBlock = chunks.length
      ? chunks.map((c, i) => `[${i + 1}] ${c.docTitle}: ${c.text}`).join('\n---\n')
      : '(브랜드 지식노트가 비어 있음 — 프롬프트와 브랜드 톤만으로 작성)'

    const systemInstruction = [
      '한국어 카드뉴스 카피라이터. 과장/의학적 단정/절대 표현 금지. 따뜻하고 신뢰감 있는 톤.',
      '각 카드는 {title, body, subtext, cta, layout} 5개 필드를 모두 포함한다.',
      '브랜드 지식노트가 제공되면 반드시 해당 사실을 근거로 삼고, 구체적 내용·숫자·고유명사는 노트에서 가져올 것.',
      '노트가 비어있으면 브랜드 톤과 프롬프트만으로 작성.',
    ].join(' ')

    const userText = [
      recipeAsPromptBlock(recipe),
      '',
      '[브랜드 지식노트 발췌 — 근거로 활용, 인용은 자연스럽게]',
      contextBlock,
      '',
      `주제: ${prompt}`,
      `브랜드: ${brand?.name ?? '미지정'}`,
      `카드 수: ${n}`,
      `레이아웃 순서: ${layouts.join(', ')}`,
      `길이 상한: title ${CARD_LIMITS.title}, body ${CARD_LIMITS.body}, subtext ${CARD_LIMITS.subtext}, cta ${CARD_LIMITS.cta} (한국어 기준)`,
      'subtext/cta 불필요 시 빈 문자열로 두고 필드는 반드시 포함.',
      '❌ 절대 금지 (매우 중요): cta·subtext·title·body 어디에도 "1/5", "2/5", "3/10", "1 of 5", "page 2", "(1/5)" 같은 페이지 번호·순번 표시를 넣지 말 것. 필요 없으면 빈 문자열. 카드뉴스 이미지 위에 찍히면 완전히 지저분해 보임.',
    ].join('\n')

    try {
      const parsed = await callGeminiJson<{ cards: unknown[] }>({
        systemInstruction,
        userText,
        schema: cardArraySchema(n),
        timeoutMs: LLM_TIMEOUT_MS,
        temperature: 0.7,
      })
      if (!parsed || !Array.isArray(parsed.cards)) return templateCopies
      const out: ValidatedCard[] = []
      for (let i = 0; i < n; i++) {
        const v = validateCard(parsed.cards[i])
        out.push(v ?? templateCopies[i])
      }
      return out
    } catch (e: any) {
      this.logger.warn(`Gemini 호출 예외 — 템플릿 폴백: ${e?.message ?? e}`)
      return templateCopies
    }
  }

  private async parallelEdit(
    copies: ValidatedCard[],
    ranked: (RankedImage | null)[],
    refs: string[],
    recipe: StyleRecipe,
  ): Promise<Array<{ url: string | null; status: 'edited' | 'original' | 'failed' }>> {
    const jobs = copies.map((c, i) =>
      this.editOne(c, ranked[i], refs, i, recipe).catch((e) => {
        this.logger.warn(`카드 ${i} 이미지 편집 실패: ${e?.message ?? e}`)
        const fallback = ranked[i]?.url ?? (refs.length ? refs[i % refs.length] : null)
        return { url: fallback, status: 'failed' as const }
      }),
    )
    return Promise.all(jobs)
  }

  private async editOne(
    copy: ValidatedCard,
    image: RankedImage | null,
    refs: string[],
    cardIdx: number,
    recipe: StyleRecipe,
  ): Promise<{ url: string | null; status: 'edited' | 'original' | 'failed' }> {
    // 카드별 베이스: 랭커 결과 우선, 없으면 참조 이미지 round-robin
    const baseUrl = image?.url ?? (refs.length ? refs[cardIdx % refs.length] : null)
    if (!baseUrl) return { url: null, status: 'original' }
    if (!process.env.GEMINI_API_KEY) return { url: baseUrl, status: 'original' }

    // SVG 는 Gemini 가 거절 — 편집 없이 원본 URL 그대로 사용
    if (baseUrl.endsWith('.svg')) return { url: baseUrl, status: 'original' }

    const basePath = resolveUploadPath(baseUrl)
    const refPaths: string[] = []
    for (const r of refs) {
      if (r.endsWith('.svg')) continue // 참조 SVG 도 스킵
      try {
        refPaths.push(resolveUploadPath(r))
      } catch {}
    }
    const result = await editImageWithGemini({
      basePath,
      refPaths,
      recipe,
      instruction: `${copy.title} · ${copy.body}`.slice(0, 200),
    })
    const url = await saveEditedImage(result.bytes, result.mimeType)
    return { url, status: 'edited' }
  }
}

function buildLayouts(n: number): Layout[] {
  const out: Layout[] = []
  for (let i = 0; i < n; i++) {
    out.push(i === 0 ? 'cover' : i === n - 1 ? 'cta' : 'content')
  }
  return out
}

function buildTemplateCopies(prompt: string, brand: any, layouts: Layout[]): ValidatedCard[] {
  const name = brand?.name ?? '브랜드'
  const phrase = brand?.defaultPhrase ?? '함께해 주세요'
  const key = prompt.trim().slice(0, 18) || name
  return layouts.map((layout, i) => {
    if (layout === 'cover') {
      return {
        layout,
        title: key,
        body: prompt.trim().slice(0, 80) || '정성을 담아 준비했습니다.',
        subtext: name,
        cta: '자세히 보기 →',
      }
    }
    if (layout === 'cta') {
      return {
        layout,
        title: phrase,
        body: '더 궁금한 점이 있다면 문의해 주세요.',
        subtext: `${name} 드림`,
        cta: '문의하기 →',
      }
    }
    return {
      layout,
      title: `포인트 ${i}`,
      body: '핵심 메시지를 담은 이야기를 전합니다.',
      subtext: '',
      cta: '',
    }
  })
}

// /uploads/xxx.png URL → public/uploads/xxx.png 디스크 경로. 상위 디렉터리 탈출 방어.
function resolveUploadPath(url: string): string {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) {
    throw new Error(`지원하지 않는 이미지 URL: ${url}`)
  }
  const rel = url.replace(/^\/uploads\//, '')
  const root = join(process.cwd(), 'public', 'uploads')
  const full = normalize(join(root, rel))
  if (!full.startsWith(root)) throw new Error('허용되지 않는 경로')
  return full
}

function randId() {
  return Math.random().toString(36).slice(2, 10)
}
