import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
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

  @ApiProperty({ example: '/uploads/1711111111-abcd.png' })
  @IsString() @MinLength(1) @MaxLength(1000)
  url!: string

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
}
