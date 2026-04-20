export type SizePreset = '1:1' | '4:5' | '9:16' | 'custom'
export type Layout = 'cover' | 'content' | 'cta'

// 단계 4 출력 고정 포맷: title / body / subtext / cta (+ layout, imageUrl, id)
export interface CardData {
  id: string
  title: string
  body: string
  subtext: string
  cta: string
  imageUrl?: string
  layout: Layout
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
