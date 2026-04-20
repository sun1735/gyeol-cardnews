// 파일명 규칙 공용 유틸 — PNG/ZIP/MP4 에서 동일한 포맷 사용
// {브랜드명}_{YYYYMMDD}_{접미사}.{확장자}

export function safeBrandName(name?: string | undefined): string {
  if (!name) return '결'
  const cleaned = name.replace(/[\\/:*?"<>|\s]+/g, '')
  return cleaned || '결'
}

export function todayStamp(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

export function reelFilename(brandName?: string): string {
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${safeBrandName(brandName)}_${todayStamp()}_reel_${suffix}.mp4`
}
