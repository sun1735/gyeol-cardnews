import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { PrismaService } from '../prisma/prisma.service'
import { CreateImageDto } from './dto/create-image.dto'

@ApiTags('knowledge')
@Controller('api/knowledge/images')
export class KnowledgeImagesController {
  constructor(private prisma: PrismaService) {}

  @Post()
  @ApiOperation({ summary: '브랜드 이미지 라이브러리 등록 (태그 달린 검색 대상)' })
  async create(@Body() dto: CreateImageDto) {
    const brand = await this.prisma.brandProfile.findUnique({ where: { id: dto.brandId } })
    if (!brand) throw new BadRequestException('brandId 가 유효하지 않습니다')

    const asset = await this.prisma.brandImageAsset.create({
      data: {
        brandId: dto.brandId,
        url: dto.url,
        label: dto.label ?? '',
        tags: JSON.stringify(dto.tags ?? []),
        usageRights: dto.usageRights ?? 'owned',
        qualityScore: dto.qualityScore ?? 0.5,
      },
    })
    return formatImage(asset)
  }

  @Get()
  @ApiOperation({ summary: '브랜드 이미지 라이브러리 목록' })
  async list(@Query('brandId') brandId?: string) {
    if (!brandId) throw new BadRequestException('brandId 쿼리 필수')
    const assets = await this.prisma.brandImageAsset.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
    })
    return { images: assets.map(formatImage) }
  }

  @Delete(':id')
  @ApiOperation({ summary: '이미지 에셋 삭제 (디스크 파일은 남겨둠)' })
  async remove(@Param('id') id: string) {
    try {
      await this.prisma.brandImageAsset.delete({ where: { id } })
    } catch {
      throw new NotFoundException('이미지를 찾을 수 없습니다')
    }
    return { ok: true }
  }
}

function formatImage(a: {
  id: string
  brandId: string
  url: string
  label: string
  tags: string
  usageRights: string
  qualityScore: number
  createdAt: Date
}) {
  let tags: string[] = []
  try {
    const parsed = JSON.parse(a.tags || '[]')
    if (Array.isArray(parsed)) tags = parsed.filter((t) => typeof t === 'string')
  } catch {}
  return {
    id: a.id,
    brandId: a.brandId,
    url: a.url,
    label: a.label,
    tags,
    usageRights: a.usageRights,
    qualityScore: a.qualityScore,
    createdAt: a.createdAt,
  }
}
