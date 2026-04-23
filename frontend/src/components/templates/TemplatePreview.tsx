'use client'

// 템플릿 썸네일 미리보기 — 실제 LayoutRenderer 로 렌더되는 hand-crafted DSL 샘플.
// "이 템플릿을 고르면 이런 느낌" 을 가장 사실적으로 보여준다.

import type { Template } from '@/lib/types'
import type { LayoutDsl } from '@/lib/layoutDsl'
import { LayoutRenderer } from '../LayoutRenderer'

export interface TemplatePreviewProps {
  template: Template
  displayWidth?: number
  primaryColor?: string
  backgroundImageUrl?: string
  sampleImageUrl?: string
  sampleAspect?: '1:1' | '4:5' | '9:16'
}

// ─── 상품 광고 샘플 DSL (4:5) ──────────────────────────────────────
// 좌측 텍스트·우측 제품 이미지 · 우상단 원형 할인 뱃지 · 하단 CTA 바
function productAdSample(primary: string): LayoutDsl {
  return {
    canvas: { w: 1080, h: 1350, bg: '#0f172a' },
    blocks: [
      // 우측 이미지 영역
      { id: 'img', type: 'image', rect: [45, 0, 55, 90], fit: 'cover', url: '{{image}}' },
      // 우상단 원형 할인 뱃지 (이미지 영역 위)
      {
        id: 'disc',
        type: 'decor',
        rect: [72, 4, 23, 19],
        style: 'circle',
        color: '#dc2626',
        big: '20%',
        text: 'OFF',
        size: 92,
        rotate: -8,
      },
      // 좌상단 코너 액센트
      { id: 'corner', type: 'decor', rect: [2.5, 2.5, 5, 4], style: 'corner-accent', color: primary },
      // BEST SELLER 뱃지
      {
        id: 'badge',
        type: 'badge',
        rect: [5, 8, 34, 6],
        text: 'BEST SELLER',
        background: primary,
        align: 'left',
        size: 24,
      },
      // 타이틀
      {
        id: 'title',
        type: 'title',
        rect: [5, 17, 40, 20],
        text: '센텔라 에센스',
        color: '#ffffff',
        size: 108,
        align: 'left',
        weight: 900,
      },
      // 서브타이틀 (브랜드 컬러 언더라인)
      {
        id: 'sub',
        type: 'subtitle',
        rect: [5, 39, 40, 5],
        text: '48시간 수분 장벽',
        style: 'underline',
        color: '#ffffff',
        background: primary,
        size: 34,
        align: 'left',
      },
      // 본문
      {
        id: 'body',
        type: 'body',
        rect: [5, 47, 40, 10],
        text: '민감 피부를 위한 저자극 포뮬라. 한 번 쓰면 하루 종일 촉촉하게.',
        color: '#cbd5e1',
        size: 24,
      },
      // 피처 2x2
      {
        id: 'features',
        type: 'features',
        rect: [5, 59, 40, 14],
        features: [
          { icon: '💧', label: '수분' },
          { icon: '🌿', label: '저자극' },
          { icon: '✨', label: '톤업' },
          { icon: '🧴', label: '30ml' },
        ],
        color: '#ffffff',
        background: primary,
        size: 20,
      },
      // 가격
      {
        id: 'price',
        type: 'price',
        rect: [5, 77, 40, 8],
        priceOriginal: 38000,
        priceSale: 30400,
        color: '#ffffff',
        size: 76,
      },
      // CTA 바 풀블리드
      {
        id: 'cta',
        type: 'cta',
        rect: [0, 90, 100, 10],
        text: '지금 구매하기',
        background: primary,
        align: 'center',
        size: 40,
      },
    ],

  }
}

