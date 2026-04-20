import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { diskStorage } from 'multer'
import { join } from 'path'
import { mkdirSync } from 'fs'

// MVP: 로컬 디스크 저장. S3 로 전환 시 이 파일의 `diskStorage` 를 S3 스토리지 엔진(예: multer-s3)
// 으로 교체하고 반환 URL 만 외부 접근 가능 URL로 바꾸면 된다. (스키마 변경 없음)
const uploadDir = join(process.cwd(), 'public', 'uploads')
mkdirSync(uploadDir, { recursive: true })

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
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('file required')
    return { url: `/uploads/${file.filename}` }
  }
}
