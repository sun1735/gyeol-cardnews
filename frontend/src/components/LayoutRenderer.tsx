'use client'

// Layout DSL 을 받아 카드 DOM 을 그리는 제너릭 렌더러.
// 블록 타입별로 CSS 를 분기. 모든 rect 는 퍼센트 → 실제 px 로 환산.
// 한글 폰트 Pretendard, 이미지 안엔 텍스트 넣지 않음 (DSL 바깥에서 이미 보장).

import { useState, type CSSProperties, type ReactNode } from 'react'
import type {
  BlockPos,
  LayoutBlock,
  LayoutDsl,
  Rect,
} from '@/lib/layoutDsl'
import { clampRect, posToRect } from '@/lib/layoutDsl'

export interface LayoutRendererProps {
  dsl: LayoutDsl
  displayWidth: number
  // 이미지 블록 URL — LLM 의 b.url 은 무시하고 항상 이 값을 사용 (CORS·외부 URL 방어)
  imageUrl?: string
  // 블록별 fit override — block.id 별 cover/contain
  imageFitOverride?: Record<string, 'cover' | 'contain'>
  // 인라인 편집 오버라이드 — card.title/body/subtext/cta 값이 들어오면 해당 블록의 text 를 덮어씀
  titleOverride?: string
  bodyOverride?: string
  subtitleOverride?: string
  ctaOverride?: string
  innerRef?: React.Ref<HTMLDivElement>
}

function fmtKrw(n?: number) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
    ? `₩${n.toLocaleString('ko-KR')}`
    : ''
}

