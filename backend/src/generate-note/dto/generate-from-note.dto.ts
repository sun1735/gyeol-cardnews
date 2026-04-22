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

  @ApiPropertyOptional({
    enum: ['basic', 'product-ad', 'promo'],
    example: 'basic',
    description: '카드 템플릿. product-ad 는 상품 광고용 구조화 필드(가격/스와치/features) 를 LLM 에 요구.',
  })
  @IsOptional() @IsIn(['basic', 'product-ad', 'promo'])
  template?: 'basic' | 'product-ad' | 'promo'
}
