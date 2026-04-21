import {
  BadRequestException,
  Body,
  Controller,
  HttpException,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'
import { join, normalize } from 'path'
import { PrismaService } from '../prisma/prisma.service'
import { buildStyleRecipe } from '../generate/style'
import { checkSafety } from '../generate/safety'
import { editImageWithGemini, generateImageWithGemini, saveEditedImage } from './editor'

export class EditImageDto {
  @ApiProperty({ example: '/uploads/1776666144533-skmkh2.png', description: '원본 이미지 URL (/uploads/...)' })
  @IsString()
  imageUrl!: string

  @ApiPropertyOptional({ example: 'clz1brandcuid', description: '브랜드 CUID — 스타일 레시피 도출용' })
  @IsOptional() @IsString()
  brandId?: string

  @ApiPropertyOptional({ example: '배경을 따뜻한 베이지 스튜디오로 바꿔주세요', maxLength: 500 })
  @IsOptional() @IsString() @MaxLength(500)
  instruction?: string

  @ApiPropertyOptional({ type: [String], example: ['/uploads/ref-a.png'], description: '참조 이미지 1~3장 (선택)' })
  @IsOptional() @IsArray() @ArrayMaxSize(3)
  @IsString({ each: true })
  refImageUrls?: string[]
}

export class GenerateImageDto {
  @ApiProperty({
    example: '유순 무자극 로션 패키지. 따뜻한 베이지 스튜디오 배경, 자연광',
    description: '생성할 이미지 설명. 제품명·장면·구도·색감 등 구체적일수록 품질이 올라감.',
    maxLength: 1000,
  })
  @IsString() @MinLength(1) @MaxLength(1000)
  prompt!: string

  @ApiPropertyOptional({ example: 'clz1brandcuid' })
  @IsOptional() @IsString()
  brandId?: string

  @ApiPropertyOptional({ type: [String], description: '스타일 레퍼런스 이미지 1~3장 (선택)' })
  @IsOptional() @IsArray() @ArrayMaxSize(3)
  @IsString({ each: true })
  refImageUrls?: string[]

  @ApiPropertyOptional({ enum: ['1:1', '4:5', '9:16', '16:9'], example: '1:1' })
  @IsOptional() @IsIn(['1:1', '4:5', '9:16', '16:9'])
  aspectRatio?: '1:1' | '4:5' | '9:16' | '16:9'

  @ApiPropertyOptional({ example: 1080, minimum: 200, maximum: 4000 })
  @IsOptional() @IsInt() @Min(200) @Max(4000)
  width?: number

  @ApiPropertyOptional({ example: 1080, minimum: 200, maximum: 4000 })
  @IsOptional() @IsInt() @Min(200) @Max(4000)
  height?: number
}

@ApiTags('images')
@Controller('api/images')
export class ImagesController {
  constructor(private prisma: PrismaService) {}

  // 이미지 편집은 호출당 ~$0.04 — IP별 분당 3회, 시간당 30회로 제한
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('edit')
  @ApiOperation({
    summary: 'AI 이미지 편집 — Gemini 2.5 Flash Image (Mode B)',
    description: [
      '원본 이미지 URL + (선택) 브랜드·참조·사용자 지시 → 브랜드 톤으로 재편집된 새 이미지 URL 반환.',
      'GEMINI_API_KEY 가 없으면 503 반환. 악의적 입력(instruction)은 safety 필터로 400 차단.',
      '출력 이미지에는 텍스트가 포함되지 않으며, 프론트엔드에서 CSS 로 오버레이된다.',
    ].join(' '),
  })
  async edit(@Body() body: EditImageDto) {
    const logger = new Logger('ImagesController')
    if (!process.env.GEMINI_API_KEY) {
      throw new HttpException(
        'AI 이미지 편집이 비활성화되어 있습니다 (GEMINI_API_KEY 미설정).',
        HttpStatus.SERVICE_UNAVAILABLE,
      )
    }

    const safety = checkSafety(body.instruction)
    if (safety.blocked) {
      throw new BadRequestException(
        `지시문에 허용되지 않는 표현이 포함되어 있습니다: ${safety.label} ("${safety.matched}")`,
      )
    }

    const basePath = resolveUploadPath(body.imageUrl)
    const refPaths = (body.refImageUrls ?? []).map(resolveUploadPath)

    let recipe
    if (body.brandId) {
      const brand = await this.prisma.brandProfile.findUnique({ where: { id: body.brandId } })
      if (brand) recipe = buildStyleRecipe(brand)
    }

    try {
      const result = await editImageWithGemini({
        basePath,
        refPaths,
        recipe,
        instruction: body.instruction,
      })
      const url = await saveEditedImage(result.bytes, result.mimeType)
      return {
        url,
        durationMs: result.durationMs,
        model: 'gemini-2.5-flash-image',
      }
    } catch (e: any) {
      logger.warn(`이미지 편집 실패: ${e?.message ?? e}`)
      if (e?.name === 'AbortError') {
        throw new HttpException('이미지 편집 타임아웃', HttpStatus.GATEWAY_TIMEOUT)
      }
      throw new HttpException(
        `이미지 편집 실패: ${e?.message ?? '알 수 없는 오류'}`,
        HttpStatus.BAD_GATEWAY,
      )
    }
  }

  // 이미지 생성도 호출당 ~$0.04 — 동일 제한
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post('generate')
  @ApiOperation({
    summary: 'AI 이미지 생성 (text-to-image) — Gemini 2.5 Flash Image',
    description: [
      '프롬프트만으로 새 이미지 생성. 베이스 이미지 불필요.',
      '브랜드 스타일 레시피 자동 주입. 참조 이미지(선택) 는 스타일 가이드로만 사용.',
      '비율/픽셀 힌트는 모델에 전달되지만 정확한 해상도 대응은 보장되지 않음 — 최종 크기는 프론트 CSS 가 맞춤.',
    ].join(' '),
  })
  async generate(@Body() body: GenerateImageDto) {
    const logger = new Logger('ImagesController')
    if (!process.env.GEMINI_API_KEY) {
      throw new HttpException(
        'AI 이미지 생성이 비활성화되어 있습니다 (GEMINI_API_KEY 미설정).',
        HttpStatus.SERVICE_UNAVAILABLE,
      )
    }

    const safety = checkSafety(body.prompt)
    if (safety.blocked) {
      throw new BadRequestException(
        `프롬프트에 허용되지 않는 표현이 포함되어 있습니다: ${safety.label} ("${safety.matched}")`,
      )
    }

    const refPaths: string[] = []
    for (const r of body.refImageUrls ?? []) {
      try {
        refPaths.push(resolveUploadPath(r))
      } catch {}
    }

    let recipe
    if (body.brandId) {
      const brand = await this.prisma.brandProfile.findUnique({ where: { id: body.brandId } })
      if (brand) recipe = buildStyleRecipe(brand)
    }

    try {
      const result = await generateImageWithGemini({
        prompt: body.prompt,
        refPaths,
        recipe,
        aspectRatio: body.aspectRatio,
        width: body.width,
        height: body.height,
      })
      const url = await saveEditedImage(result.bytes, result.mimeType)
      return {
        url,
        durationMs: result.durationMs,
        model: 'gemini-2.5-flash-image',
      }
    } catch (e: any) {
      logger.warn(`이미지 생성 실패: ${e?.message ?? e}`)
      if (e?.name === 'AbortError') {
        throw new HttpException('이미지 생성 타임아웃', HttpStatus.GATEWAY_TIMEOUT)
      }
      throw new HttpException(
        `이미지 생성 실패: ${e?.message ?? '알 수 없는 오류'}`,
        HttpStatus.BAD_GATEWAY,
      )
    }
  }
}

// /uploads/xxx.png URL 을 public/uploads/xxx.png 디스크 경로로 매핑.
// 경로 탈출 방어 — uploads 디렉터리 바깥으로 나가는 ../ 시퀀스 차단.
function resolveUploadPath(url: string): string {
  if (typeof url !== 'string' || !url.startsWith('/uploads/')) {
    throw new BadRequestException(`지원하지 않는 이미지 URL: ${url}`)
  }
  const rel = url.replace(/^\/uploads\//, '')
  const root = join(process.cwd(), 'public', 'uploads')
  const full = normalize(join(root, rel))
  if (!full.startsWith(root)) {
    throw new BadRequestException('허용되지 않는 경로')
  }
  return full
}
