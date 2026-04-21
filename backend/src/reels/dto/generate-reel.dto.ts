import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator'

export class GenerateReelDto {
  @ApiProperty({
    description:
      '카드 프레임 (2~10장). 각 항목은 `data:image/png;base64,...` 또는 순수 base64 이미지 문자열.',
    type: [String],
    example: ['data:image/png;base64,iVBORw0KGgo...'],
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @IsString({ each: true })
  frames: string[]

  @ApiProperty({
    enum: ['fade', 'slide', 'zoom'],
    example: 'fade',
    description: '전환 효과 (xfade)',
  })
  @IsIn(['fade', 'slide', 'zoom'])
  transition: 'fade' | 'slide' | 'zoom'

  @ApiProperty({
    example: 3,
    minimum: 1.5,
    maximum: 6,
    description: '카드당 표시 시간(초). 총 재생 = count × duration − (count−1) × 0.5s',
  })
  @IsNumber()
  @Min(1.5)
  @Max(6)
  durationPerCard: number

  @ApiPropertyOptional({ example: '유순', description: '파일명에 사용할 브랜드명 (미지정 시 "결")' })
  @IsOptional()
  @IsString()
  brandName?: string
}
