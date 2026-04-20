import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
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

export class GenerateFromNoteDto {
  @ApiProperty({ example: 'clz_brand_id' })
  @IsString() @MinLength(1)
  brandId!: string

  @ApiProperty({
    example: '유순 제품 5월 1일부터 온라인 판매 시작. 인스타 피드 카드뉴스 6장',
    maxLength: 2000,
  })
  @IsString() @MinLength(1) @MaxLength(2000)
  prompt!: string

  @ApiProperty({ example: 6, minimum: 1, maximum: 10 })
  @IsInt() @Min(1) @Max(10)
  count!: number

  @ApiPropertyOptional({ type: [String], example: ['/uploads/ref.png'], description: '공통 참조 이미지 1~3장 (선택)' })
  @IsOptional() @IsArray() @ArrayMaxSize(3)
  @IsString({ each: true })
  baseImageUrls?: string[]

  @ApiPropertyOptional({ enum: ['1:1', '4:5', '9:16'], example: '1:1' })
  @IsOptional() @IsIn(['1:1', '4:5', '9:16'])
  sizePreset?: '1:1' | '4:5' | '9:16'
}
