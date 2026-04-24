// ══════════════════════════════════════════════════════════════════
//  Layout DSL 프롬프트 빌더 — auto / note-rag 양쪽 경로가 공유.
// ══════════════════════════════════════════════════════════════════
// 다양성 강제: varietySeed + 6가지 family 중 1개 랜덤 강제 + in-context 예시 2종.
// 같은 family 연속 사용 감지용 히스토리, title↔body 유사도 체크 유틸 포함.
// runLayoutDsls: 프롬프트 생성 → LLM 호출 → 검증 → (필요 시) 재시도 까지 전담.

import { Logger } from '@nestjs/common'
import type { StyleRecipe } from './style'
import { recipeAsPromptBlock, buildStyleRecipe } from './style'
import { callGeminiJson, layoutDslSchema } from './llm-gemini'
import { validateLayoutDsl, ValidatedLayoutDsl } from './schema'

// 6가지 대표 레이아웃 패밀리 — 호출마다 1개가 system/user 양쪽에 강제 주입.
const FAMILIES: readonly string[] = [
  'LEFT_PANEL: 좌측 42~55% 어두운 텍스트 패널, 우측에 image 배치. title 좌측 상단 큼직하게, price/CTA 좌측 하단.',
  'TOP_IMAGE: 상단 45~65% 에 image 가 가로로 꽉 차고, 하단 영역은 solid 배경의 텍스트 카드(제목·본문·CTA).',
  'HERO_FULL: image 가 canvas 전체(100%)를 덮고, decor(mask-gradient) 로 하단을 어둡게, 텍스트는 bottom-left 에 안착.',
  'DIAGONAL_SPLIT: image 가 우상단 대각선을 차지(예: rect [45, 0, 55, 70]), 좌하단에 title/body/price 블록 쌓기.',
  'CENTER_STACK: image 는 상단 중앙 원/사각(rect [20, 8, 60, 40]), 아래 중앙 정렬로 title · subtitle · price · cta 스택.',
  'EDITORIAL: image 는 좌측 작은 박스(rect [6, 10, 42, 45]), 우측에 큰 title 과 subtitle, 하단에 features 2열 + cta.',
]

// in-context 예시 JSON 2종 — LLM 이 실제 rect 사용법을 보고 학습.
const EXAMPLE_1 = {
  canvas: { w: 1080, h: 1350, bg: '#0b1220' },
  cardLayout: 'cover',
  rationale: 'TOP_IMAGE 변주 — body 넓고 title 여유',
  blocks: [
    { id: 'img', type: 'image', rect: [0, 0, 100, 52], fit: 'cover', url: '{{image}}' },
    { id: 'mask', type: 'decor', style: 'mask-gradient', rect: [0, 35, 100, 22], color: 'rgba(0,0,0,0.55)' },
    { id: 'badge', type: 'badge', rect: [6, 56, 40, 6], text: '신제품 출시', background: '#f59e0b', style: 'pill' },
    { id: 'title', type: 'title', rect: [6, 64, 88, 16], text: '매일 바르는 보습 루틴', size: 96, align: 'left' },
    { id: 'body', type: 'body', rect: [6, 82, 88, 9], text: '24시간 수분 장벽을 지켜주는 데일리 토너. 민감 피부도 부담 없이 매일 쓰는 루틴을 완성합니다.', size: 26, align: 'left' },
    { id: 'price', type: 'price', rect: [6, 92, 55, 6], priceOriginal: 32000, priceSale: 24800, discountPercent: 23 },
    { id: 'cta', type: 'cta', rect: [64, 92, 32, 6], text: '지금 구매', style: 'pill', background: '#4338ca' },
  ],
}
const EXAMPLE_2 = {
  canvas: { w: 1080, h: 1350, bg: '#faf6ee' },
  cardLayout: 'cover',
  rationale: 'LEFT_PANEL + accent bar',
  blocks: [
    { id: 'img', type: 'image', rect: [48, 0, 52, 100], fit: 'cover', url: '{{image}}' },
    { id: 'panel', type: 'decor', style: 'mask-solid', rect: [0, 0, 48, 100], background: '#0f172a' },
    { id: 'corner', type: 'decor', style: 'corner-accent', rect: [4, 6, 8, 8], color: '#f59e0b' },
    { id: 'badge', type: 'badge', rect: [6, 10, 26, 5], text: 'BEST', background: '#f59e0b', style: 'pill' },
    { id: 'title', type: 'title', rect: [6, 20, 40, 22], text: '오직 5일간\n특별 혜택', size: 84, align: 'left', color: '#ffffff' },
    { id: 'sub', type: 'subtitle', rect: [6, 44, 40, 6], text: '지금 참여하면 30% OFF', size: 30, align: 'left', color: '#fde68a', style: 'underline' },
    { id: 'body', type: 'body', rect: [6, 54, 40, 18], text: '봄맞이 한정으로 준비한 이번 주 프로모션. 자주 사는 제품을 더 알뜰하게 챙길 기회입니다.', size: 24, align: 'left', color: '#e2e8f0' },
    { id: 'price', type: 'price', rect: [6, 75, 40, 10], priceOriginal: 18000, priceSale: 12600, discountPercent: 30, color: '#ffffff' },
    { id: 'cta', type: 'cta', rect: [6, 88, 40, 8], text: '바로 구매', style: 'pill', background: '#f59e0b' },
  ],
}

