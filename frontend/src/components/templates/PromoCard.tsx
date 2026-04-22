'use client'

// 프로모션(이벤트·세일) 카드 템플릿.
// 레이아웃: 배경 이미지 + 중앙 대형 할인율 텍스트 + 상단 EVENT 뱃지 + 하단 기간/CTA.
// product-ad 가 "제품 중심(좌측 정보 레이어)" 이라면, promo 는 "할인율 중심" — 큰 숫자와 기간이 주인공.
// 한글 폰트 Pretendard, 텍스트는 전부 DOM.

import type { CSSProperties } from 'react'

export interface PromoCardProps {
  title: string // 행사명 ("봄맞이 대세일")
  subtitle?: string // 카피 ("모든 상품 최대 할인")
  discountPercent?: number // 중앙 대형 숫자
  discountLabel?: string // 할인율 대체 라벨 (퍼센트 없이 "1+1" 같은 경우)
  deadlineText?: string // "5월 5일 23:59 마감"
  ctaLabel?: string
  badgeLabel?: string // "EVENT", "SALE", "한정 수량"
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
    borderRadius: 12 * s,
    fontFamily: 'Pretendard, ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontFeatureSettings: '"palt"',
    background: backgroundImageUrl ? '#0f172a' : '#1f2937',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    color: '#fff',
    letterSpacing: '-0.01em',
  }

  const bigNumber = typeof discountPercent === 'number' ? `${discountPercent}%` : discountLabel

  return (
    <div ref={innerRef} style={containerStyle}>
      {/* 배경 이미지 */}
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
            opacity: 0.55, // 배경을 어둡게 — 중앙 숫자가 주인공
          }}
          draggable={false}
        />
      )}
      {/* 짙은 비네트 + 상하 그라디언트 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 35%, rgba(0,0,0,0.65) 100%)',
        }}
      />

      {/* 상단 뱃지 */}
      {badgeLabel && (
        <div
          style={{
            position: 'absolute',
            top: 48 * s,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: `${10 * s}px ${24 * s}px`,
            borderRadius: 999,
            background: primaryColor,
            color: '#fff',
            fontSize: 22 * s,
            fontWeight: 800,
            letterSpacing: 3 * s,
            textTransform: 'uppercase',
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
          }}
        >
          {badgeLabel}
        </div>
      )}

      {/* 중앙 타이틀 + 대형 숫자 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 48 * s,
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            fontSize: 48 * s,
            fontWeight: 800,
            margin: 0,
            lineHeight: 1.2,
            textShadow: '0 2px 12px rgba(0,0,0,0.45)',
          }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            style={{
              fontSize: 26 * s,
              fontWeight: 500,
              margin: `${12 * s}px 0 ${32 * s}px 0`,
              opacity: 0.92,
              textShadow: '0 1px 6px rgba(0,0,0,0.35)',
              maxWidth: '80%',
            }}
          >
            {subtitle}
          </p>
        )}
        {bigNumber && (
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 8 * s,
              margin: `${16 * s}px 0`,
            }}
          >
            <span
              style={{
                fontSize: 240 * s,
                fontWeight: 900,
                lineHeight: 1,
                color: '#fff',
                textShadow: `0 6px 24px ${primaryColor}aa, 0 2px 8px rgba(0,0,0,0.5)`,
                fontFeatureSettings: '"tnum"',
              }}
            >
              {bigNumber}
            </span>
            {typeof discountPercent === 'number' && (
              <span
                style={{
                  fontSize: 40 * s,
                  fontWeight: 800,
                  letterSpacing: 4 * s,
                  color: '#fff',
                  textShadow: '0 2px 8px rgba(0,0,0,0.45)',
                }}
              >
                OFF
              </span>
            )}
          </div>
        )}
        {deadlineText && (
          <div
            style={{
              marginTop: 20 * s,
              fontSize: 24 * s,
              fontWeight: 700,
              padding: `${8 * s}px ${20 * s}px`,
              border: `${2 * s}px solid rgba(255,255,255,0.9)`,
              borderRadius: 999,
              letterSpacing: 1 * s,
            }}
          >
            ⏰ {deadlineText}
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
            height: 96 * s,
            background: primaryColor,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 30 * s,
            fontWeight: 800,
            letterSpacing: 0.4 * s,
          }}
        >
          {ctaLabel}
          <span style={{ marginLeft: 12 * s, fontSize: 28 * s }}>→</span>
        </div>
      )}
    </div>
  )
}
