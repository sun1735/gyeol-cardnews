export type SizePreset = '1:1' | '4:5' | '9:16' | 'custom'
export type Layout = 'cover' | 'content' | 'cta'

// 요소별 오버라이드. 미지정 필드는 카드 레벨 값 (sizeScale/align) 이나 기본값 사용.
export interface ElementStyle {
  sizeScale?: number // 0.6 ~ 1.8 · 해당 요소에만 적용
  weight?: 300 | 400 | 500 | 600 | 700 | 800 | 900
  align?: 'left' | 'center' | 'right' // 해당 요소 정렬 (미지정 시 카드 align)
}

// 사용자가 카드별로 조절할 수 있는 텍스트 스타일. 요소별로 세밀 조정 가능.
export interface TextStyle {
  // 카드 레벨 (4요소 공통 기본값)
  align?: 'left' | 'center' | 'right' // 수평 정렬 기본
  verticalAlign?: 'top' | 'center' | 'bottom' // 수직 위치 (기본: cover=bottom, else=center)
  sizeScale?: number // 0.7 ~ 1.5 · 전체 배율
  titleWeight?: 400 | 600 | 700 | 800 | 900 // 제목 굵기 (레거시, element.title.weight 와 동일 효과)

  // 요소별 오버라이드
  title?: ElementStyle
  body?: ElementStyle
  subtext?: ElementStyle
  cta?: ElementStyle
}

// 단계 4 출력 고정 포맷: title / body / subtext / cta (+ layout, imageUrl, id, textStyle)
export interface CardData {
  id: string
  title: string
  body: string
  subtext: string
  cta: string
  imageUrl?: string
  layout: Layout
  textStyle?: TextStyle
}

export interface BrandAsset {
  id: string
  url: string
  caption: string
  kind: string // 'image' | 'font'
}

export interface Brand {
  id: string
  name: string
  tone: string
  defaultPhrase: string
  primaryColor: string
  secondaryColor: string
  textColor: string
  fontFamily: string
  assets: BrandAsset[]
}

// 단계 5: 기본 배경 템플릿
export interface BackgroundTemplate {
  key: string
  label: string
  url: string
  palette: [string, string]
  tags: string[]
}
