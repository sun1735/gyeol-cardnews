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
import { CurrentUser } from '../auth/auth.guard'
import type { AuthUser } from '../auth/auth.service'
import { assertBrandOwnership } from '../auth/ownership'
import { chunkText } from './chunker'
import { CreateDocDto } from './dto/create-doc.dto'

@ApiTags('knowledge')
@Controller('api/knowledge/docs')
export class KnowledgeDocsController {
  constructor(private prisma: PrismaService) {}

  @Post()
  @ApiOperation({ summary: '브랜드 지식노트 문서 등록 (자동 청킹)' })
  async create(@Body() dto: CreateDocDto, @CurrentUser() user: AuthUser | null) {
    const brand = await this.prisma.brandProfile.findUnique({ where: { id: dto.brandId } })
    if (!brand) throw new BadRequestException('brandId 가 유효하지 않습니다')
    await assertBrandOwnership(this.prisma, dto.brandId, user)

    const chunks = chunkText(dto.contentText)
    if (!chunks.length) throw new BadRequestException('contentText 가 비어있습니다')

    const doc = await this.prisma.brandKnowledgeDoc.create({
      data: {
        brandId: dto.brandId,
        title: dto.title,
        sourceType: dto.sourceType,
        sourceUrl: dto.sourceUrl ?? null,
        contentText: dto.contentText,
        status: 'ready',
        chunks: {
          create: chunks.map((c) => ({
            brandId: dto.brandId,
            chunkIndex: c.index,
            text: c.text,
            tokenCount: c.tokenCount,
          })),
        },
      },
    })
    return { docId: doc.id, status: doc.status, chunkCount: chunks.length }
  }

  @Get()
  @ApiOperation({ summary: '브랜드 지식노트 문서 목록' })
  async list(@Query('brandId') brandId?: string) {
    if (!brandId) throw new BadRequestException('brandId 쿼리 필수')
    const docs = await this.prisma.brandKnowledgeDoc.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        sourceType: true,
        sourceUrl: true,
        status: true,
        createdAt: true,
        _count: { select: { chunks: true } },
      },
    })
    return {
      docs: docs.map((d) => ({
        id: d.id,
        title: d.title,
        sourceType: d.sourceType,
        sourceUrl: d.sourceUrl,
        status: d.status,
        createdAt: d.createdAt,
        chunkCount: d._count.chunks,
      })),
    }
  }

  @Delete(':id')
  @ApiOperation({ summary: '지식노트 문서 삭제 (청크 cascade)' })
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser | null) {
    const doc = await this.prisma.brandKnowledgeDoc.findUnique({
      where: { id },
      select: { brandId: true },
    })
    if (!doc) throw new NotFoundException('문서를 찾을 수 없습니다')
    await assertBrandOwnership(this.prisma, doc.brandId, user)
    await this.prisma.brandKnowledgeDoc.delete({ where: { id } })
    return { ok: true }
  }
}
