// 업로드 이미지 후처리 — sharp 로 메타데이터 추출 + WebP 변환 + 썸네일 생성.
// 파일명은 SHA-256 해시 기반 → 동일 콘텐츠는 디스크에서 자동 중복 제거.
// SVG 는 벡터 유지 (썸네일 없음, 원본 그대로).

import { createHash } from 'crypto'
import { mkdir, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'
import sharp from 'sharp'

export interface ProcessedImage {
  url: string
  thumbnailUrl: string | null
  width: number
  height: number
  sizeBytes: number
  mimeType: string
  sha256: string
  isAnimated: boolean
}

const UPLOAD_DIR = join(process.cwd(), 'public', 'uploads')
const MAX_DIMENSION = 2560 // 원본을 이보다 크면 축소 (모바일·인스타 기준 충분)
const THUMB_WIDTH = 512
const WEBP_QUALITY = 85

// 원본 버퍼를 받아 저장 + 썸네일 생성 + 메타데이터 반환.
// 이미 같은 해시의 파일이 존재하면 재사용 (덮어쓰지 않음).
export async function processAndStore(buffer: Buffer, originalName: string): Promise<ProcessedImage> {
  await mkdir(UPLOAD_DIR, { recursive: true })

  const sha256 = createHash('sha256').update(buffer).digest('hex')
  const ext = pickExt(originalName)

  // SVG 는 벡터 — 변환 없이 그대로 저장, 썸네일 없음
  if (ext === 'svg') {
    const url = `/uploads/${sha256}.svg`
    const path = join(UPLOAD_DIR, `${sha256}.svg`)
    if (!existsSync(path)) await writeFile(path, buffer)
    // SVG 의 width/height 는 XML 파싱해야 하지만 MVP 에선 0 으로 (프론트가 vector-스케일)
    return {
      url,
      thumbnailUrl: null,
      width: 0,
      height: 0,
      sizeBytes: buffer.length,
      mimeType: 'image/svg+xml',
      sha256,
      isAnimated: false,
    }
  }

  // raster: sharp 로 메타 추출 → WebP 변환 → 썸네일
  const pipeline = sharp(buffer, { animated: true, failOn: 'none' })
  const meta = await pipeline.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  const isAnimated = (meta.pages ?? 1) > 1

  // 원본 WebP (너무 크면 축소)
  const fullBuf = await sharp(buffer, { animated: isAnimated, failOn: 'none' })
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY, effort: 4 })
    .toBuffer()

  const fullPath = join(UPLOAD_DIR, `${sha256}.webp`)
  if (!existsSync(fullPath)) await writeFile(fullPath, fullBuf)

  // 썸네일 (애니메이션은 1프레임 고정)
  const thumbBuf = await sharp(buffer, { failOn: 'none' })
    .resize({ width: THUMB_WIDTH, height: THUMB_WIDTH, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer()
  const thumbPath = join(UPLOAD_DIR, `${sha256}-t.webp`)
  if (!existsSync(thumbPath)) await writeFile(thumbPath, thumbBuf)

  // 축소된 실제 치수 재측정 (정확한 width/height 반환용)
  const finalMeta = await sharp(fullBuf).metadata()

  return {
    url: `/uploads/${sha256}.webp`,
    thumbnailUrl: `/uploads/${sha256}-t.webp`,
    width: finalMeta.width ?? width,
    height: finalMeta.height ?? height,
    sizeBytes: fullBuf.length,
    mimeType: 'image/webp',
    sha256,
    isAnimated,
  }
}

function pickExt(name: string): string {
  const dot = name.lastIndexOf('.')
  if (dot < 0) return ''
  const ext = name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '')
  return ext
}
