'use client'

// 상품 광고 카드 템플릿.
// 레이아웃: 배경 이미지(풀블리드) + 좌측 반투명 그라디언트 위에 BEST SELLER 뱃지 / 타이틀 / 서브 /
// features 4개 아이콘 / 컬러 스와치 / 원가-할인가 / 우상단 원형 OFF 뱃지 / 하단 CTA 바.
// 텍스트는 모두 DOM(한국어 Pretendard) 으로 렌더 — 이미지 안에는 텍스트를 절대 넣지 않는다.
// 1:1 / 4:5 비율 모두 지원. d.display(표시 폭) 를 기준으로 내부 값을 px 으로 스케일.

import type { CSSProperties } from 'react'

export interface ProductAdFeature {
  icon: string
  label: string
}

export interface ProductAdCardProps {
  title: string
  subtitle?: string
  body?: string
  badgeLabel?: string // 예: "BEST SELLER"
  features?: ProductAdFeature[]
  colors?: string[] // HEX
  priceOriginal?: number
  priceSale?: number
  discountPercent?: number
  deadlineText?: string
  ctaLabel?: string
  backgroundImageUrl?: string
  // 표시 폭(px). 1:1=360, 4:5=340 등 CardItem 에서 주입.
  displayWidth: number
  // 높이/가로 비율 — '1:1' 또는 '4:5'.
  aspectRatio: '1:1' | '4:5' | '9:16'
  // 브랜드 primary 컬러 — 뱃지·CTA 기본색. 미지정 시 indigo.
  primaryColor?: string
  // 카드 export 시 html-to-image 에서 쓰이는 외부 ref
  innerRef?: React.Ref<HTMLDivElement>
}

