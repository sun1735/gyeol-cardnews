import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { GenerateFromNoteDto } from './dto/generate-from-note.dto'
import { GenerateNoteService } from './generate-note.service'

@ApiTags('generate')
@Controller('api/generate')
export class GenerateNoteController {
  constructor(private svc: GenerateNoteService) {}

  // RAG 카드 생성 = 텍스트 Gemini + (유저 선택 시) 카드별 이미지 편집 → 최대 10회 이미지 호출
  // 분당 5회, 시간당 30회로 빡세게
  @Throttle({ short: { limit: 5, ttl: 60_000 }, long: { limit: 30, ttl: 3_600_000 } })
  @Post('cards-from-note')
  @ApiOperation({
    summary: '브랜드 지식노트 기반 비동기 카드 생성 시작 (Mode A RAG)',
    description:
      '요청을 GenerationJob 으로 적재 후 jobId 반환. GET /api/generate/jobs/:id 로 진행 상태 폴링.',
  })
  async start(@Body() dto: GenerateFromNoteDto) {
    return this.svc.enqueue(dto)
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: '잡 상태 조회 (완료 시 cards + meta 포함)' })
  async getJob(@Param('id') id: string) {
    return this.svc.getJob(id)
  }
}
