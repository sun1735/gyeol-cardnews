import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { UpdateCardDto } from './dto/update-card.dto'

@Injectable()
export class CardsService {
  constructor(private prisma: PrismaService) {}

  async update(id: string, dto: UpdateCardDto) {
    const existing = await this.prisma.card.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException('card not found')

    const data: Record<string, any> = {}
    if (dto.title !== undefined) data.title = dto.title
    if (dto.body !== undefined) data.body = dto.body
    if (dto.subtext !== undefined) data.subtext = dto.subtext
    if (dto.cta !== undefined) data.cta = dto.cta
    if (dto.imageUrl !== undefined) data.imageUrl = dto.imageUrl ? dto.imageUrl : null
    if (dto.layout !== undefined) data.layout = dto.layout
    if (dto.order !== undefined) data.order = dto.order

    return this.prisma.card.update({ where: { id }, data })
  }
}
