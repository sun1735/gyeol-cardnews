// Gemini 2.5 Flash Image ("Nano Banana") 로 카드 이미지를 브랜드 톤에 맞게 재편집.
// 모델 교체가 쉬우려면 이 파일이 유일한 외부 호출 지점이 되어야 한다.
// 교체 시 editImage() 시그니처만 유지하고 내부만 바꾸면 됨.

import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { Logger } from '@nestjs/common'
import { StyleRecipe } from '../generate/style'

const GEMINI_MODEL = 'gemini-2.5-flash-image'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`
const EDIT_TIMEOUT_MS = 60_000 // 이미지 생성은 텍스트보다 길다

export interface EditImageInput {
  basePath: string // 디스크 경로 (필수) — /uploads URL 은 컨트롤러에서 변환
  refPaths?: string[] // Mode A 참조 이미지 (선택, 최대 3)
  recipe?: StyleRecipe // 스타일 가이드 (brand 에서 도출)
  instruction?: string // 사용자 추가 지시 (선택)
}

export interface EditImageResult {
  bytes: Buffer
  mimeType: string
  durationMs: number
}

export async function editImageWithGemini(input: EditImageInput): Promise<EditImageResult> {
  const logger = new Logger('ImageEditor')
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY 미설정 — Railway Variables 에 등록 필요')

  const t0 = Date.now()

  const baseImage = await loadAsInlineData(input.basePath)
  const refs: InlineData[] = []
  for (const p of (input.refPaths ?? []).slice(0, 3)) {
    try {
      refs.push(await loadAsInlineData(p))
    } catch (e: any) {
      logger.warn(`참조 이미지 로드 실패 ${p}: ${e?.message ?? e}`)
    }
  }

  const promptText = buildPrompt(input.recipe, input.instruction, refs.length > 0)

  const body = {
    contents: [
      {
        parts: [
          { text: promptText },
          { inlineData: baseImage },
          ...refs.map((r) => ({ inlineData: r })),
        ],
      },
    ],
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), EDIT_TIMEOUT_MS)
  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 300)}`)
    }
    const j: any = await res.json()
    const parts: any[] = j?.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find((p) => p?.inlineData?.data)
    if (!imagePart) {
      const textPart = parts.find((p) => p?.text)
      throw new Error(
        'Gemini 응답에 이미지가 없음' + (textPart ? ` — 모델 응답: ${String(textPart.text).slice(0, 200)}` : ''),
      )
    }
    const mimeType: string = imagePart.inlineData.mimeType ?? 'image/png'
    const bytes = Buffer.from(imagePart.inlineData.data, 'base64')
    return { bytes, mimeType, durationMs: Date.now() - t0 }
  } finally {
    clearTimeout(timeoutId)
  }
}

interface InlineData {
  mimeType: string
  data: string
}

async function loadAsInlineData(path: string): Promise<InlineData> {
  const buf = await readFile(path)
  return { mimeType: guessMime(path), data: buf.toString('base64') }
}

function guessMime(path: string): string {
  const p = path.toLowerCase()
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg'
  if (p.endsWith('.webp')) return 'image/webp'
  if (p.endsWith('.gif')) return 'image/gif'
  return 'image/png'
}

// 편집 지시문. 한국어 카드뉴스 브랜드 맥락 + 스타일 레시피 + 텍스트는 "이미지 안에 넣지 말 것" 강제.
function buildPrompt(recipe: StyleRecipe | undefined, instruction: string | undefined, hasRefs: boolean): string {
  const lines: string[] = []
  lines.push(
    '다음 제품/레퍼런스 이미지를 기반으로, 인스타그램 카드뉴스 1:1 배경으로 쓸 새로운 이미지를 만드세요.',
  )
  lines.push(
    '중요: 이미지 안에 어떤 글자나 텍스트도 넣지 마세요. 텍스트는 프론트엔드에서 CSS 로 따로 얹힙니다.',
  )
  if (hasRefs) {
    lines.push('추가로 첨부된 레퍼런스 이미지들의 분위기·색감·구도를 참고해 통일된 시리즈 감각을 유지하세요.')
  }
  if (recipe) {
    lines.push('')
    lines.push('[브랜드 스타일 가이드 — 반드시 반영]')
    lines.push(`· 팔레트: ${recipe.palette} (주 ${recipe.rawColors.primary}, 보조 ${recipe.rawColors.secondary})`)
    lines.push(`· 조명: ${recipe.lighting}`)
    lines.push(`· 구도: ${recipe.composition}`)
    lines.push(`· 흐름: ${recipe.sharedMood}`)
  }
  if (instruction && instruction.trim()) {
    lines.push('')
    lines.push(`[사용자 추가 지시]`)
    lines.push(instruction.trim())
  }
  lines.push('')
  lines.push('출력: 1080×1080 비율 제품·배경 합성 이미지 1장. 워터마크·로고·캡션 없음.')
  return lines.join('\n')
}

// 저장 헬퍼 — 편집 결과를 uploads 디렉터리에 기록하고 URL 반환.
export async function saveEditedImage(bytes: Buffer, mimeType: string): Promise<string> {
  const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/webp' ? 'webp' : 'png'
  const filename = `${Date.now()}-edit-${Math.random().toString(36).slice(2, 8)}.${ext}`
  const dir = join(process.cwd(), 'public', 'uploads')
  const path = join(dir, filename)
  await writeFile(path, bytes)
  return `/uploads/${filename}`
}
