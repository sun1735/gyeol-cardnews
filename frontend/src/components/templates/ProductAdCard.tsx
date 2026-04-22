'use client'

// 상품 광고 카드 템플릿 v2 — 가독성·존재감 강화판.
// 레이아웃: 우측 60% 에 이미지(풀블리드 크롭), 좌측 52% 에 어두운 솔리드 패널.
//   (이미지와 패널이 살짝 겹쳐 레이어드 느낌.)
//   · 좌측 패널: 브랜드 컬러 보텀 액센트 바 + BEST 리본 + 굵은 제목 + 피처 2열 그리드 + 가격.
//   · 우상단: 큰 원형 할인 뱃지 (패널과 이미지 경계에 올라앉음).
//   · 하단 CTA 바: 브랜드 컬러 풀블리드.
// 가독성: 텍스트는 솔리드 패널 위에서만 렌더 → 그림자에 의존하지 않음. 한글 Pretendard.

import type { CSSProperties } from 'react'

export interface ProductAdFeature {
  icon: string
  label: string
}

export interface ProductAdCardProps {
  title: string
  subtitle?: string
  body?: string
  badgeLabel?: string
  features?: ProductAdFeature[]
  colors?: string[]
  priceOriginal?: number
  priceSale?: number
  discountPercent?: number
  deadlineText?: string
  ctaLabel?: string
  backgroundImageUrl?: string
  displayWidth: number
  aspectRatio: '1:1' | '4:5' | '9:16'
  primaryColor?: string
  innerRef?: React.Ref<HTMLDivElement>
}

