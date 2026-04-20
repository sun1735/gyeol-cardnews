// 브랜드 프로필 → 5장 카드 전체에 일관되게 적용할 스타일 레시피.
// 지금은 텍스트 LLM system prompt 주입용이지만, 추후 이미지 편집 모델에도 같은 레시피를 넘겨 룩앤필 통일.

interface BrandLike {
  name?: string
  tone?: string
  defaultPhrase?: string
  primaryColor?: string
  secondaryColor?: string
  textColor?: string
  fontFamily?: string
}

export interface StyleRecipe {
  palette: string // 자연어 팔레트 설명 ("따뜻한 초록과 베이지 계열")
  lighting: string // 조명 키워드 (warm soft / cool airy / muted calm 등)
  composition: string // 구도 가이드
  fontMood: string // 폰트 분위기 문장
  sharedMood: string // 전체 시리즈가 공유할 분위기
  rawColors: { primary: string; secondary: string; text: string } // 이미지 모델용 원본 HEX
}

export function buildStyleRecipe(brand: BrandLike | null | undefined): StyleRecipe {
  const primary = normalizeHex(brand?.primaryColor) ?? '#0f766e'
  const secondary = normalizeHex(brand?.secondaryColor) ?? '#f0fdfa'
  const text = normalizeHex(brand?.textColor) ?? '#111827'
  const tone = (brand?.tone ?? '따뜻하고 진솔한').trim()

  return {
    palette: paletteDescription(primary, secondary, text),
    lighting: lightingFromTone(tone),
    composition: compositionGuide(),
    fontMood: fontMood(brand?.fontFamily),
    sharedMood: `시리즈 전체가 "${tone}" 하나의 분위기로 이어집니다. 5장은 별개가 아닌 한 편의 흐름입니다.`,
    rawColors: { primary, secondary, text },
  }
}

// system/user 프롬프트에 붙일 블록 — 가독성 있는 한국어.
export function recipeAsPromptBlock(r: StyleRecipe): string {
  return [
    '[브랜드 스타일 — 모든 카드가 동일하게 공유]',
    `· 팔레트: ${r.palette} (주 ${r.rawColors.primary}, 보조 ${r.rawColors.secondary}, 글자 ${r.rawColors.text})`,
    `· 조명: ${r.lighting}`,
    `· 구도: ${r.composition}`,
    `· 폰트 분위기: ${r.fontMood}`,
    `· 흐름: ${r.sharedMood}`,
  ].join('\n')
}

function normalizeHex(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = v.trim().match(/^#?([0-9a-fA-F]{6})$/)
  return m ? `#${m[1].toLowerCase()}` : null
}

// 주/보조/글자 색에서 자연어 팔레트 요약.
function paletteDescription(primary: string, secondary: string, text: string): string {
  const p = hueFamily(primary)
  const s = hueFamily(secondary)
  const t = isDark(text) ? '짙은' : '밝은'
  return `${p}과 ${s} 계열, ${t} 글자`
}

// HEX → 러프한 한국어 색 계열 이름.
function hueFamily(hex: string): string {
  const { r, g, b } = hexToRgb(hex)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2 / 255
  if (max - min < 20) {
    if (lightness > 0.85) return '아이보리'
    if (lightness < 0.2) return '차콜'
    if (lightness < 0.5) return '뉴트럴 그레이'
    return '오프 화이트'
  }
  if (r >= g && r >= b) {
    if (g > b * 1.3) return g > 160 ? '따뜻한 살구' : '테라코타'
    return '따뜻한 코랄'
  }
  if (g >= r && g >= b) {
    if (r > b * 1.2 && lightness > 0.6) return '베이지'
    if (lightness > 0.7) return '파스텔 그린'
    return '내추럴 그린'
  }
  if (b >= r && b >= g) {
    if (r > g * 1.2) return '라벤더'
    if (lightness > 0.7) return '파스텔 블루'
    return '차분한 블루'
  }
  return '중간 톤'
}

function isDark(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex)
  return (r * 0.299 + g * 0.587 + b * 0.114) < 128
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '')
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  }
}

function lightingFromTone(tone: string): string {
  const t = tone.toLowerCase()
  if (/따뜻|안심|온기|정감|포근|진솔/.test(tone)) return '자연광 · 따뜻하고 부드러운 소프트 라이트'
  if (/차분|잔잔|고요|평온|침착/.test(tone)) return '디퓨즈드 라이트 · 낮은 채도의 차분한 톤'
  if (/활기|밝|생기|경쾌|젊/.test(tone)) return '밝고 선명한 데이라이트'
  if (/고급|세련|모던|미니멀/.test(tone)) return '섬세한 간접광 · 낮은 콘트라스트'
  return '자연광 · 부드러운 그림자'
}

function compositionGuide(): string {
  return 'cover 는 중앙 정렬·숨통 있는 여백, content 는 이미지 위 1/3 영역에 텍스트, cta 는 강조 문구를 하단 중앙으로'
}

function fontMood(fontFamily: string | undefined): string {
  if (!fontFamily) return '모던한 산세리프, 가독성 우선'
  const f = fontFamily.toLowerCase()
  if (/serif/.test(f) && !/sans/.test(f)) return '클래식한 세리프, 진중하고 따뜻한 느낌'
  if (/pretendard|noto|inter|apple|sans/.test(f)) return '모던한 산세리프(Pretendard 계열), 가독성 우선'
  return '중립적인 산세리프, 가독성 우선'
}
