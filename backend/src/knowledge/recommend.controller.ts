import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common'
import { ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger'
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
import { PrismaService } from '../prisma/prisma.service'
import { callGeminiJson } from '../generate/llm-gemini'

export class RecommendIdeasDto {
  @ApiProperty({ example: 'clz_brand_id' })
  @IsString()
  brandId!: string

  @ApiProperty({ example: 5, minimum: 1, maximum: 8, required: false })
  @IsOptional() @IsInt() @Min(1) @Max(8)
  maxIdeas?: number
}

@ApiTags('knowledge')
@Controller('api/knowledge/recommend-ideas')
export class RecommendController {
  private readonly logger = new Logger('RecommendController')

  constructor(private prisma: PrismaService) {}

  @Post()
  @ApiOperation({
    summary: '브랜드 지식노트 분석 → 만들 만한 카드뉴스 아이디어 N개 제안',
    description:
      '브랜드 프로필 + 등록된 모든 지식노트 + 이미지 라이브러리 라벨/태그 를 Gemini 2.5 Flash 에 넘겨 카드뉴스 캠페인 후보를 생성. 각 아이디어는 prompt·count·reason 포함해 프런트가 RAG 생성 흐름에 바로 주입 가능.',
  })
  async recommend(@Body() dto: RecommendIdeasDto) {
    if (!process.env.GEMINI_API_KEY) {
      throw new HttpException(
        '아이디어 추천이 비활성화되어 있습니다 (GEMINI_API_KEY 미설정).',
        HttpStatus.SERVICE_UNAVAILABLE,
      )
    }

    const brand = await this.prisma.brandProfile.findUnique({ where: { id: dto.brandId } })
    if (!brand) throw new BadRequestException('brandId 가 유효하지 않습니다')

    const [docs, images] = await Promise.all([
      this.prisma.brandKnowledgeDoc.findMany({
        where: { brandId: dto.brandId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      this.prisma.brandImageAsset.findMany({
        where: { brandId: dto.brandId },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
    ])

    if (docs.length === 0 && images.length === 0) {
      throw new BadRequestException(
        '등록된 지식노트나 이미지가 없습니다 — 먼저 문서·이미지를 최소 1개 이상 추가해 주세요.',
      )
    }

    const maxIdeas = Math.max(1, Math.min(8, dto.maxIdeas ?? 5))

    // 컨텍스트 요약 — 문서는 앞 400자씩만, 이미지는 라벨+태그
    const docBlock = docs.length
      ? docs.map((d, i) => `[D${i + 1}] ${d.title}\n${d.contentText.slice(0, 400)}`).join('\n---\n')
      : '(등록된 문서 없음)'
    const imageBlock = images.length
      ? images
          .map((a, i) => {
            const tags = safeTags(a.tags)
            return `[I${i + 1}] ${a.label || '(라벨 없음)'} · 태그: ${tags.join(', ') || '없음'}`
          })
          .join('\n')
      : '(등록된 이미지 없음)'

    const systemInstruction = [
      '한국어 카드뉴스 기획자. 브랜드 톤앤매너를 지키며 구체적이고 실행 가능한 캠페인 아이디어를 제안한다.',
      '각 아이디어는 실제로 이 브랜드가 인스타그램·SNS 에 올릴 법한 주제여야 하며, 의학적 단정·과장 표현은 쓰지 않는다.',
      '지식노트에 실제로 등장한 제품·서비스·사실을 근거로 삼고, 없는 사실을 꾸며내지 않는다.',
    ].join(' ')

    const userText = [
      `[브랜드]`,
      `이름: ${brand.name}`,
      `톤: ${brand.tone || '따뜻하고 진솔한'}`,
      `기본 문구: ${brand.defaultPhrase || ''}`,
      '',
      '[지식노트 문서]',
      docBlock,
      '',
      '[이미지 라이브러리 라벨·태그]',
      imageBlock,
      '',
      `[요청]`,
      `이 브랜드가 앞으로 만들 수 있는 카드뉴스 아이디어를 ${maxIdeas}개 제안하세요.`,
      `각 아이디어는 다음 필드를 포함: { title: 30자 이내 캠페인 제목, prompt: 실제 카드 생성에 그대로 넘길 한국어 프롬프트 (50~120자, 지식노트의 구체 사실 반영), suggestedCount: 3~10 사이 카드 수, reason: 왜 이 브랜드에 이 아이디어가 적합한지 한두 문장, usesImages: 이미지 라이브러리에서 쓸만한 라벨이 있으면 그 라벨들(최대 3) 배열 }.`,
      `아이디어는 서로 겹치지 않게 다양하게 제안 (예: 출시 소식·사용법·후기·Q&A·시즌 이벤트·인터뷰 등).`,
    ].join('\n')

    const schema = {
      type: 'object',
      properties: {
        ideas: {
          type: 'array',
          maxItems: maxIdeas,
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              prompt: { type: 'string' },
              suggestedCount: { type: 'integer' },
              reason: { type: 'string' },
              usesImages: { type: 'array', items: { type: 'string' } },
            },
            required: ['title', 'prompt', 'suggestedCount', 'reason', 'usesImages'],
          },
        },
      },
      required: ['ideas'],
    }

    try {
      const parsed = await callGeminiJson<{ ideas: any[] }>({
        systemInstruction,
        userText,
        schema,
        timeoutMs: 30_000,
        temperature: 0.8,
      })
      const ideas = Array.isArray(parsed?.ideas) ? parsed.ideas.slice(0, maxIdeas) : []
      // 필드 정규화
      const cleaned = ideas
        .map((idea) => ({
          title: String(idea?.title ?? '').slice(0, 50).trim(),
          prompt: String(idea?.prompt ?? '').slice(0, 500).trim(),
          suggestedCount: clampInt(idea?.suggestedCount, 3, 10, 5),
          reason: String(idea?.reason ?? '').slice(0, 300).trim(),
          usesImages: Array.isArray(idea?.usesImages)
            ? idea.usesImages.slice(0, 3).map((s: any) => String(s).slice(0, 50))
            : [],
        }))
        .filter((idea) => idea.title && idea.prompt)
      return {
        ideas: cleaned,
        context: { docsUsed: docs.length, imagesUsed: images.length },
      }
    } catch (e: any) {
      this.logger.warn(`아이디어 추천 실패: ${e?.message ?? e}`)
      throw new HttpException(
        `아이디어 추천 실패: ${e?.message ?? '알 수 없음'}`,
        HttpStatus.BAD_GATEWAY,
      )
    }
  }
}

function safeTags(raw: string): string[] {
  try {
    const p = JSON.parse(raw || '[]')
    if (Array.isArray(p)) return p.filter((x) => typeof x === 'string')
  } catch {}
  return []
}

function clampInt(v: any, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, n))
}
