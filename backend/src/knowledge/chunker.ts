// MVP 용 단순 청커 — 단락 → 문장 단위로 ~500자 청크를 생성.
// 임베딩 없이 키워드 매칭만 할 것이므로 토큰 정확성보다 "읽기 쉬운 단위 분할"이 목적.

const CHUNK_TARGET = 500 // 목표 문자 수
const CHUNK_MAX = 800 // 한 청크 절대 상한

export interface Chunk {
  index: number
  text: string
  tokenCount: number // 대략적 (문자수/2 근사 — 한글 기준 거친 추정)
}

export function chunkText(input: string): Chunk[] {
  const normalized = input.replace(/\r\n?/g, '\n').trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean)
  const chunks: string[] = []
  let buffer = ''

  for (const para of paragraphs) {
    if (para.length > CHUNK_MAX) {
      // 단락 하나가 너무 길면 문장으로 쪼갠다.
      if (buffer) {
        chunks.push(buffer)
        buffer = ''
      }
      const sentences = splitSentences(para)
      let sentBuf = ''
      for (const s of sentences) {
        if (!sentBuf) {
          sentBuf = s
          continue
        }
        if (sentBuf.length + 1 + s.length > CHUNK_TARGET) {
          chunks.push(sentBuf)
          sentBuf = s
        } else {
          sentBuf += ' ' + s
        }
      }
      if (sentBuf) chunks.push(sentBuf)
      continue
    }

    if (!buffer) {
      buffer = para
      continue
    }
    if (buffer.length + 2 + para.length > CHUNK_TARGET) {
      chunks.push(buffer)
      buffer = para
    } else {
      buffer += '\n\n' + para
    }
  }
  if (buffer) chunks.push(buffer)

  return chunks.map((text, i) => ({
    index: i,
    text,
    tokenCount: Math.ceil(text.length / 2),
  }))
}

function splitSentences(p: string): string[] {
  // 한국어·영어 문장 끝 구두점 기준. 완벽하진 않지만 MVP 충분.
  return p
    .split(/(?<=[.!?。！？])\s+|(?<=다\.)\s+|(?<=요\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
