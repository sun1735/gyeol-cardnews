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
  // 미리보기용 간이 레이아웃을 직접 작성 (실 렌더와 "톤" 만 맞추면 충분).
  const s = displayWidth / 1080
  return (
    <div
      style={{
        width: displayWidth,
        height: displayWidth, // 1:1
        borderRadius: 12 * s,
        overflow: 'hidden',
        position: 'relative',
        background: `linear-gradient(135deg, ${primaryColor ?? '#4338ca'}22, ${
          primaryColor ?? '#4338ca'
        }99)`,
        color: '#fff',
        fontFamily: 'Pretendard, ui-sans-serif, system-ui, sans-serif',
        padding: 48 * s,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ fontSize: 56 * s, fontWeight: 800, lineHeight: 1.15 }}>카드 제목</div>
      <div style={{ fontSize: 26 * s, fontWeight: 400, marginTop: 14 * s, opacity: 0.9 }}>
        본문 텍스트가 이 자리에 들어가고 브랜드 톤에 맞춰 자동 생성됩니다.
      </div>
      <div
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          marginTop: 20 * s,
          padding: `${12 * s}px ${22 * s}px`,
          background: '#fff',
          color: primaryColor ?? '#4338ca',
          fontSize: 22 * s,
          fontWeight: 700,
          borderRadius: 8 * s,
        }}
      >
        자세히 보기 →
      </div>
    </div>
  )
}
