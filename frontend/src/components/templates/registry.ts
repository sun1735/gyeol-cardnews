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
  // UI 에서 완전히 숨김 (백엔드 기능은 유지, 품질 확보 후 재노출)
  hidden?: boolean
}

// 화면에 노출할 템플릿만 필터링한 목록
export const VISIBLE_TEMPLATES: TemplateMeta[] = []

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
    description: 'AI 구도 (내부 테스트)',
    requiresNoteRag: false,
    recommendedAspect: '4:5',
    disabled: false,
    beta: true,
    hidden: true, // UI 미노출 — 품질 확보 후 재노출
    betaNote: '품질 안정화 중 — 현재 메뉴에서 숨김.',
  },
  {
    key: 'promo',
    title: '프로모션',
    description: 'AI 이벤트 (내부 테스트)',
    requiresNoteRag: false,
    recommendedAspect: '1:1',
    disabled: false,
    beta: true,
    hidden: true,
    betaNote: '품질 안정화 중 — 현재 메뉴에서 숨김.',
  },
]

// 정적 초기화: hidden 플래그 없는 항목만 VISIBLE_TEMPLATES 에 채움
VISIBLE_TEMPLATES.push(...TEMPLATES.filter((t) => !t.hidden))

export function getTemplateMeta(key: Template): TemplateMeta | undefined {
  return TEMPLATES.find((t) => t.key === key)
}
