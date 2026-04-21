import {
  BadRequestException,
  Body,
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { processAndStore } from './image-processor'

// 업로드 엔드포인트 — 메모리 버퍼로 받아 sharp 로 후처리.
// 반환 포맷은 해시 기반 파일명 + WebP 변환본 + 썸네일 + 메타데이터.
//
// Stage 2 (R2) 전환 시: processAndStore 내부의 writeFile 을 s3Client.putObject 로 교체만.
// DB 는 URL 문자열만 저장하므로 스키마 변경 불필요.

const MAX_BYTES = 15 * 1024 * 1024 // 15MB 원본 상한 (WebP 변환 후 실제 저장은 더 작음)
const ALLOWED_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
])

// 업로드 권리 고지 — 응답과 로그에 함께 반환하여 프론트 UI 에 노출.
const RIGHTS_NOTICE =
  '업로드한 이미지는 본인이 저작권을 보유하거나 사용 권한을 확보한 이미지여야 합니다. ' +
  '제3자의 초상권·저작권 침해가 발생할 경우 책임은 업로더에게 있습니다.'
const RIGHTS_NOTICE_VERSION = '2026-04-20'

@Controller('api/upload')
export class UploadController {
  private readonly logger = new Logger('UploadController')

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      // memoryStorage — 디스크에 쓰기 전 sharp 로 후처리하므로 버퍼 필요
      limits: { fileSize: MAX_BYTES },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('consent') consentRaw?: string,
  ) {
    if (!file) throw new BadRequestException('file required')
    if (!file.buffer) throw new BadRequestException('file buffer 누락 (메모리 업로드 필요)')
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      throw new BadRequestException(
        `허용되지 않는 포맷: ${file.mimetype}. JPG/PNG/WebP/GIF/SVG 만 가능합니다.`,
      )
    }
    const consented = consentRaw === 'true' || consentRaw === '1' || consentRaw === 'on'
    if (!consented) {
      throw new BadRequestException(
        '업로드 권리 동의가 필요합니다 (폼 필드 consent=true). ' + RIGHTS_NOTICE,
      )
    }

    try {
      const processed = await processAndStore(file.buffer, file.originalname)
      return {
        ...processed,
        originalMimeType: file.mimetype,
        originalSizeBytes: file.size,
        rightsNotice: RIGHTS_NOTICE,
        rightsNoticeVersion: RIGHTS_NOTICE_VERSION,
      }
    } catch (e: any) {
      this.logger.warn(`이미지 처리 실패: ${e?.message ?? e}`)
      throw new BadRequestException(`이미지 처리 실패: ${e?.message ?? '알 수 없는 오류'}`)
    }
  }
}
