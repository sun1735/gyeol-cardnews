// 브랜드 이미지 라이브러리 후보를 카드별로 랭킹.
// 가중치: brandFit(0.5) + quality(0.3) + recency(0.2) — MVP 는 semantic(임베딩) 제외.

import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { tokenize } from './knowledge-search.service'

export interface RankedImage {
  id: string
  url: string
  label: string
  tags: string[]
  score: number
}

interface DraftForRanking {
  title: string
  body: string
}

@Injectable()
export class ImageRankerService {
  constructor(private prisma: PrismaService) {}

  async rankForCards(brandId: string, prompt: string, drafts: DraftForRanking[]): Promise<(RankedImage | null)[]> {
    const assets = await this.prisma.brandImageAsset.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    })
    if (!assets.length) return drafts.map(() => null)

    const now = Date.now()
    const promptTokens = tokenize(prompt)

    const assigned = new Set<string>()
    const results: (RankedImage | null)[] = []

    for (const draft of drafts) {
      const cardTokens = new Set([...promptTokens, ...tokenize(`${draft.title} ${draft.body}`)])
      const cardTokenArr = Array.from(cardTokens)

      const scored = assets
        .map((a) => {
          const tags = parseTags(a.tags)
          const brandFit = fitScore(cardTokenArr, a.label, tags)
          const quality = clamp01(a.qualityScore ?? 0.5)
          const ageDays = (now - new Date(a.createdAt).getTime()) / (1000 * 60 * 60 * 24)
          const recency = 1 / (1 + ageDays / 30)
          const score = 0.5 * brandFit + 0.3 * quality + 0.2 * recency
          return { a, tags, score }
        })
        .sort((x, y) => y.score - x.score)

      // 이미 배정된 것은 피해서 다음 후보로 (5카드에 5다른 이미지 분배)
      const picked = scored.find((s) => !assigned.has(s.a.id)) ?? scored[0]
      if (!picked) {
        results.push(null)
        continue
      }
      assigned.add(picked.a.id)
      results.push({
        id: picked.a.id,
        url: picked.a.url,
        label: picked.a.label,
        tags: picked.tags,
        score: picked.score,
      })
    }
    return results
  }
}

function fitScore(cardTokens: string[], label: string, tags: string[]): number {
  if (!cardTokens.length) return 0
  const target = `${label} ${tags.join(' ')}`.toLowerCase()
  if (!target.trim()) return 0
  let hits = 0
  for (const tok of cardTokens) if (target.includes(tok)) hits++
  return hits / cardTokens.length
}

function parseTags(s: string): string[] {
  if (!s) return []
  try {
    const p = JSON.parse(s)
    if (Array.isArray(p)) return p.filter((t) => typeof t === 'string')
  } catch {}
  return []
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Number(n) || 0))
}
