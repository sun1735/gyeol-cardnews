'use client'

// 템플릿 썸네일 미리보기. 실제 컴포넌트를 작은 displayWidth 로 축소 렌더 —
// 시작하기 가이드에서 "이 템플릿 골라봐" 안내에 쓰인다.

import type { Template } from '@/lib/types'
import { ProductAdCard } from './ProductAdCard'
import { PromoCard } from './PromoCard'

export interface TemplatePreviewProps {
  template: Template
  displayWidth?: number // 기본 180
  primaryColor?: string
  // 배경 이미지 — /icon.svg 같은 로컬 에셋을 쓸 수 있으나, 미제공 시 그라디언트 배경.
  backgroundImageUrl?: string
}

export function TemplatePreview({
  template,
  displayWidth = 180,
  primaryColor,
  backgroundImageUrl,
}: TemplatePreviewProps) {
  if (template === 'product-ad') {
    return (
      <ProductAdCard
        title="아쿠아 세럼"
        subtitle="48시간 수분 장벽"
        body="민감 피부도 편안하게"
        badgeLabel="BEST"
        features={[
          { icon: '💧', label: '수분' },
          { icon: '🌿', label: '저자극' },
          { icon: '✨', label: '톤업' },
          { icon: '🧴', label: '30ml' },
        ]}
        colors={['#c5e1ef', '#ffffff']}
        priceOriginal={38000}
        priceSale={30400}
        discountPercent={20}
        deadlineText="5월 5일까지"
        ctaLabel="지금 구매"
        backgroundImageUrl={backgroundImageUrl}
        displayWidth={displayWidth}
        aspectRatio="4:5"
        primaryColor={primaryColor ?? '#4338ca'}
      />
    )
  }
  if (template === 'promo') {
    return (
      <PromoCard
        title="봄맞이 대세일"
        subtitle="모든 상품 최대 할인"
        discountPercent={50}
        deadlineText="5월 5일 마감"
        ctaLabel="지금 쇼핑하기"
        badgeLabel="EVENT"
        backgroundImageUrl={backgroundImageUrl}
        displayWidth={displayWidth}
        aspectRatio="1:1"
        primaryColor={primaryColor ?? '#dc2626'}
      />
    )
  }
  // basic — 실제 basic 렌더는 page.tsx CardItem 에 얽혀있어 별도 BasicCard 가 없음.
  // 미리보기용 간이 레이아웃. 그라디언트 + 하단 블러 오버레이로 가독성 확보.
  const s = displayWidth / 1080
  const pc = primaryColor ?? '#4338ca'
  return (
    <div
      style={{
        width: displayWidth,
        height: displayWidth, // 1:1
        borderRadius: 16 * s,
        overflow: 'hidden',
        position: 'relative',
        background: `linear-gradient(135deg, ${pc} 0%, ${shiftHex(pc, -32)} 100%)`,
        color: '#fff',
        fontFamily: 'Pretendard, ui-sans-serif, system-ui, sans-serif',
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
      }}
    >
      {/* 텍스처 느낌의 얇은 라인 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `linear-gradient(45deg, rgba(255,255,255,0.05) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.05) 75%)`,
          backgroundSize: `${24 * s}px ${24 * s}px`,
          opacity: 0.5,
        }}
      />
      {/* 하단 어두운 오버레이 — 텍스트 가독성 */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.5) 100%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 48 * s,
          right: 48 * s,
          bottom: 48 * s,
        }}
      >
        <div
          style={{
            fontSize: 20 * s,
            fontWeight: 900,
            letterSpacing: 4 * s,
            textTransform: 'uppercase',
            color: '#ffffff',
            marginBottom: 12 * s,
          }}
        >
          BRAND
        </div>
        <div
          style={{
            fontSize: 96 * s,
            fontWeight: 900,
            lineHeight: 0.98,
            letterSpacing: '-0.035em',
            color: '#ffffff',
            textShadow: '0 2px 10px rgba(0,0,0,0.4)',
          }}
        >
          카드 제목
        </div>
        <div
          style={{
            fontSize: 30 * s,
            fontWeight: 600,
            lineHeight: 1.45,
            marginTop: 16 * s,
            color: '#ffffff',
            textShadow: '0 1px 6px rgba(0,0,0,0.5)',
          }}
        >
          본문이 여기에 들어갑니다.
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10 * s,
            marginTop: 24 * s,
            padding: `${14 * s}px ${26 * s}px`,
            background: '#fff',
            color: pc,
            fontSize: 26 * s,
            fontWeight: 900,
            borderRadius: 10 * s,
          }}
        >
          자세히 보기 <span>→</span>
        </div>
      </div>
    </div>
  )
}

function shiftHex(hex: string, amount: number): string {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return hex
  const n = parseInt(clean, 16)
  const r = Math.max(0, Math.min(255, ((n >> 16) & 0xff) + amount))
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amount))
  const b = Math.max(0, Math.min(255, (n & 0xff) + amount))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}
