// MVP 키워드 기반 지식노트 검색 (BM25-like).
// embedding 없이 토큰 overlap + 길이 정규화 + 중복 감쇠로 대충 "관련 있는 청크 Top-K".
// 나중에 pgvector + 임베딩 붙일 자리는 retrieve() 내부만 교체하면 됨.

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

export interface RetrievedChunk {
  chunkId: string
  docId: string
  docTitle: string
  text: string
  score: number
}

@Injectable()
export class KnowledgeSearchService {
  constructor(private prisma: PrismaService) {}

  async retrieve(brandId: string, prompt: string, topK = 8): Promise<RetrievedChunk[]> {
    const tokens = tokenize(prompt)
    if (!tokens.length) return []

    const chunks = await this.prisma.brandKnowledgeChunk.findMany({
      where: { brandId },
      include: { doc: { select: { title: true, id: true } } },
    })
    if (!chunks.length) return []

    const scored: RetrievedChunk[] = chunks.map((c) => ({
      chunkId: c.id,
      docId: c.doc.id,
      docTitle: c.doc.title,
      text: c.text,
      score: scoreChunk(tokens, c.text),
    }))
    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }
}

// 한국어/영어 공통 단순 토크나이저. 길이 2 미만 제거, 소문자화.
// 한글은 n-gram(2-3자) 도 추가 — 공백이 단어 경계가 아닌 경우 대응.
export function tokenize(s: string): string[] {
  const base = s
    .toLowerCase()
    .split(/[\s,.!?;:·()[\]{}"'「」『』—/\\|#]+/)
    .filter((t) => t.length >= 2)
  const out = new Set<string>(base)
  for (const tok of base) {
    if (/^[가-힣]+$/.test(tok) && tok.length >= 3) {
      // 긴 한글 토큰은 2-gram / 3-gram 도 키워드로 같이 들고간다
      for (let i = 0; i + 2 <= tok.length; i++) out.add(tok.slice(i, i + 2))
      for (let i = 0; i + 3 <= tok.length; i++) out.add(tok.slice(i, i + 3))
    }
  }
  return Array.from(out)
}

function scoreChunk(queryTokens: string[], chunkText: string): number {
  const textLower = chunkText.toLowerCase()
  let score = 0
  let hits = 0
  for (const tok of queryTokens) {
    const occ = countOccurrences(textLower, tok)
    if (occ > 0) {
      score += Math.log(1 + occ) // 같은 토큰 반복 등장은 감쇠
      hits++
    }
  }
  // 길이 정규화 — 짧고 집중된 청크 우대
  const lengthPenalty = Math.log(chunkText.length + 1)
  const coverage = queryTokens.length ? hits / queryTokens.length : 0
  return (score / lengthPenalty) * (0.5 + 0.5 * coverage)
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0
  let count = 0
  let idx = 0
  while ((idx = haystack.indexOf(needle, idx)) !== -1) {
    count++
    idx += needle.length
  }
  return count
}
