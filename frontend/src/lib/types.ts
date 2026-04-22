export type SizePreset = '1:1' | '4:5' | '9:16' | 'custom'
export type Layout = 'cover' | 'content' | 'cta'
export type Template = 'basic' | 'product-ad' | 'promo'

// 상품 광고 템플릿 전용 데이터. 기능 아이콘 4개·컬러 스와치·원가/할인가 등.
export interface ProductAdFeature {
  icon: string // 이모지 1자 권장 (예: '🧴')
  label: string // 10자 이내 짧은 키워드
}
export interface ProductAdData {
  subtitle?: string
  features?: ProductAdFeature[] // 4개 권장
  colors?: string[] // HEX 코드 배열, 스와치 표시용
  priceOriginal?: number // 원가
  priceSale?: number // 할인가
  discountPercent?: number // 1~99 (원형 뱃지에 표시)
  deadlineText?: string // 예: "5월 5일까지"
  ctaLabel?: string // CTA 바 라벨 (cta 필드와 별도 — 디자인 차별화)
  badgeLabel?: string // BEST SELLER 같은 상단 뱃지
}

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
// template 이 'product-ad' 일 때 productAd 필드에 상품 광고 전용 데이터가 들어온다.
export interface CardData {
  id: string
  title: string
  body: string
  subtext: string
  cta: string
  imageUrl?: string
  layout: Layout
  textStyle?: TextStyle
  template?: Template
  productAd?: ProductAdData
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
