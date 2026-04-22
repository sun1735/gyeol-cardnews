'use client'

// AI 가 결정한 design 스펙(layout·palette·decorations) 을 렌더하는 단일 컴포넌트.
// 매번 다른 레이아웃·컬러가 나올 수 있음 — 고정 템플릿 탈피.
// 텍스트는 DOM(한글 Pretendard), 이미지 안엔 텍스트 넣지 않음.

import type { CSSProperties } from 'react'
import type { DynamicDesign } from '@/lib/types'

export interface DynamicCardProps {
  design: DynamicDesign
  backgroundImageUrl?: string
  displayWidth: number
  aspectRatio: '1:1' | '4:5' | '9:16'
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

export function DynamicCard({
  design,
  backgroundImageUrl,
  displayWidth,
  aspectRatio,
  innerRef,
}: DynamicCardProps) {
  const ratioH = aspectRatio === '1:1' ? 1 : aspectRatio === '4:5' ? 1.25 : 16 / 9
  const displayHeight = Math.round(displayWidth * ratioH)
  const s = displayWidth / 1080

  const container: CSSProperties = {
    width: displayWidth,
    height: displayHeight,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16 * s,
    fontFamily: 'Pretendard, ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontFeatureSettings: '"palt"',
    background: '#0a0a0a',
    boxShadow: '0 8px 28px rgba(0,0,0,0.15)',
    letterSpacing: '-0.01em',
  }

  const hasDiscount =
    typeof design.discountPercent === 'number' &&
    design.discountPercent >= 1 &&
    design.discountPercent <= 99
  const hasPriceSale = typeof design.priceSale === 'number' && design.priceSale > 0
  const hasPriceOriginal =
    typeof design.priceOriginal === 'number' && design.priceOriginal > (design.priceSale ?? 0)
  const showDecoration = (k: string) => Array.isArray(design.decorations) && design.decorations.includes(k)

  // 레이아웃별 렌더링 분기
  if (design.layout === 'image-top-card-bottom') {
    return (
      <div ref={innerRef} style={container}>
        {backgroundImageUrl && (
          <img
            src={backgroundImageUrl}
            alt=""
            crossOrigin="anonymous"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '60%',
              objectFit: 'cover',
            }}
          />
        )}
        {/* 하단 솔리드 카드 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '42%',
            background: design.palette.dominant,
            color: design.palette.textOnDominant,
            padding: 48 * s,
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
                  padding: `${8 * s}px ${16 * s}px`,
                  marginBottom: 16 * s,
                  textTransform: 'uppercase',
                }}
              >
                {design.badgeLabel}
              </span>
            )}
            <h2
              style={{
                fontSize: 58 * s,
                fontWeight: 900,
                lineHeight: 1.02,
                margin: 0,
                letterSpacing: '-0.025em',
              }}
            >
              {design.title}
            </h2>
            {design.subtitle && (
              <div
                style={{
                  fontSize: 24 * s,
                  fontWeight: 600,
                  marginTop: 10 * s,
                  opacity: 0.9,
                }}
              >
                {design.subtitle}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16 * s }}>
            {hasPriceSale ? (
              <div>
                {hasPriceOriginal && (
                  <span
                    style={{
                      fontSize: 20 * s,
                      opacity: 0.5,
                      textDecoration: 'line-through',
                      marginRight: 10 * s,
                    }}
                  >
                    {fmtKrw(design.priceOriginal)}
                  </span>
                )}
                <span style={{ fontSize: 56 * s, fontWeight: 900, letterSpacing: '-0.02em' }}>
                  {fmtKrw(design.priceSale)}
                </span>
              </div>
            ) : (
              <div style={{ fontSize: 20 * s, fontWeight: 500, opacity: 0.85 }}>{design.body}</div>
            )}
            {design.ctaLabel && (
              <span
                style={{
                  background: design.palette.accent,
                  color: '#fff',
                  padding: `${14 * s}px ${24 * s}px`,
                  fontSize: 24 * s,
                  fontWeight: 900,
                  borderRadius: 12 * s,
                  flexShrink: 0,
                }}
              >
                {design.ctaLabel} →
              </span>
            )}
          </div>
        </div>
        {/* 우상단 원형 할인 뱃지 — 이미지와 카드 경계에 올라앉음 */}
        {hasDiscount && showDecoration('discount-circle') && (
          <div
            style={{
              position: 'absolute',
              top: '45%',
              right: 40 * s,
              transform: 'translateY(-50%) rotate(-8deg)',
              width: 160 * s,
              height: 160 * s,
              borderRadius: '50%',
              background: design.palette.accent,
              color: '#fff',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 10px 24px ${design.palette.accent}66`,
              border: `${4 * s}px solid #fff`,
              zIndex: 2,
            }}
          >
            <span style={{ fontSize: 64 * s, fontWeight: 900, lineHeight: 0.9 }}>
              {design.discountPercent}%
            </span>
            <span style={{ fontSize: 22 * s, fontWeight: 800, letterSpacing: 3 * s, marginTop: 4 * s }}>
              OFF
            </span>
          </div>
        )}
      </div>
    )
  }

  if (design.layout === 'fullbleed-center-glass') {
    return (
      <div ref={innerRef} style={container}>
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
              objectFit: 'cover',
              opacity: 0.65,
            }}
          />
        )}
        {/* 라디얼 비네트로 중앙 강조 */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse at center, ${design.palette.dominant}00 0%, ${design.palette.dominant}aa 55%, ${design.palette.dominant}ee 100%)`,
          }}
        />
        {/* 상단 리본 뱃지 */}
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
              fontSize: 32 * s,
              fontWeight: 900,
              letterSpacing: 6 * s,
              textTransform: 'uppercase',
              boxShadow: `0 10px 24px ${design.palette.accent}aa`,
              clipPath: 'polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)',
            }}
          >
            {design.badgeLabel}
          </div>
        )}
        {/* 중앙 큰 숫자 (할인 있을 때) 또는 타이틀 */}
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
                fontSize: 360 * s,
                fontWeight: 900,
                lineHeight: 0.85,
                letterSpacing: '-0.06em',
                backgroundImage: `linear-gradient(180deg, #fff 0%, ${design.palette.accent} 100%)`,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                filter: `drop-shadow(0 8px 24px ${design.palette.accent}aa)`,
                marginBottom: 10 * s,
              }}
            >
              {design.discountPercent}%
            </div>
          )}
          <div
            style={{
              padding: `${20 * s}px ${32 * s}px`,
              background: 'rgba(255,255,255,0.12)',
              border: `${2 * s}px solid rgba(255,255,255,0.25)`,
              backdropFilter: 'blur(10px)',
              borderRadius: 16 * s,
              maxWidth: '85%',
            }}
          >
            <h2
              style={{
                fontSize: (hasDiscount ? 44 : 72) * s,
                fontWeight: 900,
                lineHeight: 1.1,
                margin: 0,
                letterSpacing: '-0.025em',
              }}
            >
              {design.title}
            </h2>
            {design.subtitle && (
              <div
                style={{
                  fontSize: 24 * s,
                  fontWeight: 600,
                  marginTop: 8 * s,
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
                marginTop: 24 * s,
                padding: `${12 * s}px ${24 * s}px`,
                border: `${2 * s}px solid currentColor`,
                borderRadius: 999,
                fontSize: 24 * s,
                fontWeight: 800,
                background: 'rgba(0,0,0,0.4)',
              }}
            >
              ⏰ {design.deadlineText}
            </div>
          )}
        </div>
        {/* 하단 CTA 바 */}
        {design.ctaLabel && (
          <div
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 110 * s,
              background: `linear-gradient(90deg, ${design.palette.accent} 0%, ${shift(design.palette.accent, -20)} 100%)`,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 38 * s,
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

  // default: split-dark-left (좌측 다크 패널 + 우측 이미지)
  const panelWidth = Math.round(displayWidth * 0.52)
  const ctaHeight = design.ctaLabel ? 120 * s : 0

  return (
    <div ref={innerRef} style={container}>
      {backgroundImageUrl ? (
        <img
          src={backgroundImageUrl}
          alt=""
          crossOrigin="anonymous"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'right center',
          }}
        />
      ) : (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${design.palette.accent}33, ${design.palette.accent}cc)`,
          }}
        />
      )}
      {/* 좌측 솔리드 패널 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: panelWidth,
          height: displayHeight - ctaHeight,
          background: design.palette.dominant,
          opacity: 0.96,
        }}
      />
      {/* 경계 장식 라인 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: panelWidth,
          width: 4 * s,
          height: displayHeight - ctaHeight,
          background: design.palette.accent,
        }}
      />
      {/* 좌상단 코너 액센트 */}
      {showDecoration('corner-accent') && (
        <div
          style={{
            position: 'absolute',
            top: 28 * s,
            left: 28 * s,
            width: 56 * s,
            height: 56 * s,
            borderLeft: `${3 * s}px solid ${design.palette.accent}`,
            borderTop: `${3 * s}px solid ${design.palette.accent}`,
          }}
        />
      )}
      {/* 우상단 할인 원 뱃지 */}
      {hasDiscount && showDecoration('discount-circle') && (
        <div
          style={{
            position: 'absolute',
            top: 40 * s,
            right: 40 * s,
            width: 170 * s,
            height: 170 * s,
            borderRadius: '50%',
            background: design.palette.accent,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 10px 24px ${design.palette.accent}66`,
            transform: 'rotate(-8deg)',
            border: `${4 * s}px solid #fff`,
          }}
        >
          <span style={{ fontSize: 72 * s, fontWeight: 900, lineHeight: 0.9 }}>
            {design.discountPercent}%
          </span>
          <span style={{ fontSize: 26 * s, fontWeight: 900, letterSpacing: 4 * s }}>OFF</span>
        </div>
      )}
      {/* 좌측 패널 콘텐츠 */}
      <div
        style={{
          position: 'absolute',
          top: 80 * s,
          left: 52 * s,
          width: panelWidth - 90 * s,
          bottom: ctaHeight + 40 * s,
          display: 'flex',
          flexDirection: 'column',
          color: design.palette.textOnDominant,
        }}
      >
        {design.badgeLabel && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: `${12 * s}px ${20 * s}px`,
              background: design.palette.accent,
              color: '#fff',
              fontSize: 24 * s,
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
            fontSize: 100 * s,
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
              fontSize: 32 * s,
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
              fontSize: 24 * s,
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
              gap: `${16 * s}px ${20 * s}px`,
              marginTop: 28 * s,
            }}
          >
            {design.features.slice(0, 4).map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 * s }}>
                <span
                  style={{
                    width: 50 * s,
                    height: 50 * s,
                    borderRadius: 10 * s,
                    background: design.palette.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 26 * s,
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </span>
                <span style={{ fontSize: 22 * s, fontWeight: 700 }}>{f.label}</span>
              </div>
            ))}
          </div>
        )}
        {hasPriceSale && (
          <div style={{ marginTop: 'auto', paddingTop: 24 * s }}>
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
                  marginBottom: 12 * s,
                }}
              >
                ⏰ {design.deadlineText}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 * s, flexWrap: 'wrap' }}>
              {hasPriceOriginal && (
                <span
                  style={{
                    fontSize: 26 * s,
                    opacity: 0.55,
                    textDecoration: 'line-through',
                  }}
                >
                  {fmtKrw(design.priceOriginal)}
                </span>
              )}
              <span style={{ fontSize: 72 * s, fontWeight: 900, letterSpacing: '-0.025em' }}>
                {fmtKrw(design.priceSale)}
              </span>
            </div>
          </div>
        )}
      </div>
      {/* 하단 CTA 바 */}
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
            fontSize: 40 * s,
            fontWeight: 900,
            gap: 18 * s,
          }}
        >
          {design.ctaLabel}
          <span style={{ fontSize: 30 * s }}>→</span>
        </div>
      )}
    </div>
  )
}