// ─── 프로모션 샘플 DSL (1:1) ──────────────────────────────────────
// 풀블리드 이미지 + 다크 마스크 · 상단 EVENT 리본 · 중앙 거대 할인율 · 글라스 박스 타이틀 · 하단 CTA
function promoSample(primary: string): LayoutDsl {
  return {
    canvas: { w: 1080, h: 1080, bg: '#0b0b14' },
    blocks: [
      // 배경 이미지
      { id: 'img', type: 'image', rect: [0, 0, 100, 100], fit: 'cover', url: '{{image}}' },
      // 다크 마스크 (라디얼 대신 단색 반투명)
      {
        id: 'mask',
        type: 'decor',
        rect: [0, 0, 100, 100],
        style: 'mask-solid',
        background: 'rgba(11,11,20,0.72)',
      },
      // 상단 EVENT 리본
      {
        id: 'badge',
        type: 'badge',
        rect: [30, 8, 40, 8],
        text: 'EVENT',
        style: 'ribbon',
        background: primary,
        align: 'center',
        size: 38,
      },
      // 중앙 거대 숫자
      {
        id: 'number',
        type: 'title',
        rect: [5, 23, 90, 32],
        text: '50%',
        align: 'center',
        size: 380,
        weight: 900,
        color: '#ffffff',
      },
      // OFF 간격 넓힌 서브
      {
        id: 'off',
        type: 'subtitle',
        rect: [5, 55, 90, 7],
        text: 'O  F  F',
        align: 'center',
        size: 62,
        color: primary,
        weight: 900,
      },
      // 글라스 타이틀 박스
      {
        id: 'titlebox',
        type: 'title',
        rect: [10, 66, 80, 11],
        text: '봄맞이 대세일',
        align: 'center',
        size: 60,
        color: '#ffffff',
        style: 'glass',
      },
      // 본문
      {
        id: 'body',
        type: 'body',
        rect: [10, 79, 80, 5],
        text: '모든 상품 최대 50% 할인 · 이번 주말까지',
        align: 'center',
        color: '#e2e8f0',
        size: 26,
      },
      // CTA
      {
        id: 'cta',
        type: 'cta',
        rect: [0, 89, 100, 11],
        text: '지금 쇼핑하기',
        background: primary,
        align: 'center',
        size: 40,
      },
    ],

  }
}

// ─── 기본 샘플 DSL (1:1) — YOOSUN 실사 + 하단 텍스트 ──────────────
function basicSample(primary: string): LayoutDsl {
  return {
    canvas: { w: 1080, h: 1080, bg: '#f1f5f9' },
    blocks: [
      // 풀블리드 이미지
      { id: 'img', type: 'image', rect: [0, 0, 100, 100], fit: 'cover', url: '{{image}}' },
      // 하단 그라디언트 마스크
      {
        id: 'mask',
        type: 'decor',
        rect: [0, 55, 100, 45],
        style: 'mask-gradient',
        background:
          'linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.65) 100%)',
      },
      // BRAND 태그라인
      {
        id: 'brand',
        type: 'subtitle',
        rect: [7, 66, 86, 4],
        text: 'N2C · BRAND',
        size: 20,
        color: '#ffffff',
        align: 'left',
      },
      // 타이틀
      {
        id: 'title',
        type: 'title',
        rect: [7, 72, 86, 12],
        text: '카드 제목',
        align: 'left',
        size: 96,
        weight: 900,
        color: '#ffffff',
      },
      // 본문
      {
        id: 'body',
        type: 'body',
        rect: [7, 86, 72, 5],
        text: '본문 텍스트가 이 자리에 들어갑니다.',
        align: 'left',
        size: 28,
        color: '#f8fafc',
      },
      // CTA 인라인 알약
      {
        id: 'cta',
        type: 'cta',
        rect: [62, 86, 32, 7],
        text: '자세히',
        background: '#ffffff',
        color: primary,
        style: 'pill',
        align: 'center',
        size: 26,
      },
    ],

  }
}

export function TemplatePreview({
  template,
  displayWidth = 180,
  primaryColor,
  backgroundImageUrl,
  sampleImageUrl,
  sampleAspect,
}: TemplatePreviewProps) {
  // 실제 샘플 이미지가 주어지고 DSL 이 아닌 "그냥 이미지 보여주기" 모드
  if (sampleImageUrl && template === 'basic') {
    const aspect = sampleAspect ?? '1:1'
    const ratioH = aspect === '1:1' ? 1 : aspect === '4:5' ? 1.25 : 16 / 9
    const displayHeight = Math.round(displayWidth * ratioH)
    return (
      <div
        style={{
          width: displayWidth,
          height: displayHeight,
          borderRadius: Math.max(12, displayWidth * 0.04),
          overflow: 'hidden',
          background: '#f1f5f9',
          boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        }}
      >
        <img
          src={sampleImageUrl}
          alt=""
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
          draggable={false}
        />
      </div>
    )
  }

  // LayoutRenderer 기반 hand-crafted 샘플
  const pc = primaryColor ?? (template === 'promo' ? '#dc2626' : '#4338ca')
  const imgUrl = backgroundImageUrl ?? '/samples/yoosun-basic.png'
  const dsl =
    template === 'product-ad'
      ? productAdSample(pc)
      : template === 'promo'
        ? promoSample(pc)
        : basicSample(pc)
  return <LayoutRenderer dsl={dsl} displayWidth={displayWidth} imageUrl={imgUrl} />
}
