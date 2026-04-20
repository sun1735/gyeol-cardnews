import { BadRequestException, Body, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { join } from 'path'
import { mkdirSync } from 'fs'

// MVP: 로컬 디스크 저장. S3 로 전환 시 이 파일의 `diskStorage` 를 S3 스토리지 엔진(예: multer-s3)
// 으로 교체하고 반환 URL 만 외부 접근 가능 URL로 바꾸면 된다. (스키마 변경 없음)
const uploadDir = join(process.cwd(), 'public', 'uploads')
mkdirSync(uploadDir, { recursive: true })

// 업로드 이미지 권리 고지 — 응답과 로그에 함께 반환하여 프론트 UI 에 노출.
const RIGHTS_NOTICE =
  '업로드한 이미지는 본인이 저작권을 보유하거나 사용 권한을 확보한 이미지여야 합니다. ' +
  '제3자의 초상권·저작권 침해가 발생할 경우 책임은 업로더에게 있습니다.'
const RIGHTS_NOTICE_VERSION = '2026-04-20'

@Controller('api/upload')
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadDir,
        filename: (_req, file, cb) => {
          const ext =
            (file.originalname.split('.').pop() || 'png')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '') || 'png'
          cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`)
        },
      }),
      limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('consent') consentRaw?: string,
  ) {
    if (!file) throw new BadRequestException('file required')
    const consented = consentRaw === 'true' || consentRaw === '1' || consentRaw === 'on'
    if (!consented) {
      throw new BadRequestException(
        '업로드 권리 동의가 필요합니다 (폼 필드 consent=true). ' + RIGHTS_NOTICE,
      )
    }
    return {
      url: `/uploads/${file.filename}`,
      rightsNotice: RIGHTS_NOTICE,
      rightsNoticeVersion: RIGHTS_NOTICE_VERSION,
    }
  }
}
