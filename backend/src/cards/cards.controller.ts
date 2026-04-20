import { Body, Controller, Param, Put } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { CardsService } from './cards.service'
import { UpdateCardDto } from './dto/update-card.dto'

@ApiTags('cards')
@Controller('api/cards')
export class CardsController {
  constructor(private svc: CardsService) {}

  @Put(':id')
  @ApiOperation({ summary: '카드 단건 업데이트 (전달된 필드만 반영)' })
  @ApiParam({ name: 'id', description: '카드 CUID' })
  async update(@Param('id') id: string, @Body() body: UpdateCardDto) {
    const card = await this.svc.update(id, body)
    return { card }
  }
}
