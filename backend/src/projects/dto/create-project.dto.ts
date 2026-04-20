import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator'

export class ProjectCardDto {
  @ApiPropertyOptional({ example: 0, minimum: 0 })
  @IsOptional() @IsInt() @Min(0)
  order?: number

  @ApiProperty({ example: '유순 · 오늘도 평안한 하루' })
  @IsString() @MaxLength(120)
  title: string

  @ApiProperty({ example: '가족처럼 곁에서 돌보는 하루를 소개합니다.' })
  @IsString() @MaxLength(1000)
  body: string

  @ApiPropertyOptional({ example: '유순 · 시니어 케어', description: '보조 텍스트 (최대 200자)' })
  @IsOptional() @IsString() @MaxLength(200)
  subtext?: string

  @ApiPropertyOptional({ example: '하루 보기 →', description: 'Call-to-action (최대 60자)' })
  @IsOptional() @IsString() @MaxLength(60)
  cta?: string

  @ApiPropertyOptional({ example: '/uploads/seed/yusoon-morning.svg' })
  @IsOptional() @IsString()
  imageUrl?: string

  @ApiProperty({ enum: ['cover', 'content', 'cta'], example: 'cover' })
  @IsIn(['cover', 'content', 'cta'])
  layout: 'cover' | 'content' | 'cta'
}

export class CreateProjectDto {
  @ApiProperty({ example: '유순 하루 일과 소개', description: '프로젝트 제목 (1~120자)' })
  @IsString() @MinLength(1) @MaxLength(120)
  title: string

  @ApiPropertyOptional({ example: '유순 요양원의 따뜻한 하루 — 산책, 식사, 프로그램' })
  @IsOptional() @IsString() @MaxLength(2000)
  prompt?: string

  @ApiProperty({ enum: ['1:1', '4:5', '9:16'], default: '1:1' })
  @IsIn(['1:1', '4:5', '9:16'])
  sizePreset: '1:1' | '4:5' | '9:16'

  @ApiProperty({ enum: ['auto', 'manual'], default: 'auto' })
  @IsIn(['auto', 'manual'])
  inputMode: 'auto' | 'manual'

  @ApiPropertyOptional({ example: 'clz1brandcuid' })
  @IsOptional() @IsString()
  brandId?: string

  @ApiPropertyOptional({ type: [ProjectCardDto], description: '동시 생성할 카드 (최대 5개)' })
  @IsOptional() @IsArray() @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ProjectCardDto)
  cards?: ProjectCardDto[]
}
