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
  // 준비 중 여부
  disabled: boolean
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
    description: 'AI 구도·가격·스펙',
    // 모든 모드(auto/manual/note-rag)에서 사용 가능. note-rag 면 지식노트 근거까지 활용.
    requiresNoteRag: false,
    recommendedAspect: '4:5',
    disabled: false,
  },
  {
    key: 'promo',
    title: '프로모션',
    description: 'AI 구도·이벤트 감성',
    requiresNoteRag: false,
    recommendedAspect: '1:1',
    disabled: false,
  },
]

export function getTemplateMeta(key: Template): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.key === key)
}