// 가격 포맷 (원화, 천단위 컴마).
function fmt(n?: number) {
  return typeof n === 'number' && Number.isFinite(n) ? `₩${n.toLocaleString('ko-KR')}` : ''
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
  const s = displayWidth / 1080

  const hasPriceSale = typeof priceSale === 'number' && priceSale > 0
  const hasPriceOriginal = typeof priceOriginal === 'number' && priceOriginal > (priceSale ?? 0)
  const hasDiscount = typeof discountPercent === 'number' && discountPercent >= 1 && discountPercent <= 99
  const ctaHeight = ctaLabel ? 110 * s : 0

  const containerStyle: CSSProperties = {
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

  // 좌측 패널 너비 (card width 기준 52%).
  const panelWidth = Math.round(displayWidth * 0.52)

  return (
    <div ref={innerRef} style={containerStyle}>
      {/* 배경 이미지 — 우측 전체, 좌측은 솔리드 패널이 덮음 */}
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
          draggable={false}
        />
      ) : (
        // 이미지 없을 때 우측은 브랜드 컬러 블록
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(135deg, ${primaryColor}33, ${primaryColor}cc)`,
          }}
        />
      )}

      {/* 좌측 솔리드 패널 — 아주 어둡고 불투명해서 텍스트가 선명 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: panelWidth,
          height: displayHeight - ctaHeight,
          background:
            'linear-gradient(135deg, rgba(10,10,20,0.97) 0%, rgba(18,22,35,0.95) 100%)',
        }}
      />
      {/* 패널 우측 가장자리 장식 — 브랜드 컬러 수직 바 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: panelWidth,
          width: 4 * s,
          height: displayHeight - ctaHeight,
          background: primaryColor,
        }}
      />

      {/* 패널 좌상단 코너 액센트 — 장식용 L-shape */}
      <div
        style={{
          position: 'absolute',
          top: 28 * s,
          left: 28 * s,
          width: 56 * s,
          height: 56 * s,
          borderLeft: `${3 * s}px solid ${primaryColor}`,
          borderTop: `${3 * s}px solid ${primaryColor}`,
        }}
      />

      {/* 우상단 큰 원형 할인 뱃지 — 패널과 이미지 경계에 올라앉음 */}
      {hasDiscount && (
        <div
          style={{
            position: 'absolute',
            top: 40 * s,
            right: 40 * s,
            width: 170 * s,
            height: 170 * s,
            borderRadius: '50%',
            background: primaryColor,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 10px 24px ${primaryColor}66, 0 4px 12px rgba(0,0,0,0.35)`,
            transform: 'rotate(-8deg)',
            border: `${4 * s}px solid #fff`,
          }}
        >
          <span style={{ fontSize: 58 * s, fontWeight: 900, lineHeight: 0.9 }}>
            {discountPercent}%
          </span>
          <span
            style={{
              fontSize: 20 * s,
              fontWeight: 800,
              letterSpacing: 3 * s,
              marginTop: 4 * s,
            }}
          >
            OFF
          </span>
        </div>
      )}

      {/* 좌측 패널 내부 콘텐츠 */}
      <div
        style={{
          position: 'absolute',
          top: 90 * s,
          left: 52 * s,
          width: panelWidth - 90 * s,
          bottom: ctaHeight + 40 * s,
          display: 'flex',
          flexDirection: 'column',
          color: '#fff',
        }}
      >
        {/* BEST SELLER 리본 */}
        {badgeLabel && (
          <div
            style={{
              alignSelf: 'flex-start',
              padding: `${8 * s}px ${16 * s}px`,
              background: primaryColor,
              color: '#fff',
              fontSize: 18 * s,
              fontWeight: 900,
              letterSpacing: 2 * s,
              textTransform: 'uppercase',
              marginBottom: 22 * s,
              boxShadow: `0 4px 10px ${primaryColor}66`,
              position: 'relative',
            }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 8 * s,
                height: 8 * s,
                background: '#fff',
                borderRadius: '50%',
                marginRight: 8 * s,
                verticalAlign: 'middle',
              }}
            />
            {badgeLabel}
          </div>
        )}

        {/* 타이틀 — 매우 굵고 큼 */}
        <h2
          style={{
            fontSize: 76 * s,
            fontWeight: 900,
            lineHeight: 0.98,
            margin: 0,
            letterSpacing: '-0.03em',
            color: '#fff',
          }}
        >
          {title}
        </h2>

        {/* 서브타이틀 — 브랜드 컬러 · 얇은 언더라인 */}
        {subtitle && (
          <div
            style={{
              fontSize: 24 * s,
              fontWeight: 600,
              lineHeight: 1.35,
              marginTop: 14 * s,
              color: primaryColor,
              paddingBottom: 12 * s,
              borderBottom: `${2 * s}px solid rgba(255,255,255,0.15)`,
              letterSpacing: '-0.005em',
            }}
          >
            {subtitle}
          </div>
        )}

        {/* 본문 한 줄 */}
        {body && (
          <div
            style={{
              fontSize: 20 * s,
              fontWeight: 400,
              lineHeight: 1.55,
              marginTop: 14 * s,
              color: 'rgba(255,255,255,0.78)',
            }}
          >
            {body}
          </div>
        )}

        {/* 피처 2열 그리드 — 아이콘 옆에 라벨 (원형 아이콘 → 더 읽기 쉬운 가로 배치) */}
        {features.length > 0 && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: `${14 * s}px ${18 * s}px`,
              marginTop: 28 * s,
            }}
          >
            {features.slice(0, 4).map((f, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12 * s,
                }}
              >
                <span
                  style={{
                    width: 42 * s,
                    height: 42 * s,
                    borderRadius: 10 * s,
                    background: `${primaryColor}33`,
                    border: `${1 * s}px solid ${primaryColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22 * s,
                    flexShrink: 0,
                  }}
                >
                  {f.icon}
                </span>
                <span
                  style={{
                    fontSize: 18 * s,
                    fontWeight: 600,
                    color: '#fff',
                    letterSpacing: '-0.005em',
                    lineHeight: 1.2,
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
          <div style={{ display: 'flex', gap: 10 * s, marginTop: 24 * s, alignItems: 'center' }}>
            <span
              style={{
                fontSize: 14 * s,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: 2 * s,
                textTransform: 'uppercase',
                marginRight: 6 * s,
              }}
            >
              COLORS
            </span>
            {colors.slice(0, 5).map((c, i) => (
              <span
                key={i}
                title={c}
                style={{
                  width: 24 * s,
                  height: 24 * s,
                  borderRadius: '50%',
                  background: c,
                  border: `${2 * s}px solid rgba(255,255,255,0.8)`,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.4)',
                }}
              />
            ))}
          </div>
        )}

        {/* 가격 영역 — 마감 문구 + 원가 + 세일가 */}
        {hasPriceSale && (
          <div style={{ marginTop: 'auto', paddingTop: 24 * s }}>
            {deadlineText && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6 * s,
                  padding: `${6 * s}px ${12 * s}px`,
                  background: 'rgba(255,255,255,0.12)',
                  borderRadius: 999,
                  fontSize: 15 * s,
                  fontWeight: 700,
                  color: '#fff',
                  marginBottom: 10 * s,
                  border: `${1 * s}px solid rgba(255,255,255,0.25)`,
                }}
              >
                <span>⏰</span>
                <span>{deadlineText}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 * s, flexWrap: 'wrap' }}>
              {hasPriceOriginal && (
                <span
                  style={{
                    fontSize: 20 * s,
                    color: 'rgba(255,255,255,0.5)',
                    textDecoration: 'line-through',
                    fontWeight: 500,
                  }}
                >
                  {fmt(priceOriginal)}
                </span>
              )}
              <span
                style={{
                  fontSize: 54 * s,
                  fontWeight: 900,
                  color: '#fff',
                  letterSpacing: '-0.02em',
                  lineHeight: 1,
                }}
              >
                {fmt(priceSale)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 하단 CTA 바 — 브랜드 컬러 풀블리드, 화살표 애니메 느낌의 구분자 */}
      {ctaLabel && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: ctaHeight,
            background: `linear-gradient(90deg, ${primaryColor} 0%, ${shiftColor(primaryColor, -18)} 100%)`,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 14 * s,
            fontSize: 32 * s,
            fontWeight: 800,
            letterSpacing: '-0.005em',
          }}
        >
          <span>{ctaLabel}</span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 44 * s,
              height: 44 * s,
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              fontSize: 24 * s,
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

// HEX 컬러 밝기 조절. 음수면 어둡게, 양수면 밝게 — CTA 바 그라디언트용.
function shiftColor(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const n = parseInt(clean, 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