// ─── family/seed 히스토리 (모듈 레벨) — 연속 편중 감지용 ───
const familyHistory: string[] = []
const MAX_HISTORY = 30

export function recentFamilyHistory(): string[] {
  return [...familyHistory]
}

// ─── 호출 통계 (헬스체크용) ───
interface CallStat {
  ts: number
  path: 'auto' | 'note-rag'
  template: 'product-ad' | 'promo'
  seed: string
  family: string
  outcome: 'success' | 'no-key' | 'http-fail' | 'invalid-shape' | 'all-null'
  validCount: number
  nullCount: number
  retried: boolean
  durationMs: number
}
const callStats: CallStat[] = []
const STATS_MAX = 50
// 마지막 에러 — health 엔드포인트에서 바로 확인할 수 있도록 모듈 레벨에 보존
let lastError: { ts: number; tag: string; message: string } | null = null

export function getLayoutDslHealth() {
  const recent = callStats.slice(-20).reverse()
  const totals = callStats.reduce(
    (acc, s) => {
      acc[s.outcome] = (acc[s.outcome] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  const familyCounts = familyHistory.reduce(
    (acc, f) => {
      acc[f] = (acc[f] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )
  return {
    totalCalls: callStats.length,
    outcomes: totals,
    familyDistribution: familyCounts,
    dominance: detectFamilyDominance(),
    lastError: lastError
      ? { ...lastError, ageSec: Math.round((Date.now() - lastError.ts) / 1000) }
      : null,
    recentCalls: recent.map((s) => ({
      path: s.path,
      template: s.template,
      seed: s.seed,
      family: s.family,
      outcome: s.outcome,
      validCount: s.validCount,
      nullCount: s.nullCount,
      retried: s.retried,
      ageSec: Math.round((Date.now() - s.ts) / 1000),
      durationMs: s.durationMs,
    })),
  }
}

export function detectFamilyDominance(): { family: string; count: number } | null {
  if (familyHistory.length < 10) return null
  const recent = familyHistory.slice(-10)
  const counts: Record<string, number> = {}
  for (const f of recent) counts[f] = (counts[f] ?? 0) + 1
  for (const [f, c] of Object.entries(counts)) {
    if (c >= 8) return { family: f, count: c }
  }
  return null
}

// ─── 입력/출력 ───
export interface BuildDslPromptInput {
  template: 'product-ad' | 'promo'
  prompt: string
  brand: any
  recipe: StyleRecipe | null
  n: number
  contextBlock?: string // note-rag 경로에서 지식노트 chunks 블록
  // 재시도 호출 시 이전 seed 와 다른 값을 강제 (optional)
  excludeSeed?: string
  excludeFamily?: string
}

export interface BuildDslPromptResult {
  sys: string
  userText: string
  seed: string
  family: string // 앞부분 코드만 (예: LEFT_PANEL)
  familyFull: string // 설명 포함 원문
}

export function buildLayoutDslPrompt(input: BuildDslPromptInput): BuildDslPromptResult {
  const { template, prompt, brand, recipe, n, contextBlock, excludeSeed, excludeFamily } = input

  // seed
  let seed = Math.random().toString(36).slice(2, 10)
  if (excludeSeed && seed === excludeSeed) seed = seed + '-r'

  // family 선택 — 재시도면 이전과 다른 family 로 강제
  let candidate = FAMILIES[Math.floor(Math.random() * FAMILIES.length)]
  if (excludeFamily) {
    const pool = FAMILIES.filter((f) => !f.startsWith(excludeFamily + ':'))
    if (pool.length > 0) candidate = pool[Math.floor(Math.random() * pool.length)]
  }
  const familyFull = candidate
  const family = familyFull.split(':')[0]
  familyHistory.push(family)
  if (familyHistory.length > MAX_HISTORY) familyHistory.shift()

  const brandPrimary = typeof brand?.primaryColor === 'string' ? brand.primaryColor : '#4338ca'

  // 시스템 프롬프트 — 출력 JSON 구조를 명시 (responseSchema 없이 프롬프트로만 강제).
  const sys = [
    '한국 SNS 카드뉴스 AI 디자이너. 다음 형식의 JSON 하나만 반환:',
    '{ "cards": [ { "canvas": { "w":1080, "h":1350, "bg":"#HEX" }, "blocks": [...] } ] }',
    '',
    'block 필드: { id, type, rect:[x,y,w,h], pos?, align?, text?, url?, color?, background?, size?, weight?, fit?, style?, priceOriginal?, priceSale?, discountPercent?, features?, swatches?, big? }',
    'block 타입: image / title / subtitle / body / badge / price / features / cta / swatch / decor',
    '',
    '── rect 규칙 (엄수) ──',
    '· rect=[x,y,w,h] 퍼센트 0~100. 블록 6~10개.',
    '· canvas 의 상·하·좌·우 2% 는 안전영역. 모든 핵심 블록은 안전영역 안에 배치.',
    '· body 블록 rect.w 는 반드시 50% 이상. (좁으면 2~3글자씩 줄바꿈돼 깨짐)',
    '· title 블록 rect.h 는 최소 12% 이상. (2~3줄 받을 수 있게)',
    '· title.rect.w 는 70% 이상 권장.',
    '· 텍스트 블록은 서로 겹치지 않게 세로 간격 2% 이상 확보.',
    '',
    '── 이미지 규칙 ──',
    '· image.url 은 반드시 정확히 "{{image}}" 문자열.',
    '· 이미지가 없을 수도 있다. 이미지 없이도 구도가 완성되도록 텍스트·decor·뱃지·swatch 로 빈 공간을 채울 것.',
    '· image 가 없으면 canvas.bg gradient + decor(corner-accent, mask-solid) 로 시각 포인트 만들기.',
    '',
    '── 내용 규칙 ──',
    '· title·body·cta 블록 필수. body 는 48자 이상 문장, 제목과 다른 내용(혜택·근거·배경).',
    '· 겹침 시 decor(style=mask-gradient 또는 mask-solid)로 가독성 확보.',
    '· 색상 HEX #RRGGBB, 텍스트/배경 대비 4.5:1 이상.',
    '· 페이지 번호·과장·의료 단정 금지.',
    `· 강제 패밀리: ${familyFull}`,
    '· 전형적 split(좌 텍스트+우 이미지) 만 뽑지 말 것. 매 호출마다 다른 구도.',
    '',
    '예시 (body.rect.w=70%, title.rect.h=16% 주의):',
    JSON.stringify({ cards: [EXAMPLE_1] }),
  ].join('\n')

  // 사용자 텍스트 — RAG 청크는 총 800자로 제한해 속도 확보.
  const trimmedContext = contextBlock ? contextBlock.slice(0, 800) : ''
  const userTextLines: string[] = []
  if (recipe) userTextLines.push(recipeAsPromptBlock(recipe))
  if (trimmedContext) {
    userTextLines.push('', '[지식노트 발췌]', trimmedContext)
  }
  userTextLines.push(
    '',
    `주제: ${prompt}`,
    `브랜드: ${brand?.name ?? '미지정'} (primary ${brandPrimary})`,
    `카드 수: ${n} · seed: ${seed}`,
    `방향: ${template === 'promo' ? '이벤트·세일(대담)' : '상품 광고(정보·신뢰)'}`,
    'canvas.w=1080, h=1080/1350/1920 중 택1.',
  )
  const userText = userTextLines.join('\n')

  return { sys, userText, seed, family, familyFull }
}

// ─── 유사도 유틸 (title vs body 재시도 판단용) ───
// 한국어 + 영문 혼합 환경에서 단순 토큰 jaccard. 공백·구두점 기준 분할.
export function textSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const toks = (s: string) =>
    s
      .toLowerCase()
      .split(/[\s,.·!?()\[\]{}"'\-—·]+/)
      .filter((t) => t.length > 1)
  const ta = toks(a)
  const tb = toks(b)
  if (ta.length === 0 || tb.length === 0) return 0
  const A = new Set(ta)
  const B = new Set(tb)
  let intersect = 0
  for (const t of A) if (B.has(t)) intersect++
  return intersect / new Set([...A, ...B]).size
}

// 카드 DSL 에서 title/body 유사도 또는 body 누락을 감지 — 재시도 트리거.
export function needsRetry(card: any): { reason: string } | null {
  if (!card || !Array.isArray(card.blocks)) return { reason: 'blocks-missing' }
  const title = card.blocks.find((b: any) => b.type === 'title')
  const body = card.blocks.find((b: any) => b.type === 'body')
  if (!body || !body.text) return { reason: 'body-missing' }
  if (body.text.length < 30) return { reason: 'body-too-short' }
  if (title?.text) {
    const sim = textSimilarity(title.text, body.text)
    if (sim >= 0.7) return { reason: `title-body-similar(${sim.toFixed(2)})` }
  }
  return null
}

// ══════════════════════════════════════════════════════════════════
//  runLayoutDsls — LLM 호출 + 검증 + 재시도까지 전담. auto/note-rag 공용.
// ══════════════════════════════════════════════════════════════════

export interface RunLayoutDslsInput {
  path: 'auto' | 'note-rag'
  template: 'product-ad' | 'promo'
  prompt: string
  n: number
  brand: any
  contextBlock?: string
  timeoutMs?: number
}

// DSL 은 구조화 JSON 을 많이 만들어야 해 일반 카피 LLM(15s)보다 오래 걸림.
// 45s 로 실 배포 확인 시 aborted 가 또 났음 → 60s 로 상향 + 프롬프트 절반 단축.
const DSL_CALL_TIMEOUT_MS = 60_000

export async function runLayoutDsls(
  input: RunLayoutDslsInput,
): Promise<(ValidatedLayoutDsl | null)[]> {
  const { path, template, prompt, n, brand, contextBlock, timeoutMs } = input
  const effectiveTimeout = Math.max(timeoutMs ?? 0, DSL_CALL_TIMEOUT_MS)
  const logger = new Logger(`LayoutDSL:${path}`)
  const tag = `layout-dsl:${path}:${template}`
  const t0 = Date.now()

  const key = (process.env.GEMINI_API_KEY ?? '').trim()
  logger.log(
    `[${tag}] ▶ 진입 — key.present=${key.length > 0} key.length=${key.length} brand=${brand?.name ?? '(none)'} n=${n}`,
  )

  if (!key) {
    logger.error(`[${tag}] ✗ GEMINI_API_KEY 없음 — LayoutDSL 전부 null 반환 (basic 폴백)`)
    callStats.push({
      ts: Date.now(),
      path,
      template,
      seed: '-',
      family: '-',
      outcome: 'no-key',
      validCount: 0,
      nullCount: n,
      retried: false,
      durationMs: Date.now() - t0,
    })
    if (callStats.length > STATS_MAX) callStats.shift()
    return Array(n).fill(null)
  }

  const recipe: StyleRecipe | null = brand ? buildStyleRecipe(brand) : null

  // 1차 호출
  const p1 = buildLayoutDslPrompt({ template, prompt, brand, recipe, n, contextBlock })
  logger.log(
    `[${tag}] path=${path} template=${template} seed=${p1.seed} family=${p1.family} (1차)`,
  )
  const dominance = detectFamilyDominance()
  if (dominance) {
    logger.warn(
      `[${tag}] ⚠ family "${dominance.family}" 최근 10회 중 ${dominance.count}회 사용 — 랜덤성 점검 필요`,
    )
  }

  let parsed: { cards: unknown[] } | null = null
  try {
    // responseSchema 를 제거해 속도 최적화 (Gemini CFG 제약 회피).
    // 출력 형식은 프롬프트로 강제 + runtime validator (validateLayoutDsl) 가 품질 보장.
    parsed = await callGeminiJson<{ cards: unknown[] }>({
      systemInstruction: p1.sys,
      userText: p1.userText,
      // schema 생략 — responseMimeType=application/json 만 사용
      timeoutMs: effectiveTimeout,
      temperature: 1.15,
      debugLabel: tag,
    })
  } catch (e: any) {
    const msg = e?.message ?? String(e)
    logger.error(`[${tag}] ✗ Gemini 호출 실패 (http-fail): ${msg}`)
    callStats.push({
      ts: Date.now(),
      path,
      template,
      seed: p1.seed,
      family: p1.family,
      outcome: 'http-fail',
      validCount: 0,
      nullCount: n,
      retried: false,
      durationMs: Date.now() - t0,
    })
    if (callStats.length > STATS_MAX) callStats.shift()
    // 마지막 에러 메시지를 health 엔드포인트에서 볼 수 있게 저장
    lastError = { ts: Date.now(), tag, message: msg.slice(0, 500) }
    return Array(n).fill(null)
  }

  if (!parsed || !Array.isArray(parsed.cards)) {
    logger.error(`[${tag}] ✗ parsed.cards 배열 아님 (invalid-shape)`)
    callStats.push({
      ts: Date.now(),
      path,
      template,
      seed: p1.seed,
      family: p1.family,
      outcome: 'invalid-shape',
      validCount: 0,
      nullCount: n,
      retried: false,
      durationMs: Date.now() - t0,
    })
    if (callStats.length > STATS_MAX) callStats.shift()
    lastError = { ts: Date.now(), tag, message: `invalid shape: ${JSON.stringify(parsed).slice(0, 200)}` }
    return Array(n).fill(null)
  }

  // 1차 재시도 판단 — 어느 카드든 needsRetry 반환하면 통째로 재호출 (다른 seed·family)
  const needsAny = parsed.cards.find((c: any) => needsRetry(c))
  if (needsAny) {
    const reason = needsRetry(needsAny as any)
    logger.warn(
      `[${tag}] 1차 결과 품질 미달(${reason?.reason}) — 재시도 1회 (excludeFamily=${p1.family})`,
    )
    const p2 = buildLayoutDslPrompt({
      template,
      prompt,
      brand,
      recipe,
      n,
      contextBlock,
      excludeSeed: p1.seed,
      excludeFamily: p1.family,
    })
    logger.log(`[${tag}] path=${path} seed=${p2.seed} family=${p2.family} (2차·재시도)`)
    try {
      const retry = await callGeminiJson<{ cards: unknown[] }>({
        systemInstruction: p2.sys,
        userText: p2.userText,
        // 재시도도 schema 없이 빠르게
        timeoutMs: effectiveTimeout,
        temperature: 1.15,
        debugLabel: `${tag}:retry`,
      })
      if (retry && Array.isArray(retry.cards)) parsed = retry
    } catch (e: any) {
      logger.warn(`[${tag}] 재시도 Gemini 호출 실패 — 1차 결과 유지: ${e?.message ?? e}`)
    }
  }

  // 검증 + 블록 구조 집계 로그
  const out: (ValidatedLayoutDsl | null)[] = []
  const signatures: string[] = []
  let validCount = 0
  let nullCount = 0
  const retried = parsed !== null && parsed.cards !== undefined && familyHistory.length >= 2
    && familyHistory[familyHistory.length - 1] !== p1.family
  for (let i = 0; i < n; i++) {
    const raw = parsed.cards[i]
    const v = validateLayoutDsl(raw)
    if (v) {
      validCount++
      const types = v.blocks.map((b: any) => b.type).join(',')
      logger.log(`[${tag}] 카드 ${i} 검증 통과 — blocks=${v.blocks.length} types=${types}`)
      const sig = v.blocks
        .map((b: any) => `${b.type}@${Array.isArray(b.rect) ? b.rect.join(',') : b.pos ?? '-'}`)
        .sort()
        .join('|')
      if (signatures.includes(sig)) {
        logger.warn(`[${tag}] ⚠ 카드 ${i} 구조가 이전 카드와 동일 — 다양성 부족 의심`)
      }
      signatures.push(sig)
    } else {
      nullCount++
      logger.warn(
        `[${tag}] ✗ 카드 ${i} 검증 실패 — 원본(앞 500자): ${JSON.stringify(raw).slice(0, 500)}`,
      )
    }
    out.push(v)
  }

  const outcome: CallStat['outcome'] =
    validCount === n ? 'success' : validCount > 0 ? 'success' : 'all-null'
  logger.log(
    `[${tag}] ◀ 종료 — valid=${validCount}/${n} null=${nullCount} outcome=${outcome} ${Date.now() - t0}ms`,
  )
  callStats.push({
    ts: Date.now(),
    path,
    template,
    seed: p1.seed,
    family: p1.family,
    outcome,
    validCount,
    nullCount,
    retried,
    durationMs: Date.now() - t0,
  })
  if (callStats.length > STATS_MAX) callStats.shift()
  return out
}
