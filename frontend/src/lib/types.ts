export type SizePreset = '1:1' | '4:5' | '9:16' | 'custom'
export type Layout = 'cover' | 'content' | 'cta'

// 사용자가 카드별로 조절할 수 있는 텍스트 스타일 — 미지정 시 layout 기반 기본값 사용.
export interface TextStyle {
  align?: 'left' | 'center' | 'right' // 수평 정렬
  verticalAlign?: 'top' | 'center' | 'bottom' // 수직 위치 (기본: cover=bottom, else=center)
  sizeScale?: number // 0.7 ~ 1.5 · 모든 텍스트 크기 배율
  titleWeight?: 400 | 600 | 700 | 800 | 900 // 제목 굵기
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
