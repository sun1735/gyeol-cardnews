'use client'

// 상품 광고 / 프로모션 카드 렌더러.
// 3가지 레이아웃 모드 + 이미지 fit 옵션 지원:
//   - split: 좌측 텍스트·우측 이미지 (2컬럼 그리드, 기본) — 이미지 잘림 최소화
//   - hero: 카드 전체 배경 이미지 + 중앙 프로스티드 박스 (브랜드감 강할 때)
//   - top-image: 상단 이미지 + 하단 텍스트 (좁은 프리뷰 폴백)
// imageFit(contain|cover): 우측/상단 이미지 컨테이너 내 피트 방식.
// 세로 인물·세로컷(height > width×1.2) 일 때 split 의 우측 폭을 45% → 60% 자동 확장.

import { useEffect, useState, type CSSProperties } from 'react'
import type { CardLayoutMode, DynamicDesign, ImageFitMode } from '@/lib/types'

export interface DynamicCardProps {
  design: DynamicDesign
  backgroundImageUrl?: string
  displayWidth: number
  aspectRatio: '1:1' | '4:5' | '9:16'
  // 사용자 오버라이드. 미지정 시 design.layout 매핑 사용.
  layoutMode?: CardLayoutMode
  imageFit?: ImageFitMode
  // 브랜드 보조색 — 이미지 여백 배경으로 사용해 contain 여백을 자연스럽게 연결.
  secondaryColor?: string
  innerRef?: React.Ref<HTMLDivElement>
}

function fmtKrw(n?: number) {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
    ? `₩${n.toLocaleString('ko-KR')}`
    : ''
}

