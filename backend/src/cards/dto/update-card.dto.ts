import { ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator'

export class UpdateCardDto {
  @ApiPropertyOptional({ example: '영양 식단', description: '카드 제목 (최대 120자)' })
  @IsOptional() @IsString() @MaxLength(120)
  title?: string

  @ApiPropertyOptional({
    example: '영양사가 함께 설계한 부드럽고 균형 잡힌 식사를 준비합니다.',
    description: '카드 본문 (최대 1000자)',
  })
  @IsOptional() @IsString() @MaxLength(1000)
  body?: string

  @ApiPropertyOptional({ example: '영양사 설계', description: '보조 텍스트 (최대 200자)' })
  @IsOptional() @IsString() @MaxLength(200)
  subtext?: string

  @ApiPropertyOptional({ example: '자세히 보기 →', description: 'Call-to-action (최대 60자)' })
  @IsOptional() @IsString() @MaxLength(60)
  cta?: string

  @ApiPropertyOptional({
    example: '/uploads/abc123.png',
    nullable: true,
    description: 'null 또는 빈 문자열 전송 시 이미지 제거',
  })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsString()
  imageUrl?: string | null

  @ApiPropertyOptional({ enum: ['cover', 'content', 'cta'], example: 'content' })
  @IsOptional() @IsIn(['cover', 'content', 'cta'])
  layout?: 'cover' | 'content' | 'cta'

  @ApiPropertyOptional({ example: 2, minimum: 0, description: '카드 순서 (0-based)' })
  @IsOptional() @IsInt() @Min(0)
  order?: number
}
