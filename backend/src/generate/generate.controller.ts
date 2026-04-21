import { Body, Controller, Ip, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { GenerateService } from './generate.service'
import { GenerateCardsDto } from './dto/generate-cards.dto'

@ApiTags('generate')
@Controller('api/generate')
export class GenerateController {
  constructor(private svc: GenerateService) {}

  // 텍스트 카피 생성 — 분당 10회, 시간당 100회
  @Throttle({ short: { limit: 10, ttl: 60_000 }, long: { limit: 100, ttl: 3_600_000 } })
  @Post('cards')
  @ApiOperation({
    summary: '프롬프트/수동입력 → 카드 데이터 자동 생성 (DB 저장 없음)',
    description: [
      'mode="auto": prompt + count 로 브랜드·키워드 기반 템플릿 또는 GPT 로 생성.',
      'mode="manual": 각 카드의 title/body/subtext/cta 를 받아 빈 필드는 브랜드 기반 기본값으로 채움.',
      '양 모드 모두 과장·의학적 단정 표현은 자동으로 완화 (sanitize.ts).',
      'NSFW·브랜드안전 위반 입력은 400 으로 차단되며 감사 로그에 기록된다.',
      'OPENAI_API_KEY 가 없거나 실패해도 템플릿 폴백으로 항상 결과를 반환한다.',
    ].join(' '),
  })
  async generateCards(@Body() body: GenerateCardsDto, @Ip() clientIp: string) {
    return this.svc.run({
      mode: body.mode,
      prompt: body.prompt,
      count: body.count,
      cards: body.cards,
      brandId: body.brandId,
      baseImageUrls: body.baseImageUrls,
      clientIp,
    })
  }
}
