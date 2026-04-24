import type { Template } from '@/lib/types'

// 템플릿 메타데이터. 선택 UI·필드 가이드·추천 비율 등을 한 곳에서 정의.
// 새 템플릿 추가 시 이 배열에만 레코드를 추가하면 됨.

export interface TemplateMeta {
  key: Template
  title: string
  description: string
  // 이 템플릿이 note-rag 경로에서만 구조화 카피가 생성되는지.
  requiresNoteRag: boolean
  // 권장 비율 (UI 에 힌트로 표시)
  recommendedAspect: '1:1' | '4:5' | '9:16'
  // 준비 중 여부 (선택 불가)
  disabled: boolean
  // 베타 기능 — 선택은 가능하지만 뱃지 + 안내 표시
  beta?: boolean
  betaNote?: string
}

export const TEMPLATES: TemplateMeta[] = [
  {
    key: 'basic',
    title: '기본',
    description: '제목·본문·CTA',
    requiresNoteRag: false,
    recommendedAspect: '1:1',
    disabled: false,
  },
  {
    key: 'product-ad',
    title: '상품 광고',
    description: 'AI 구도 (베타)',
    requiresNoteRag: false,
    recommendedAspect: '4:5',
    disabled: false,
    beta: true,
    betaNote: 'AI 이미지 생성 품질이 안정화 중입니다. 실패 시 기본 템플릿으로 시도해 주세요.',
  },
  {
    key: 'promo',
    title: '프로모션',
    description: 'AI 이벤트 감성 (베타)',
    requiresNoteRag: false,
    recommendedAspect: '1:1',
    disabled: false,
    beta: true,
    betaNote: 'AI 이미지 생성 품질이 안정화 중입니다. 실패 시 기본 템플릿으로 시도해 주세요.',
  },
]

export function getTemplateMeta(key: Template): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.key === key)
}
