import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CurrentUser } from '../auth/auth.guard'
import type { AuthUser } from '../auth/auth.service'
import { assertBrandOwnership } from '../auth/ownership'
import { PrismaService } from '../prisma/prisma.service'
import { GenerateFromNoteDto } from './dto/generate-from-note.dto'
import { GenerateNoteService } from './generate-note.service'

@ApiTags('generate')
@Controller('api/generate')
export class GenerateNoteController {
  constructor(
    private svc: GenerateNoteService,
    private prisma: PrismaService,
  ) {}

  // RAG 카드 생성 = 텍스트 Gemini + (유저 선택 시) 카드별 이미지 편집 → 최대 10회 이미지 호출
  // 분당 10회 (e2e 테스트 여유 + 실사용자 연속 재생성 시나리오 수용)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('cards-from-note')
  @ApiOperation({
    summary: '브랜드 지식노트 기반 비동기 카드 생성 시작 (Mode A RAG)',
    description:
      '요청을 GenerationJob 으로 적재 후 jobId 반환. GET /api/generate/jobs/:id 로 진행 상태 폴링.',
  })
  async start(@Body() dto: GenerateFromNoteDto, @CurrentUser() user: AuthUser | null) {
    await assertBrandOwnership(this.prisma, dto.brandId, user)
    return this.svc.enqueue(dto)
  }

  @Get('jobs/:id')
  @ApiOperation({ summary: '잡 상태 조회 (완료 시 cards + meta 포함)' })
  async getJob(@Param('id') id: string) {
    return this.svc.getJob(id)
  }
}