export function ProductAdCard({
  title,
  subtitle,
  body,
  badgeLabel,
  features = [],
  colors = [],
  priceOriginal,
  priceSale,
  discountPercent,
  deadlineText,
  ctaLabel,
  backgroundImageUrl,
  displayWidth,
  aspectRatio,
  primaryColor = '#4338ca',
  innerRef,
}: ProductAdCardProps) {
  const ratioH = aspectRatio === '1:1' ? 1 : aspectRatio === '4:5' ? 1.25 : 16 / 9
  const displayHeight = Math.round(displayWidth * ratioH)

  // 내부 스케일 기준 — 1080px 폭을 기준으로 설계하고 displayWidth 로 축소 렌더.
  const s = displayWidth / 1080

  // 가격 포맷 — 원화, 천단위 컴마.
  const fmt = (n?: number) =>
    typeof n === 'number' && Number.isFinite(n) ? `₩${n.toLocaleString('ko-KR')}` : ''

  const hasPriceSale = typeof priceSale === 'number' && priceSale > 0
  const hasPriceOriginal = typeof priceOriginal === 'number' && priceOriginal > priceSale!
  const hasDiscount = typeof discountPercent === 'number' && discountPercent >= 1 && discountPercent <= 99

  const containerStyle: CSSProperties = {
    width: displayWidth,
    height: displayHeight,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 12 * s,
    fontFamily: 'Pretendard, ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontFeatureSettings: '"palt"',
    background: backgroundImageUrl ? undefined : '#e5e7eb',
    boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
    color: '#111827',
    letterSpacing: '-0.01em',
  }

  return (
    <div ref={innerRef} style={containerStyle}>
      {/* 배경 이미지 */}
      {backgroundImageUrl && (
        <img
          src={backgroundImageUrl}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
          draggable={false}
        />
      )}

      {/* 좌측 그라디언트 오버레이 — 텍스트 가독성 확보 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0) 75%)',
        }}
      />

      {/* 우상단 원형 할인 뱃지 */}
      {hasDiscount && (
        <div
          style={{
            position: 'absolute',
            top: 28 * s,
            right: 28 * s,
            width: 148 * s,
            height: 148 * s,
            borderRadius: '50%',
            background: primaryColor,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 18px rgba(0,0,0,0.25)',
            transform: 'rotate(-8deg)',
          }}
          aria-label={`${discountPercent}퍼센트 할인`}
        >
          <span style={{ fontSize: 52 * s, fontWeight: 900, lineHeight: 1 }}>{discountPercent}%</span>
          <span style={{ fontSize: 18 * s, fontWeight: 700, letterSpacing: 2 * s, marginTop: 4 * s }}>
            OFF
          </span>
        </div>
      )}

      {/* 좌측 정보 레이어 */}
      <div
        style={{
          position: 'absolute',
          left: 56 * s,
          right: 56 * s,
          top: 56 * s,
          bottom: (ctaLabel ? 120 : 56) * s, // CTA 바 여백
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          color: '#fff',
        }}
      >
        <div>
          {badgeLabel && (
            <span
              style={{
                display: 'inline-block',
                padding: `${6 * s}px ${14 * s}px`,
                borderRadius: 999,
                background: '#fff',
                color: primaryColor,
                fontSize: 18 * s,
                fontWeight: 800,
                letterSpacing: 1.2 * s,
                marginBottom: 18 * s,
                textTransform: 'uppercase',
              }}
            >
              {badgeLabel}
            </span>
          )}
          <h2
            style={{
              fontSize: 72 * s,
              fontWeight: 900,
              lineHeight: 1.1,
              margin: 0,
              textShadow: '0 2px 10px rgba(0,0,0,0.35)',
              maxWidth: '70%',
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                fontSize: 28 * s,
                fontWeight: 500,
                lineHeight: 1.4,
                marginTop: 14 * s,
                opacity: 0.95,
                textShadow: '0 1px 6px rgba(0,0,0,0.35)',
                maxWidth: '65%',
              }}
            >
              {subtitle}
            </p>
          )}
          {body && (
            <p
              style={{
                fontSize: 22 * s,
                fontWeight: 400,
                lineHeight: 1.5,
                marginTop: 12 * s,
                opacity: 0.9,
                textShadow: '0 1px 6px rgba(0,0,0,0.3)',
                maxWidth: '58%',
              }}
            >
              {body}
            </p>
          )}

          {/* Features 4개 아이콘 가로 나열 */}
          {features.length > 0 && (
            <div
              style={{
                display: 'flex',
                gap: 18 * s,
                marginTop: 30 * s,
                flexWrap: 'wrap',
              }}
            >
              {features.slice(0, 4).map((f, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    minWidth: 92 * s,
                  }}
                >
                  <div
                    style={{
                      width: 72 * s,
                      height: 72 * s,
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.2)',
                      border: `${1.5 * s}px solid rgba(255,255,255,0.5)`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 36 * s,
                      backdropFilter: 'blur(6px)',
                    }}
                  >
                    <span>{f.icon}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 18 * s,
                      fontWeight: 600,
                      marginTop: 8 * s,
                      textAlign: 'center',
                    }}
                  >
                    {f.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 컬러 스와치 */}
          {colors.length > 0 && (
            <div style={{ display: 'flex', gap: 10 * s, marginTop: 28 * s }}>
              {colors.slice(0, 6).map((c, i) => (
                <span
                  key={i}
                  title={c}
                  style={{
                    width: 28 * s,
                    height: 28 * s,
                    borderRadius: '50%',
                    background: c,
                    border: `${2 * s}px solid rgba(255,255,255,0.9)`,
                    boxShadow: '0 2px 4px rgba(0,0,0,0.25)',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* 가격 영역 */}
        {hasPriceSale && (
          <div style={{ marginTop: 24 * s }}>
            {deadlineText && (
              <div
                style={{
                  fontSize: 20 * s,
                  fontWeight: 600,
                  opacity: 0.95,
                  marginBottom: 6 * s,
                  textShadow: '0 1px 6px rgba(0,0,0,0.3)',
                }}
              >
                ⏰ {deadlineText}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 * s }}>
              {hasPriceOriginal && (
                <span
                  style={{
                    fontSize: 24 * s,
                    color: 'rgba(255,255,255,0.75)',
                    textDecoration: 'line-through',
                    fontWeight: 500,
                  }}
                >
                  {fmt(priceOriginal)}
                </span>
              )}
              <span
                style={{
                  fontSize: 56 * s,
                  fontWeight: 900,
                  textShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }}
              >
                {fmt(priceSale)}
              </span>
            </div>
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
