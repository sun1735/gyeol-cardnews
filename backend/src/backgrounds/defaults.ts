// 단계 5: 5장의 기본 배경 템플릿 카탈로그.
// 생성 엔진이 폴백으로 사용하고, /api/backgrounds 로 노출되어 프론트 스와치에서 직접 선택 가능.
// 키는 generate.service.ts 의 BG 상수 및 Frame.*.bg 와 일치시킨다.

export interface BackgroundTemplate {
  key: string
  label: string
  url: string
  palette: [string, string]
  tags: string[]
}

export const BG_KEYS = ['morning', 'meal', 'program', 'care', 'calm'] as const
export type BgKey = (typeof BG_KEYS)[number]

export const BG_URLS: Record<BgKey, string> = {
  morning: '/uploads/defaults/bg-morning.svg',
  meal:    '/uploads/defaults/bg-meal.svg',
  program: '/uploads/defaults/bg-program.svg',
  care:    '/uploads/defaults/bg-care.svg',
  calm:    '/uploads/defaults/bg-calm.svg',
}

export const DEFAULT_BACKGROUNDS: BackgroundTemplate[] = [
  {
    key: 'morning',
    label: '아침 · 따뜻한 초록',
    url: BG_URLS.morning,
    palette: ['#d9e4bc', '#6b8e4e'],
    tags: ['시니어', '산책', '자연', 'morning'],
  },
  {
    key: 'meal',
    label: '식사 · 따뜻한 베이지',
    url: BG_URLS.meal,
    palette: ['#f5e3c2', '#d9a66e'],
    tags: ['식사', '음식', '영양', 'meal'],
  },
  {
    key: 'program',
    label: '활동 · 부드러운 보라',
    url: BG_URLS.program,
    palette: ['#e8dceb', '#7d6b8e'],
    tags: ['프로그램', '활동', '놀이', 'program'],
  },
  {
    key: 'care',
    label: '케어 · 따뜻한 살구',
    url: BG_URLS.care,
    palette: ['#fde5d4', '#e8a888'],
    tags: ['임산부', '영유아', '케어', 'care'],
  },
  {
    key: 'calm',
    label: '차분 · 잔잔한 하늘',
    url: BG_URLS.calm,
    palette: ['#eaf0f5', '#8ea3c0'],
    tags: ['기본', '마무리', 'cta', 'calm'],
  },
]
