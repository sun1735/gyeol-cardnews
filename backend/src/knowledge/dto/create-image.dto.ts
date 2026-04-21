import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator'

export class CreateImageDto {
  @ApiProperty({ example: 'clz_brand_id' })
  @IsString() @MinLength(1)
  brandId!: string

  @ApiProperty({ example: '/uploads/abc.webp' })
  @IsString() @MinLength(1) @MaxLength(1000)
  url!: string

  @ApiPropertyOptional({ example: '/uploads/abc-t.webp', description: '512px 썸네일 URL' })
  @IsOptional() @IsString() @MaxLength(1000)
  thumbnailUrl?: string

  @ApiPropertyOptional({ example: '유순 제품 메인컷', maxLength: 200 })
  @IsOptional() @IsString() @MaxLength(200)
  label?: string

  @ApiPropertyOptional({ example: ['제품', '화이트배경', '패키지정면'], type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(30)
  @IsString({ each: true })
  tags?: string[]

  @ApiPropertyOptional({ enum: ['owned', 'licensed', 'unknown'], example: 'owned' })
  @IsOptional() @IsIn(['owned', 'licensed', 'unknown'])
  usageRights?: 'owned' | 'licensed' | 'unknown'

  @ApiPropertyOptional({ example: 0.92, minimum: 0, maximum: 1 })
  @IsOptional() @IsNumber() @Min(0) @Max(1)
  qualityScore?: number

  // sharp 가 추출한 메타데이터 (업로드 응답 그대로 전달)
  @ApiPropertyOptional({ example: 1080 })
  @IsOptional() @IsInt() @Min(0) @Max(10000)
  width?: number

  @ApiPropertyOptional({ example: 1350 })
  @IsOptional() @IsInt() @Min(0) @Max(10000)
  height?: number

  @ApiPropertyOptional({ example: 125432 })
  @IsOptional() @IsInt() @Min(0)
  sizeBytes?: number

  @ApiPropertyOptional({ example: 'image/webp' })
  @IsOptional() @IsString() @MaxLength(50)
  mimeType?: string

  @ApiPropertyOptional({ example: 'a1b2c3...' })
  @IsOptional() @IsString() @MaxLength(128)
  sha256?: string
}
