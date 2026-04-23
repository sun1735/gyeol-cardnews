// ═══════════════════════════════════════════════════════════════════
//  Layout DSL — LLM 이 생성하는 카드 레이아웃 스펙
// ═══════════════════════════════════════════════════════════════════
// 기존 "템플릿 3종 슬롯 채우기" → "LLM 이 블록 배치를 매번 새로 설계".
// rect 는 퍼센트(0~100) 기반으로 1:1 / 4:5 / 9:16 모든 비율에 대응.

export type BlockType =
  | 'image' // 배경 또는 박스형 이미지
  | 'title'
  | 'subtitle'
  | 'body'
  | 'badge'
  | 'price' // 원가·판매가·할인율 한 묶음
  | 'features' // 아이콘+라벨 4개 그리드
  | 'cta'
  | 'swatch' // 컬러 스와치
  | 'decor' // 블러 마스크, 액센트 라인, 원형 할인 뱃지 등

export type BlockStyle =
  | 'pill' // 둥근 알약 (뱃지)
  | 'circle' // 원형
  | 'underline' // 하단 언더라인
  | 'ribbon' // 리본(clip-path 육각형)
  | 'blur' // 글라스모피즘
  | 'solid'
  | 'glass'
  | 'mask-gradient' // decor 전용: 하단→상단 검정 그라디언트 마스크
  | 'mask-solid' // decor 전용: 단색 반투명 오버레이
  | 'corner-accent' // decor 전용: ⌐ 형태 코너 선

export type BlockPos =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

// rect: [x, y, w, h] — 모두 0~100(%) . 좌상단 기준.
export type Rect = [number, number, number, number]

export interface LayoutBlock {
  id: string
  type: BlockType
  rect?: Rect
  pos?: BlockPos
  align?: 'left' | 'center' | 'right'
  text?: string
  url?: string // image block: 이미지 URL (프런트에서 {{image}} 치환)
  color?: string // 텍스트 색 또는 decor 색
  background?: string // 블록 배경
  size?: number // 1080 기준 px — 실제는 s 배수로 스케일
  weight?: number
  fit?: 'cover' | 'contain'
  style?: BlockStyle
  rotate?: number
  zIndex?: number
  // price 전용
  priceOriginal?: number
  priceSale?: number
  discountPercent?: number
  // features 전용
  features?: { icon: string; label: string }[]
  // swatch 전용
  swatches?: string[]
  // decor 전용 (원형 할인 뱃지 안에 표시할 숫자)
  big?: string
}

export interface LayoutDsl {
  canvas: {
    w: number // 보통 1080
    h: number
    bg: string // HEX
    gradient?: string // "linear-gradient(...)" 가능 (옵션)
  }
  blocks: LayoutBlock[]
  // LLM 이 왜 이 구도를 택했는지 — 디버그·관리자 분석용
  rationale?: string
}

// ───── pos → rect 변환 ─────
// pos 만 주어지면 기본 폭/높이로 중앙·모서리 배치. rect 가 있으면 rect 우선.
export function posToRect(pos: BlockPos): Rect {
  const map: Record<BlockPos, Rect> = {
    'top-left': [5, 5, 40, 10],
    'top-center': [30, 5, 40, 10],
    'top-right': [55, 5, 40, 10],
    'middle-left': [5, 45, 45, 10],
    center: [25, 45, 50, 10],
    'middle-right': [50, 45, 45, 10],
    'bottom-left': [5, 80, 45, 15],
    'bottom-center': [10, 80, 80, 15],
    'bottom-right': [50, 80, 45, 15],
  }
  return map[pos]
}

// ───── 안전영역 체크 ─────
// 캔버스 외부로 빠지거나, 좌우상하 안전영역(2%) 밖에 걸치면 보정.
export function clampRect(rect: Rect): Rect {
  const [x, y, w, h] = rect
  const cx = Math.max(0, Math.min(98, x))
  const cy = Math.max(0, Math.min(98, y))
  const cw = Math.max(2, Math.min(100 - cx, w))
  const ch = Math.max(2, Math.min(100 - cy, h))
  return [cx, cy, cw, ch]
}

// ───── body 블록 자동 주입 ─────
// LLM 이 body 를 빼먹은 경우 보강. 이미지/타이틀 아래 빈자리에 삽입.
export function ensureBodyBlock(dsl: LayoutDsl, fallbackText: string): LayoutDsl {
  const hasBody = dsl.blocks.some((b) => b.type === 'body')
  if (hasBody) return dsl
  if (!fallbackText?.trim()) return dsl
  // 하단 여백을 찾거나 없으면 bottom-center 에 주입
  const bodyBlock: LayoutBlock = {
    id: 'auto-body',
    type: 'body',
    rect: [6, 72, 88, 10],
    text: fallbackText,
    align: 'left',
    size: 28,
    weight: 400,
    zIndex: 5,
  }
  return { ...dsl, blocks: [...dsl.blocks, bodyBlock] }
}

// ───── 블록 겹침 감지 ─────
// 텍스트 블록끼리 50% 이상 겹치면 충돌. 현재는 감지만 하고 자동 재배치는 renderer 에 위임(z-index).
export function detectOverlap(a: Rect, b: Rect): number {
  const [ax, ay, aw, ah] = a
  const [bx, by, bw, bh] = b
  const ix = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx))
  const iy = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by))
  const intersect = ix * iy
  const areaA = aw * ah
  return areaA > 0 ? intersect / areaA : 0
}
