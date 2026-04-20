import { Body, Controller, Post } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ReelsService } from './reels.service'
import { GenerateReelDto } from './dto/generate-reel.dto'

@ApiTags('reels')
@Controller('api/reels')
export class ReelsController {
  constructor(private svc: ReelsService) {}

  @Post()
  @ApiOperation({
    summary: '카드 프레임 → 9:16 MP4 릴스 생성',
    description: [
      '클라이언트가 1080×1920 (또는 임의 크기) PNG 프레임 배열을 base64 로 전송.',
      '서버는 ffmpeg xfade 필터로 전환(페이드/슬라이드/줌)을 입힌 단일 MP4 를 /uploads/reels/ 아래에 저장하고 URL 반환.',
      '총 재생 시간 = N × durationPerCard − (N−1) × 0.5s (예: 5 × 3 − 4 × 0.5 = 13s).',
    ].join(' '),
  })
  async generate(@Body() body: GenerateReelDto) {
    return this.svc.generate(body)
  }
}
