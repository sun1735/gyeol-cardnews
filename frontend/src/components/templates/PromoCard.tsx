'use client'

// 프로모션 카드 템플릿 v2 — 드라마틱한 세일 포스터 감각.
// 레이아웃: 어두운 배경 + 상단 리본 뱃지 + 중앙 거대한 그라디언트 숫자 + 좌우 장식선 +
//   하단 타이틀 블록(솔리드 박스) + CTA 바.
// 가독성: 중앙 숫자는 strokeText 느낌으로 외곽선 + 그라디언트 필. 타이틀은 솔리드 박스 위.

import type { CSSProperties } from 'react'

export interface PromoCardProps {
  title: string
  subtitle?: string
  discountPercent?: number
  discountLabel?: string
  deadlineText?: string
  ctaLabel?: string
  badgeLabel?: string
  backgroundImageUrl?: string
  displayWidth: number
  aspectRatio: '1:1' | '4:5' | '9:16'
  primaryColor?: string
  innerRef?: React.Ref<HTMLDivElement>
}

export function PromoCard({
  title,
  subtitle,
  discountPercent,
  discountLabel,
  deadlineText,
  ctaLabel,
  badgeLabel = 'EVENT',
  backgroundImageUrl,
  displayWidth,
  aspectRatio,
  primaryColor = '#dc2626',
  innerRef,
}: PromoCardProps) {
  const ratioH = aspectRatio === '1:1' ? 1 : aspectRatio === '4:5' ? 1.25 : 16 / 9
  const displayHeight = Math.round(displayWidth * ratioH)
  const s = displayWidth / 1080

  const containerStyle: CSSProperties = {
    width: displayWidth,
    height: displayHeight,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16 * s,
    fontFamily: 'Pretendard, ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontFeatureSettings: '"palt"',
    background: '#0b0b14',
    boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
    color: '#fff',
    letterSpacing: '-0.01em',
  }

  const bigNumber = typeof discountPercent === 'number' ? `${discountPercent}` : discountLabel
  const showPercentSign = typeof discountPercent === 'number'
  const ctaHeight = ctaLabel ? 130 * s : 0

  // 브랜드 컬러 그라디언트 — 중앙 숫자용
  const numberGradient = `linear-gradient(180deg, #fff 0%, ${primaryColor} 100%)`

  return (
    <div ref={innerRef} style={containerStyle}>
      {/* 배경 이미지 — 블러·암전 처리로 숫자에 집중 */}
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
            objectPosition: 'center',
            opacity: 0.42,
            filter: 'saturate(1.15) contrast(1.05)',
          }}
          draggable={false}
        />
      )}
      {/* 전체 비네트 + 라디얼 스포트라이트 — 중앙 숫자가 떠오르게 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at center, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.92) 100%)`,
        }}
      />
      {/* 브랜드 컬러 라이트 리크 — 위에서 아래로 은근한 글로우 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(180deg, ${primaryColor}22 0%, rgba(0,0,0,0) 40%)`,
          pointerEvents: 'none',
        }}
      />

      {/* 상단 장식 — 카드 폭 전체 가로줄 + 사이드 라벨 */}
      <div
        style={{
          position: 'absolute',
          top: 56 * s,
          left: 60 * s,
          right: 60 * s,
          display: 'flex',
          alignItems: 'center',
          gap: 16 * s,
        }}
      >
        <div style={{ flex: 1, height: 3 * s, background: 'rgba(255,255,255,0.55)' }} />
        <span
          style={{
            fontSize: 20 * s,
            fontWeight: 900,
            letterSpacing: 6 * s,
            color: '#ffffff',
          }}
        >
          LIMITED TIME
        </span>
        <div style={{ flex: 1, height: 3 * s, background: 'rgba(255,255,255,0.55)' }} />
      </div>

      {/* 상단 리본 뱃지 */}
      {badgeLabel && (
        <div
          style={{
            position: 'absolute',
            top: 110 * s,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: `${16 * s}px ${48 * s}px`,
            background: primaryColor,
            color: '#fff',
            fontSize: 40 * s,
            fontWeight: 900,
            letterSpacing: 7 * s,
            textTransform: 'uppercase',
            boxShadow: `0 10px 24px ${primaryColor}aa, 0 2px 8px rgba(0,0,0,0.4)`,
            clipPath:
              'polygon(10% 0%, 90% 0%, 100% 50%, 90% 100%, 10% 100%, 0% 50%)',
          }}
        >
          {badgeLabel}
        </div>
      )}

      {/* 중앙 숫자 영역 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          paddingTop: badgeLabel ? 220 * s : 150 * s,
          paddingBottom: ctaHeight + 40 * s,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {bigNumber && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'flex-start',
              gap: 12 * s,
              filter: `drop-shadow(0 10px 28px ${primaryColor}aa) drop-shadow(0 2px 6px rgba(0,0,0,0.6))`,
            }}
          >
            <span
              style={{
                fontSize: 420 * s,
                fontWeight: 900,
                lineHeight: 0.82,
                letterSpacing: '-0.06em',
                backgroundImage: numberGradient,
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
                WebkitTextStroke: `${3 * s}px rgba(255,255,255,0.25)`,
                fontFeatureSettings: '"tnum"',
              }}
            >
              {bigNumber}
            </span>
            {showPercentSign && (
              <span
                style={{
                  fontSize: 170 * s,
                  fontWeight: 900,
                  lineHeight: 1,
                  marginTop: 24 * s,
                  color: '#ffffff',
                  letterSpacing: '-0.04em',
                }}
              >
                %
              </span>
            )}
          </div>
        )}
        {showPercentSign && (
          <div
            style={{
              marginTop: -12 * s,
              fontSize: 58 * s,
              fontWeight: 900,
              letterSpacing: 14 * s,
              color: '#ffffff',
              textTransform: 'uppercase',
              textShadow: `0 4px 12px ${primaryColor}aa`,
            }}
          >
            O F F
          </div>
        )}

        {/* 타이틀 블록 */}
        <div
          style={{
            marginTop: 40 * s,
            padding: `${22 * s}px ${36 * s}px`,
            background: 'rgba(255,255,255,0.14)',
            border: `${2 * s}px solid rgba(255,255,255,0.3)`,
            backdropFilter: 'blur(8px)',
            borderRadius: 14 * s,
            textAlign: 'center',
            maxWidth: '85%',
          }}
        >
          <div
            style={{
              fontSize: 56 * s,
              fontWeight: 900,
              lineHeight: 1.1,
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            {title}
          </div>
          {subtitle && (
            <div
              style={{
                fontSize: 30 * s,
                fontWeight: 600,
                lineHeight: 1.4,
                marginTop: 12 * s,
                color: '#ffffff',
              }}
            >
              {subtitle}
            </div>
          )}
        </div>

        {deadlineText && (
          <div
            style={{
              marginTop: 28 * s,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 12 * s,
              padding: `${14 * s}px ${30 * s}px`,
              border: `${3 * s}px solid #ffffff`,
              borderRadius: 999,
              fontSize: 28 * s,
              fontWeight: 800,
              letterSpacing: 1 * s,
              color: '#ffffff',
              background: 'rgba(0,0,0,0.5)',
            }}
          >
            <span style={{ fontSize: 28 * s }}>⏰</span>
            <span>{deadlineText}</span>
          </div>
        )}
      </div>

      {/* 하단 CTA 바 */}
      {ctaLabel && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: ctaHeight,
            background: `linear-gradient(90deg, ${primaryColor} 0%, ${shiftColor(
              primaryColor,
              -18,
            )} 100%)`,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18 * s,
            fontSize: 42 * s,
            fontWeight: 900,
            letterSpacing: '-0.01em',
          }}
        >
          <span>{ctaLabel}</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 54 * s,
              height: 54 * s,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.3)',
              fontSize: 32 * s,
              fontWeight: 900,
            }}
          >
            →
          </span>
        </div>
      )}
    </div>
  )
}

function shiftColor(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const n = parseInt(clean, 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