function shift(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const n = parseInt(clean, 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// design.layout(LLM 생성값) → layoutMode 매핑. 사용자가 지정하지 않았을 때 기본.
function mapLayoutToMode(layout?: string): CardLayoutMode {
  if (layout === 'fullbleed-center-glass') return 'hero'
  if (layout === 'image-top-card-bottom') return 'top-image'
  return 'split' // split-dark-left 포함 기본
}

export function DynamicCard({
  design,
  backgroundImageUrl,
  displayWidth,
  aspectRatio,
  layoutMode,
  imageFit = 'contain',
  secondaryColor,
  innerRef,
}: DynamicCardProps) {
  const ratioH = aspectRatio === '1:1' ? 1 : aspectRatio === '4:5' ? 1.25 : 16 / 9
  const displayHeight = Math.round(displayWidth * ratioH)
  const s = displayWidth / 1080

  // 이미지 자연 크기 감지 — 세로 이미지면 우측 확장
  const [imgAspect, setImgAspect] = useState<number | null>(null)
  useEffect(() => {
    if (!backgroundImageUrl) {
      setImgAspect(null)
      return
    }
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => {
      if (im.naturalWidth > 0) setImgAspect(im.naturalHeight / im.naturalWidth)
    }
    im.src = backgroundImageUrl
  }, [backgroundImageUrl])

  // 표시 폭이 좁으면 split 자체가 불가능 → top-image 로 폴백
  const requestedMode: CardLayoutMode = layoutMode ?? mapLayoutToMode(design.layout)
  const effectiveMode: CardLayoutMode =
    requestedMode === 'split' && displayWidth < 240 ? 'top-image' : requestedMode

  const hasDiscount =
    typeof design.discountPercent === 'number' &&
    design.discountPercent >= 1 &&
    design.discountPercent <= 99
  const hasPriceSale = typeof design.priceSale === 'number' && design.priceSale > 0
  const hasPriceOriginal =
    typeof design.priceOriginal === 'number' &&
    design.priceOriginal > (design.priceSale ?? 0)
  const showDecoration = (k: string) =>
    Array.isArray(design.decorations) && design.decorations.includes(k)

  const containerBase: CSSProperties = {
    width: displayWidth,
    height: displayHeight,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16 * s,
    fontFamily: 'Pretendard, ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontFeatureSettings: '"palt"',
    boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
    letterSpacing: '-0.01em',
  }

  // ══════════════════════════════════════════════════════════
  // split — 2컬럼 그리드 (좌: 텍스트, 우: 이미지)
  // ══════════════════════════════════════════════════════════
  if (effectiveMode === 'split') {
    // 세로 이미지면 우측 폭 확장 (45 → 60%)
    const isTall = imgAspect !== null && imgAspect > 1.2
    const rightPct = isTall ? 60 : 45
    const leftPct = 100 - rightPct
    const imageBg = secondaryColor ?? shift(design.palette.dominant, 40)
    const ctaHeight = design.ctaLabel ? 110 * s : 0

    return (
      <div ref={innerRef} style={{ ...containerBase, background: design.palette.dominant }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `${leftPct}% ${rightPct}%`,
            width: '100%',
            height: displayHeight - ctaHeight,
          }}
        >
          {/* 좌측 텍스트 패널 */}
          <div
            style={{
              background: design.palette.dominant,
              color: design.palette.textOnDominant,
              padding: `${60 * s}px ${52 * s}px`,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* 좌상단 코너 액센트 (선택적 장식) */}
            {showDecoration('corner-accent') && (
              <div
                style={{
                  position: 'absolute',
                  top: 24 * s,
                  left: 24 * s,
                  width: 48 * s,
                  height: 48 * s,
                  borderLeft: `${3 * s}px solid ${design.palette.accent}`,
                  borderTop: `${3 * s}px solid ${design.palette.accent}`,
                }}
              />
            )}
            {design.badgeLabel && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  padding: `${10 * s}px ${18 * s}px`,
                  background: design.palette.accent,
                  color: '#fff',
                  fontSize: 22 * s,
                  fontWeight: 900,
                  letterSpacing: 3 * s,
                  textTransform: 'uppercase',
                  marginBottom: 22 * s,
                }}
              >
                {design.badgeLabel}
              </div>
            )}
            <h2
              style={{
                fontSize: (isTall ? 84 : 94) * s,
                fontWeight: 900,
                lineHeight: 0.96,
                margin: 0,
                letterSpacing: '-0.035em',
              }}
            >
              {design.title}
            </h2>
            {design.subtitle && (
              <div
                style={{
                  fontSize: 30 * s,
                  fontWeight: 700,
                  marginTop: 18 * s,
                  paddingBottom: 14 * s,
                  borderBottom: `${3 * s}px solid ${design.palette.accent}`,
                  alignSelf: 'flex-start',
                }}
              >
                {design.subtitle}
              </div>
            )}
            {design.body && (
              <div
                style={{
                  fontSize: 22 * s,
                  fontWeight: 500,
                  lineHeight: 1.55,
                  marginTop: 18 * s,
                  opacity: 0.95,
                }}
              >
                {design.body}
              </div>
            )}
            {design.features.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: `${14 * s}px ${18 * s}px`,
                  marginTop: 24 * s,
                }}
              >
                {design.features.slice(0, 4).map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 * s }}>
                    <span
                      style={{
                        width: 46 * s,
                        height: 46 * s,
                        borderRadius: 10 * s,
                        background: design.palette.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24 * s,
                        flexShrink: 0,
                      }}
                    >
                      {f.icon}
                    </span>
                    <span style={{ fontSize: 20 * s, fontWeight: 700 }}>{f.label}</span>
                  </div>
                ))}
              </div>
            )}
            {/* 가격 영역 — 맨 아래로 */}
            {(hasPriceSale || design.deadlineText) && (
              <div style={{ marginTop: 'auto', paddingTop: 22 * s }}>
                {design.deadlineText && (
                  <div
                    style={{
                      display: 'inline-flex',
                      padding: `${8 * s}px ${14 * s}px`,
                      background: 'rgba(255,255,255,0.15)',
                      border: `${1 * s}px solid rgba(255,255,255,0.35)`,
                      borderRadius: 999,
                      fontSize: 18 * s,
                      fontWeight: 700,
                      marginBottom: 10 * s,
                    }}
                  >
                    ⏰ {design.deadlineText}
                  </div>
                )}
                {hasPriceSale && (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 * s, flexWrap: 'wrap' }}>
                    {hasPriceOriginal && (
                      <span
                        style={{
                          fontSize: 22 * s,
                          opacity: 0.55,
                          textDecoration: 'line-through',
                        }}
                      >
                        {fmtKrw(design.priceOriginal)}
                      </span>
                    )}
                    <span style={{ fontSize: 64 * s, fontWeight: 900, letterSpacing: '-0.025em' }}>
                      {fmtKrw(design.priceSale)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 우측 이미지 영역 */}
          <div
            style={{
              background: imageBg,
              padding: imageFit === 'contain' ? 24 * s : 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {backgroundImageUrl ? (
              <img
                src={backgroundImageUrl}
                alt=""
                crossOrigin="anonymous"
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: imageFit,
                  objectPosition: 'center',
                  display: 'block',
                }}
                draggable={false}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  background: `linear-gradient(135deg, ${design.palette.accent}33, ${design.palette.accent}cc)`,
                }}
              />
            )}
            {/* 원형 할인 뱃지는 우상단에 겹쳐 표시 */}
            {hasDiscount && showDecoration('discount-circle') && (
              <div
                style={{
                  position: 'absolute',
                  top: 24 * s,
                  right: 24 * s,
                  width: 150 * s,
                  height: 150 * s,
                  borderRadius: '50%',
                  background: design.palette.accent,
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: `0 8px 20px ${design.palette.accent}66`,
                  transform: 'rotate(-8deg)',
                  border: `${3 * s}px solid #fff`,
                }}
              >
                <span style={{ fontSize: 62 * s, fontWeight: 900, lineHeight: 0.9 }}>
                  {design.discountPercent}%
                </span>
                <span style={{ fontSize: 22 * s, fontWeight: 900, letterSpacing: 3 * s }}>OFF</span>
              </div>
            )}
          </div>
        </div>

        {/* 하단 CTA 바 (카드 폭 전체) */}
        {design.ctaLabel && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: ctaHeight,
              background: `linear-gradient(90deg, ${design.palette.accent} 0%, ${shift(design.palette.accent, -18)} 100%)`,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16 * s,
              fontSize: 36 * s,
              fontWeight: 900,
            }}
          >
            {design.ctaLabel}
            <span style={{ fontSize: 28 * s }}>→</span>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // hero — 카드 전체 배경 이미지 + 중앙 프로스티드 박스
  // ══════════════════════════════════════════════════════════
  if (effectiveMode === 'hero') {
    const ctaHeight = design.ctaLabel ? 110 * s : 0
    return (
      <div ref={innerRef} style={{ ...containerBase, background: design.palette.dominant }}>
        {backgroundImageUrl && (
          <img
            src={backgroundImageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: imageFit,
              objectPosition: 'center',
              opacity: 0.7,
            }}
          />
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, ${design.palette.dominant}33 0%, ${design.palette.dominant}cc 100%)`,
          }}
        />
        {design.badgeLabel && (
          <div
            style={{
              position: 'absolute',
              top: 80 * s,
              left: '50%',
              transform: 'translateX(-50%)',
              padding: `${14 * s}px ${40 * s}px`,
              background: design.palette.accent,
              color: '#fff',
              fontSize: 30 * s,
              fontWeight: 900,
              letterSpacing: 5 * s,
              textTransform: 'uppercase',
              boxShadow: `0 10px 24px ${design.palette.accent}aa`,
              clipPath: 'polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)',
            }}
          >
            {design.badgeLabel}
          </div>
        )}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 60 * s,
            color: design.palette.textOnDominant,
            textAlign: 'center',
          }}
        >
          {hasDiscount && showDecoration('big-number') && (
            <div
              style={{
                fontSize: 320 * s,
                fontWeight: 900,
                lineHeight: 0.85,
                letterSpacing: '-0.06em',
                backgroundImage: `linear-gradient(180deg, #fff 0%, ${design.palette.accent} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: `drop-shadow(0 8px 24px ${design.palette.accent}aa)`,
                marginBottom: 12 * s,
              }}
            >
              {design.discountPercent}%
            </div>
          )}
          <div
            style={{
              padding: `${20 * s}px ${32 * s}px`,
              background: 'rgba(255,255,255,0.14)',
              border: `${2 * s}px solid rgba(255,255,255,0.3)`,
              backdropFilter: 'blur(10px)',
              borderRadius: 14 * s,
              maxWidth: '85%',
            }}
          >
            <h2
              style={{
                fontSize: (hasDiscount ? 44 : 70) * s,
                fontWeight: 900,
                lineHeight: 1.08,
                margin: 0,
                letterSpacing: '-0.025em',
              }}
            >
              {design.title}
            </h2>
            {design.subtitle && (
              <div
                style={{
                  fontSize: 26 * s,
                  fontWeight: 600,
                  marginTop: 10 * s,
                  opacity: 0.95,
                }}
              >
                {design.subtitle}
              </div>
            )}
          </div>
          {design.deadlineText && (
            <div
              style={{
                marginTop: 22 * s,
                padding: `${12 * s}px ${24 * s}px`,
                border: `${2 * s}px solid currentColor`,
                borderRadius: 999,
                fontSize: 22 * s,
                fontWeight: 800,
                background: 'rgba(0,0,0,0.4)',
              }}
            >
              ⏰ {design.deadlineText}
            </div>
          )}
        </div>
        {design.ctaLabel && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: ctaHeight,
              background: `linear-gradient(90deg, ${design.palette.accent} 0%, ${shift(design.palette.accent, -18)} 100%)`,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36 * s,
              fontWeight: 900,
              gap: 16 * s,
            }}
          >
            {design.ctaLabel}
            <span style={{ fontSize: 28 * s }}>→</span>
          </div>
        )}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════
  // top-image — 상단 이미지 + 하단 솔리드 카드
  // ══════════════════════════════════════════════════════════
  const imageBg = secondaryColor ?? shift(design.palette.dominant, 40)
  return (
    <div ref={innerRef} style={{ ...containerBase, background: design.palette.dominant }}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '55%',
          background: imageBg,
          padding: imageFit === 'contain' ? 20 * s : 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {backgroundImageUrl && (
          <img
            src={backgroundImageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              width: '100%',
              height: '100%',
              objectFit: imageFit,
              objectPosition: 'center',
              display: 'block',
            }}
          />
        )}
      </div>
      {/* 우상단 할인 뱃지 — 이미지와 카드 경계에 올라앉음 */}
      {hasDiscount && showDecoration('discount-circle') && (
        <div
          style={{
            position: 'absolute',
            top: '48%',
            right: 36 * s,
            transform: 'translateY(-50%) rotate(-8deg)',
            width: 140 * s,
            height: 140 * s,
            borderRadius: '50%',
            background: design.palette.accent,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 10px 24px ${design.palette.accent}66`,
            border: `${3 * s}px solid #fff`,
            zIndex: 2,
          }}
        >
          <span style={{ fontSize: 56 * s, fontWeight: 900, lineHeight: 0.9 }}>
            {design.discountPercent}%
          </span>
          <span style={{ fontSize: 20 * s, fontWeight: 900, letterSpacing: 3 * s }}>OFF</span>
        </div>
      )}
      <div
        style={{
          position: 'absolute',
          top: '55%',
          left: 0,
          right: 0,
          bottom: 0,
          background: design.palette.dominant,
          color: design.palette.textOnDominant,
          padding: 44 * s,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div>
          {design.badgeLabel && (
            <span
              style={{
                display: 'inline-block',
                background: design.palette.accent,
                color: '#fff',
                fontSize: 18 * s,
                fontWeight: 900,
                letterSpacing: 2 * s,
                padding: `${8 * s}px ${14 * s}px`,
                marginBottom: 14 * s,
                textTransform: 'uppercase',
              }}
            >
              {design.badgeLabel}
            </span>
          )}
          <h2
            style={{
              fontSize: 56 * s,
              fontWeight: 900,
              lineHeight: 1.02,
              margin: 0,
              letterSpacing: '-0.025em',
            }}
          >
            {design.title}
          </h2>
          {design.subtitle && (
            <div style={{ fontSize: 22 * s, fontWeight: 600, marginTop: 8 * s, opacity: 0.9 }}>
              {design.subtitle}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 14 * s }}>
          {hasPriceSale ? (
            <div>
              {hasPriceOriginal && (
                <span style={{ fontSize: 18 * s, opacity: 0.5, textDecoration: 'line-through', marginRight: 8 * s }}>
                  {fmtKrw(design.priceOriginal)}
                </span>
              )}
              <span style={{ fontSize: 52 * s, fontWeight: 900 }}>{fmtKrw(design.priceSale)}</span>
            </div>
          ) : (
            <div style={{ fontSize: 18 * s, fontWeight: 500, opacity: 0.85 }}>{design.body}</div>
          )}
          {design.ctaLabel && (
            <span
              style={{
                background: design.palette.accent,
                color: '#fff',
                padding: `${12 * s}px ${22 * s}px`,
                fontSize: 22 * s,
                fontWeight: 900,
                borderRadius: 10 * s,
                flexShrink: 0,
              }}
            >
              {design.ctaLabel} →
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
