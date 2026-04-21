// 플랜별 월간 한도 정의. 프런트 /pricing 페이지와 동기화.
// free : 체험용, Powered by Note2Card 워터마크 포함
// pro  : ₩12,900/월 — 일반 사용자 대상
// team : ₩39,000/월 — 5명 팀 · 에이전시 대상

export type PlanKey = 'free' | 'pro' | 'team'

export interface PlanLimits {
  imageGen: number // AI 이미지 생성 + 편집 (월)
  textGen: number // 텍스트 카드 생성 (월)
  ragJob: number // RAG 비동기 잡 (월)
  ideaGen: number // 아이디어 추천 (월)
  brands: number // 브랜드 개수
  watermark: boolean // 출력에 워터마크
  reels: boolean // 릴스 MP4 내보내기
  customDomain: boolean
  apiAccess: boolean
  teamSeats: number
}

export const PLAN_LIMITS: Record<PlanKey, PlanLimits> = {
  free: {
    imageGen: 3,
    textGen: 5,
    ragJob: 3,
    ideaGen: 3,
    brands: 1,
    watermark: true,
    reels: false,
    customDomain: false,
    apiAccess: false,
    teamSeats: 1,
  },
  pro: {
    imageGen: 100,
    textGen: 100,
    ragJob: 50,
    ideaGen: 30,
    brands: 5,
    watermark: false,
    reels: true,
    customDomain: false,
    apiAccess: false,
    teamSeats: 1,
  },
  team: {
    imageGen: 500,
    textGen: 500,
    ragJob: 250,
    ideaGen: 150,
    brands: 20,
    watermark: false,
    reels: true,
    customDomain: true,
    apiAccess: true,
    teamSeats: 5,
  },
}

export const PLAN_PRICE_KRW: Record<PlanKey, { monthly: number; yearly: number }> = {
  free: { monthly: 0, yearly: 0 },
  pro: { monthly: 12900, yearly: 129000 }, // 연 결제 = 월 10,750원 (17% 할인)
  team: { monthly: 39000, yearly: 390000 },
}

export function normalizePlan(v: string | null | undefined): PlanKey {
  if (v === 'pro' || v === 'team') return v
  return 'free'
}
