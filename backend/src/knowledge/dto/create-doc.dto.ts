import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator'

export class CreateDocDto {
  @ApiProperty({ example: 'clz_brand_id' })
  @IsString() @MinLength(1)
  brandId!: string

  @ApiProperty({ example: '유순 브랜드 소개서', maxLength: 200 })
  @IsString() @MinLength(1) @MaxLength(200)
  title!: string

  @ApiProperty({ enum: ['upload', 'url', 'note'], example: 'note' })
  @IsIn(['upload', 'url', 'note'])
  sourceType!: 'upload' | 'url' | 'note'

  @ApiPropertyOptional({ example: 'https://example.com/brand' })
  @IsOptional() @IsString() @MaxLength(2000)
  sourceUrl?: string

  @ApiProperty({
    example: '유순은 시니어·가족을 위한 따뜻한 케어 브랜드...',
    description: '원문 전체 텍스트 (최대 50,000자). 서버에서 자동 청킹됩니다.',
    maxLength: 50000,
  })
  @IsString() @MaxLength(50000)
  contentText!: string
}
