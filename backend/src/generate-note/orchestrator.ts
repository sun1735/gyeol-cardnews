// Phase 2 에서는 스텁 — 기존 generate.service 와 비슷하게 템플릿으로 응답.
// Phase 3 에서 KnowledgeSearchService + ImageRankerService + 병렬 이미지 편집으로 채운다.

import { Injectable } from '@nestjs/common'
import { GenerateFromNoteDto } from './dto/generate-from-note.dto'

interface CardOut {
  id: string
  layout: 'cover' | 'content' | 'cta'
  title: string
  body: string
  subtext: string
  cta: string
  imageUrl?: string
}

export interface OrchestratorResult {
  cards: CardOut[]
  meta: {
    source: 'note_rag'
    chunksUsed: number
    imagesRanked: number
    edited: number
    durationMs: number
    partial: boolean
  }
  partial: boolean
}

@Injectable()
export class Orchestrator {
  async run(
    dto: GenerateFromNoteDto,
    setProgress: (p: number) => Promise<void>,
  ): Promise<OrchestratorResult> {
    const t0 = Date.now()
    const n = dto.count

    await setProgress(20)

    // Phase 2 스텁: 실제 검색·카피·이미지 편집은 Phase 3 구현.
    // 현재는 요청을 받은 것을 확인하고 최소한의 카드 구조를 돌려준다.
    const cards: CardOut[] = []
    for (let i = 0; i < n; i++) {
      const layout: CardOut['layout'] = i === 0 ? 'cover' : i === n - 1 ? 'cta' : 'content'
      cards.push({
        id: randId(),
        layout,
        title: layout === 'cover' ? '출시 안내' : layout === 'cta' ? '함께해 주세요' : `포인트 ${i}`,
        body: dto.prompt.slice(0, 80),
        subtext: layout === 'cover' ? '새 이야기' : `${i + 1} / ${n}`,
        cta: layout === 'cover' ? '자세히 보기 →' : layout === 'cta' ? '문의하기 →' : '',
        imageUrl: dto.baseImageUrls?.[i % (dto.baseImageUrls.length || 1)],
      })
    }

    await setProgress(80)

    return {
      cards,
      meta: {
        source: 'note_rag',
        chunksUsed: 0,
        imagesRanked: 0,
        edited: 0,
        durationMs: Date.now() - t0,
        partial: false,
      },
      partial: false,
    }
  }
}

function randId() {
  return Math.random().toString(36).slice(2, 10)
}
