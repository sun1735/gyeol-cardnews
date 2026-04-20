import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { DEFAULT_BACKGROUNDS } from './defaults'

@ApiTags('backgrounds')
@Controller('api/backgrounds')
export class BackgroundsController {
  @Get()
  @ApiOperation({
    summary: '기본 배경 템플릿 목록 (5장)',
    description:
      '이미지가 없는 카드에 자동 할당되는 배경 카탈로그. key/url/palette 를 그대로 사용해 UI 스와치 피커에 표시할 수 있다.',
  })
  list() {
    return { backgrounds: DEFAULT_BACKGROUNDS }
  }
}
