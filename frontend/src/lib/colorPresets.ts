// 업종별 색상 프리셋 — 브랜드 생성·수정 모달에서 원클릭 적용.
// primary / secondary / textColor 세 값을 한 번에 세팅해 카드 톤이 일관되게.

export interface ColorPreset {
  key: string
  label: string
  emoji: string
  description: string
  primaryColor: string
  secondaryColor: string
  textColor: string
}

export const COLOR_PRESETS: ColorPreset[] = [
  {
    key: 'beauty',
    label: '뷰티·코스메틱',
    emoji: '🌸',
    description: '부드러운 핑크 · 라벤더 · 화이트',
    primaryColor: '#db2777', // pink-600
    secondaryColor: '#fdf2f8', // pink-50
    textColor: '#831843', // pink-900
  },
  {
    key: 'food',
    label: '푸드·카페',
    emoji: '🥐',
    description: '따뜻한 오렌지 · 베이지 · 브라운',
    primaryColor: '#c2410c', // orange-700
    secondaryColor: '#fef3c7', // amber-100
    textColor: '#78350f', // amber-900
  },
  {
    key: 'fashion',
    label: '패션·의류',
    emoji: '👗',
    description: '모노톤 · 블랙 · 중립 무채색',
    primaryColor: '#0f172a', // slate-900
    secondaryColor: '#f1f5f9', // slate-100
    textColor: '#0f172a',
  },
  {
    key: 'wellness',
    label: '헬스·웰니스',
    emoji: '🧘',
    description: '차분한 세이지 · 민트 · 아이보리',
    primaryColor: '#059669', // emerald-600
    secondaryColor: '#ecfdf5', // emerald-50
    textColor: '#064e3b', // emerald-900
  },
  {
    key: 'tech',
    label: '테크·IT',
    emoji: '⚡',
    description: '인디고 · 블루 · 다크 그레이',
    primaryColor: '#4338ca', // indigo-700
    secondaryColor: '#eef2ff', // indigo-50
    textColor: '#1e1b4b', // indigo-950
  },
  {
    key: 'kids',
    label: '키즈·육아',
    emoji: '🧸',
    description: '부드러운 옐로우 · 스카이 · 크림',
    primaryColor: '#d97706', // amber-600
    secondaryColor: '#fef3c7', // amber-100
    textColor: '#451a03', // amber-950
  },
]

export function getPresetByColors(primary: string): ColorPreset | undefined {
  return COLOR_PRESETS.find((p) => p.primaryColor.toLowerCase() === primary.toLowerCase())
}
