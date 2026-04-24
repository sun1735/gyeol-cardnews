import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator'

export class ManualCardInputDto {
  @ApiPropertyOptional({ example: '아침 산책', description: '비워두면 브랜드/레이아웃 기반으로 자동 채움' })
  @IsOptional() @IsString() @MaxLength(120)
  title?: string

  @ApiPropertyOptional({ example: '햇살 좋은 정원에서 시작하는 느린 산책으로 하루를 엽니다.' })
  @IsOptional() @IsString() @MaxLength(1000)
  body?: string

  @ApiPropertyOptional({ example: '하루의 시작', description: '보조 텍스트 (최대 200자)' })
  @IsOptional() @IsString() @MaxLength(200)
  subtext?: string

  @ApiPropertyOptional({ example: '자세히 보기 →', description: 'Call-to-action (최대 60자)' })
  @IsOptional() @IsString() @MaxLength(60)
  cta?: string

  @ApiPropertyOptional({ example: '/uploads/abc.png' })
  @IsOptional() @IsString()
  imageUrl?: string

  @ApiPropertyOptional({ enum: ['cover', 'content', 'cta'], description: '생략 시 카드 순서로 자동 결정' })
  @IsOptional() @IsIn(['cover', 'content', 'cta'])
  layout?: 'cover' | 'content' | 'cta'
}

export class GenerateCardsDto {
  @ApiProperty({ enum: ['auto', 'manual'], example: 'auto' })
  @IsIn(['auto', 'manual'])
  mode: 'auto' | 'manual'

  @ApiPropertyOptional({
    example: '유순 임산부와 유아를 위한 케어 서비스 안내',
    description: 'auto 모드에서 필수 (1~2000자). 과장/의학적 단정 표현은 자동 완화됩니다.',
  })
  @ValidateIf((o) => o.mode === 'auto')
  @IsString() @MinLength(1) @MaxLength(2000)
  prompt?: string

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 10, description: 'auto 모드에서 필수 (1~10)' })
  @ValidateIf((o) => o.mode === 'auto')
  @IsInt() @Min(1) @Max(10)
  count?: number

  @ApiPropertyOptional({ type: [ManualCardInputDto], description: 'manual 모드에서 필수 (1~10개)' })
  @ValidateIf((o) => o.mode === 'manual')
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ManualCardInputDto)
  cards?: ManualCardInputDto[]

  @ApiPropertyOptional({ example: 'clz1brandcuid', description: '브랜드 CUID (양 모드 공통, 선택)' })
  @IsOptional() @IsString()
  brandId?: string

  @ApiPropertyOptional({
    type: [String],
    example: ['/uploads/1776666144533-skmkh2.png'],
    description:
      'Mode A — 모든 카드에 공통으로 적용할 참조 이미지 1~3장. 카드별 개별 업로드(imageUrl)가 없으면 이 배열이 round-robin 으로 배경에 주입된다. 먼저 /api/upload 로 URL 확보 후 전달.',
  })
  @IsOptional() @IsArray() @ArrayMaxSize(3)
  @IsString({ each: true })
  baseImageUrls?: string[]

  @ApiPropertyOptional({
    enum: ['basic', 'product-ad', 'promo'],
    example: 'basic',
    description: '카드 템플릿. product-ad 는 상품 광고용 구조화 카피 출력.',
  })
  @IsOptional() @IsIn(['basic', 'product-ad', 'promo'])
  template?: 'basic' | 'product-ad' | 'promo'

  @ApiPropertyOptional({
    description:
      'product-ad / promo 템플릿에서 baseImageUrls 가 없을 때 Gemini Image 로 배경 이미지를 자동 생성할지. 기본 true.',
    example: true,
  })
  @IsOptional()
  autoGenerateImage?: boolean
}