function shift(hex: string, amount: number): string {
  const clean = (hex || '').replace('#', '')
  if (clean.length !== 6) return hex
  const n = parseInt(clean, 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// 상대 휘도 계산 (WCAG). 텍스트 대비 4.5:1 검증용.
function relativeLuminance(hex: string): number {
  const clean = (hex || '#000000').replace('#', '')
  if (clean.length !== 6) return 0
  const n = parseInt(clean, 16)
  const [r, g, b] = [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const a = Math.max(l1, l2)
  const b = Math.min(l1, l2)
  return (a + 0.05) / (b + 0.05)
}

export function LayoutRenderer({
  dsl,
  displayWidth,
  imageUrl,
  imageFitOverride,
  titleOverride,
  bodyOverride,
  subtitleOverride,
  ctaOverride,
  innerRef,
}: LayoutRendererProps) {
  const ratioH = dsl.canvas.h / dsl.canvas.w
  const displayHeight = Math.round(displayWidth * ratioH)
  const s = displayWidth / 1080

  // 블록 전처리:
  //   1) 타입별 오버라이드 텍스트 덮어쓰기 (인라인 편집 즉시 반영)
  //   2) body 블록 누락 + bodyOverride 있으면 자동 주입
  //   3) image 블록의 b.url 은 {{image}} 여부와 무관하게 imageUrl 로 치환
  //      (LLM 이 외부 URL 을 넣어 CORS tainted 나는 것 방어)
  let blocks = dsl.blocks.map((b) => {
    const next = { ...b }
    if (b.type === 'title' && titleOverride !== undefined) next.text = titleOverride
    else if (b.type === 'body' && bodyOverride !== undefined) next.text = bodyOverride
    else if (b.type === 'subtitle' && subtitleOverride !== undefined) next.text = subtitleOverride
    else if (b.type === 'cta' && ctaOverride !== undefined) next.text = ctaOverride
    if (b.type === 'image') {
      // 이미지 블록은 항상 imageUrl 사용 (LLM 의 b.url 은 신뢰하지 않음)
      next.url = imageUrl || undefined
    }
    return next
  })
  const hasBody = blocks.some((b) => b.type === 'body')
  if (!hasBody && bodyOverride?.trim()) {
    blocks = [
      ...blocks,
      {
        id: 'auto-body',
        type: 'body',
        rect: [6, 72, 88, 10],
        text: bodyOverride,
        align: 'left',
        size: 26,
        weight: 400,
        zIndex: 11,
      },
    ]
  }

  const canvasStyle: CSSProperties = {
    width: displayWidth,
    height: displayHeight,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16 * s,
    fontFamily: 'Pretendard, ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontFeatureSettings: '"palt"',
    background: dsl.canvas.gradient || dsl.canvas.bg || '#0a0a0a',
    boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
    letterSpacing: '-0.01em',
    color: '#fff',
  }

  // rect 결정 (rect > pos > 기본 bottom-center)
  const resolveRect = (b: LayoutBlock): Rect => {
    if (b.rect) return clampRect(b.rect)
    if (b.pos) return clampRect(posToRect(b.pos))
    return clampRect([5, 80, 90, 15])
  }

  // z-index: decor(이미지 마스크) 낮고, 이미지는 중간, 텍스트는 위.
  const typeZ: Record<LayoutBlock['type'], number> = {
    image: 1,
    decor: 2,
    features: 10,
    swatch: 10,
    badge: 12,
    subtitle: 12,
    title: 14,
    body: 12,
    price: 14,
    cta: 16,
  }

  return (
    <div ref={innerRef} style={canvasStyle}>
      {blocks.map((b) => renderBlock(b, { s, resolveRect, typeZ, imageUrl, imageFitOverride, canvasBg: dsl.canvas.bg }))}
    </div>
  )
}

interface RenderCtx {
  s: number
  resolveRect: (b: LayoutBlock) => Rect
  typeZ: Record<LayoutBlock['type'], number>
  imageUrl?: string
  imageFitOverride?: Record<string, 'cover' | 'contain'>
  canvasBg: string
}

function rectToStyle(rect: Rect): CSSProperties {
  const [x, y, w, h] = rect
  return {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    width: `${w}%`,
    height: `${h}%`,
  }
}

// 이미지 URL 유효성 — 자리표시자·빈값·이상한 스킴 제외.
function isValidImageUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  const t = url.trim()
  if (!t || t === '{{image}}') return false
  // 허용: /uploads/..., http://, https://
  if (t.startsWith('/uploads/')) return true
  if (t.startsWith('http://') || t.startsWith('https://')) return true
  return false
}

// 텍스트 블록 rect 최소 크기 강제 — LLM 이 너무 좁게 잡은 경우 자동 확장.
// 원본 rect 는 보존하고 렌더용 스타일에서만 min-width / min-height 적용.
function enforceTextMinSize(
  rect: Rect,
  type: LayoutBlock['type'],
): CSSProperties {
  const [x, y, w, h] = rect
  const base = rectToStyle(rect)
  const isText = type === 'title' || type === 'body' || type === 'subtitle'
  if (!isText) return base
  const tooNarrow = w < 40
  const tooShort = h < 8
  if (!tooNarrow && !tooShort) return base
  if (tooNarrow) {
    console.warn(
      `LayoutRenderer: ${type} rect too narrow (w=${w}%) — enforced min width`,
    )
  }
  if (tooShort) {
    console.warn(
      `LayoutRenderer: ${type} rect too short (h=${h}%) — enforced min height`,
    )
  }
  // 확장: x 를 줄이지 않고 width 만 늘리되 100-x 상한
  const expandedW = tooNarrow ? Math.min(60, 100 - x) : w
  const expandedH = tooShort ? Math.min(12, 100 - y) : h
  return {
    ...base,
    width: `${expandedW}%`,
    height: `${expandedH}%`,
  }
}

// 이미지 블록 — URL 검증 + onError fallback 을 위한 컴포넌트.
function ImageBlock({
  b,
  rect,
  fit,
  canvasBg,
  zIndex,
  s,
}: {
  b: LayoutBlock
  rect: Rect
  fit: 'cover' | 'contain'
  canvasBg: string
  zIndex: number
  s: number
}) {
  const valid = isValidImageUrl(b.url)
  const [broken, setBroken] = useState(false)

  if (!valid) {
    console.warn(
      `LayoutRenderer: image block url invalid, fallback to gradient (url="${b.url ?? ''}")`,
    )
    return (
      <div
        key={b.id}
        style={{
          ...rectToStyle(rect),
          background:
            b.background ??
            `linear-gradient(135deg, ${shift(canvasBg, 40)}, ${shift(canvasBg, 80)})`,
          zIndex,
        }}
      />
    )
  }
  if (broken) {
    return (
      <div
        key={b.id}
        style={{
          ...rectToStyle(rect),
          background: `linear-gradient(135deg, ${shift(canvasBg, 30)}, ${shift(canvasBg, 70)})`,
          zIndex,
        }}
      />
    )
  }
  return (
    <div
      key={b.id}
      style={{
        ...rectToStyle(rect),
        zIndex,
        background: b.background ?? 'transparent',
        padding: fit === 'contain' ? 16 * s : 0,
        overflow: 'hidden',
      }}
    >
      <img
        src={b.url}
        alt=""
        crossOrigin="anonymous"
        onError={() => {
          console.warn(`LayoutRenderer: image load failed (${b.url}), fallback to gradient`)
          setBroken(true)
        }}
        style={{
          width: '100%',
          height: '100%',
          objectFit: fit,
          objectPosition: 'center',
          display: 'block',
        }}
        draggable={false}
      />
    </div>
  )
}

function renderBlock(b: LayoutBlock, ctx: RenderCtx): ReactNode {
  const { s, resolveRect, typeZ, imageUrl, imageFitOverride, canvasBg } = ctx
  const rect = resolveRect(b)
  const align = b.align ?? 'left'
  const zIndex = b.zIndex ?? typeZ[b.type] ?? 10

  // ─── image ───
  if (b.type === 'image') {
    const fit = imageFitOverride?.[b.id] ?? b.fit ?? 'cover'
    return <ImageBlock key={b.id} b={b} rect={rect} fit={fit} canvasBg={canvasBg} zIndex={zIndex} s={s} />
  }

  // ─── decor: 마스크·코너 액센트·원형 할인 뱃지 ───
  if (b.type === 'decor') {
    if (b.style === 'mask-gradient') {
      return (
        <div
          key={b.id}
          style={{
            ...rectToStyle(rect),
            background:
              b.background ??
              `linear-gradient(180deg, rgba(0,0,0,0) 0%, ${b.color ?? 'rgba(0,0,0,0.65)'} 100%)`,
            zIndex,
          }}
        />
      )
    }
    if (b.style === 'mask-solid') {
      return (
        <div
          key={b.id}
          style={{
            ...rectToStyle(rect),
            background: b.background ?? b.color ?? 'rgba(0,0,0,0.5)',
            zIndex,
          }}
        />
      )
    }
    if (b.style === 'corner-accent') {
      const thick = 3 * s
      return (
        <div
          key={b.id}
          style={{
            ...rectToStyle(rect),
            borderLeft: `${thick}px solid ${b.color ?? '#ffffff'}`,
            borderTop: `${thick}px solid ${b.color ?? '#ffffff'}`,
            zIndex,
          }}
        />
      )
    }
    if (b.style === 'circle') {
      // 원형 할인 뱃지: big(퍼센트 숫자) + "OFF"
      return (
        <div
          key={b.id}
          style={{
            ...rectToStyle(rect),
            background: b.color ?? '#dc2626',
            borderRadius: '50%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            transform: b.rotate ? `rotate(${b.rotate}deg)` : 'rotate(-8deg)',
            boxShadow: `0 8px 20px ${b.color ?? '#dc2626'}66`,
            border: `${3 * s}px solid #fff`,
            zIndex,
          }}
        >
          <span style={{ fontSize: (b.size ?? 62) * s, fontWeight: 900, lineHeight: 0.9 }}>
            {b.big ?? b.text}
          </span>
          {b.text && b.big && (
            <span style={{ fontSize: 22 * s, fontWeight: 900, letterSpacing: 3 * s }}>
              {b.text}
            </span>
          )}
        </div>
      )
    }
    // fallback: 단순 색 박스
    return (
      <div
        key={b.id}
        style={{
          ...rectToStyle(rect),
          background: b.background ?? b.color ?? 'transparent',
          zIndex,
        }}
      />
    )
  }

  // ─── badge ───
  if (b.type === 'badge') {
    const isRibbon = b.style === 'ribbon'
    return (
      <div
        key={b.id}
        style={{
          ...rectToStyle(rect),
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          zIndex,
        }}
      >
        <span
          style={{
            display: 'inline-block',
            padding: `${10 * s}px ${18 * s}px`,
            background: b.background ?? b.color ?? '#4338ca',
            color: b.color && b.background ? b.color : '#fff',
            fontSize: (b.size ?? 22) * s,
            fontWeight: b.weight ?? 900,
            letterSpacing: 3 * s,
            textTransform: 'uppercase',
            borderRadius: isRibbon ? 0 : 999,
            clipPath: isRibbon
              ? 'polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)'
              : undefined,
            boxShadow: `0 6px 14px ${(b.background ?? b.color ?? '#4338ca')}66`,
          }}
        >
          {b.text}
        </span>
      </div>
    )
  }

  // ─── title ───
  if (b.type === 'title') {
    return (
      <div
        key={b.id}
        style={{
          ...enforceTextMinSize(rect, 'title'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          zIndex,
          padding: b.style === 'glass' ? 20 * s : 0,
          background: b.style === 'glass' ? 'rgba(255,255,255,0.14)' : 'transparent',
          border: b.style === 'glass' ? `${2 * s}px solid rgba(255,255,255,0.3)` : 'none',
          backdropFilter: b.style === 'glass' ? 'blur(10px)' : 'none',
          borderRadius: b.style === 'glass' ? 14 * s : 0,
        }}
      >
        <h2
          style={{
            fontSize: (b.size ?? 96) * s,
            fontWeight: b.weight ?? 900,
            lineHeight: 0.98,
            margin: 0,
            letterSpacing: '-0.035em',
            color: b.color ?? '#ffffff',
            textAlign: align,
            width: '100%',
            textShadow: b.style === 'glass' ? 'none' : '0 2px 10px rgba(0,0,0,0.35)',
          }}
        >
          {b.text}
        </h2>
      </div>
    )
  }

  // ─── subtitle ───
  if (b.type === 'subtitle') {
    const underline = b.style === 'underline'
    return (
      <div
        key={b.id}
        style={{
          ...enforceTextMinSize(rect, 'subtitle'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          zIndex,
        }}
      >
        <div
          style={{
            fontSize: (b.size ?? 30) * s,
            fontWeight: b.weight ?? 700,
            color: b.color ?? '#ffffff',
            textAlign: align,
            paddingBottom: underline ? 10 * s : 0,
            borderBottom: underline
              ? `${3 * s}px solid ${b.background ?? b.color ?? '#4338ca'}`
              : 'none',
            letterSpacing: '-0.01em',
            textShadow: '0 1px 6px rgba(0,0,0,0.3)',
          }}
        >
          {b.text}
        </div>
      </div>
    )
  }

  // ─── body ───
  if (b.type === 'body') {
    return (
      <div
        key={b.id}
        style={{
          ...enforceTextMinSize(rect, 'body'),
          zIndex,
          color: b.color ?? '#ffffff',
          fontSize: (b.size ?? 24) * s,
          fontWeight: b.weight ?? 500,
          lineHeight: 1.55,
          textAlign: align,
          whiteSpace: 'pre-wrap',
          textShadow: '0 1px 6px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}
      >
        {b.text}
      </div>
    )
  }

  // ─── price ───
  if (b.type === 'price') {
    const hasSale = typeof b.priceSale === 'number' && b.priceSale > 0
    const hasOriginal = typeof b.priceOriginal === 'number' && b.priceOriginal > (b.priceSale ?? 0)
    return (
      <div
        key={b.id}
        style={{
          ...rectToStyle(rect),
          display: 'flex',
          alignItems: 'baseline',
          gap: 14 * s,
          flexWrap: 'wrap',
          zIndex,
          color: b.color ?? '#ffffff',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
        }}
      >
        {hasOriginal && (
          <span
            style={{
              fontSize: 26 * s,
              opacity: 0.55,
              textDecoration: 'line-through',
              fontWeight: 600,
            }}
          >
            {fmtKrw(b.priceOriginal)}
          </span>
        )}
        {hasSale && (
          <span
            style={{
              fontSize: (b.size ?? 68) * s,
              fontWeight: 900,
              letterSpacing: '-0.025em',
              lineHeight: 1,
            }}
          >
            {fmtKrw(b.priceSale)}
          </span>
        )}
        {typeof b.discountPercent === 'number' && (
          <span
            style={{
              fontSize: 22 * s,
              fontWeight: 900,
              padding: `${6 * s}px ${10 * s}px`,
              background: b.background ?? '#dc2626',
              borderRadius: 6 * s,
              color: '#fff',
            }}
          >
            {b.discountPercent}%
          </span>
        )}
      </div>
    )
  }

  // ─── features ───
  if (b.type === 'features' && Array.isArray(b.features)) {
    const cols = b.features.length > 2 ? 2 : b.features.length
    return (
      <div
        key={b.id}
        style={{
          ...rectToStyle(rect),
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: `${14 * s}px ${18 * s}px`,
          zIndex,
        }}
      >
        {b.features.slice(0, 4).map((f, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 * s }}>
            <span
              style={{
                width: 48 * s,
                height: 48 * s,
                borderRadius: 10 * s,
                background: b.background ?? b.color ?? '#4338ca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 26 * s,
                flexShrink: 0,
              }}
            >
              {f.icon}
            </span>
            <span style={{ fontSize: (b.size ?? 20) * s, fontWeight: 700, color: b.color ?? '#ffffff' }}>
              {f.label}
            </span>
          </div>
        ))}
      </div>
    )
  }

  // ─── swatch ───
  if (b.type === 'swatch' && Array.isArray(b.swatches)) {
    return (
      <div
        key={b.id}
        style={{
          ...rectToStyle(rect),
          display: 'flex',
          gap: 10 * s,
          alignItems: 'center',
          justifyContent: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          zIndex,
        }}
      >
        {b.swatches.slice(0, 6).map((c, i) => (
          <span
            key={i}
            style={{
              width: 28 * s,
              height: 28 * s,
              borderRadius: '50%',
              background: c,
              border: `${2 * s}px solid #ffffff`,
              boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
            }}
          />
        ))}
      </div>
    )
  }

  // ─── cta ───
  if (b.type === 'cta') {
    const bg = b.background ?? b.color ?? '#4338ca'
    return (
      <div
        key={b.id}
        style={{
          ...rectToStyle(rect),
          background: `linear-gradient(90deg, ${bg} 0%, ${shift(bg, -20)} 100%)`,
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center',
          padding: `0 ${28 * s}px`,
          gap: 16 * s,
          fontSize: (b.size ?? 36) * s,
          fontWeight: 900,
          zIndex,
          borderRadius: b.style === 'pill' ? 999 : 0,
        }}
      >
        {b.text}
        <span style={{ fontSize: ((b.size ?? 36) * 0.8) * s }}>→</span>
      </div>
    )
  }

  return null
}

// 외부에서 대비 검사가 필요할 때 쓰는 유틸 export
export { contrastRatio }
