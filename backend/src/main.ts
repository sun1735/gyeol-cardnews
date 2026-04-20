import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { mkdirSync } from 'fs'
import { join } from 'path'
import { json, urlencoded } from 'express'
import { AppModule } from './app.module'

async function bootstrap() {
  // 업로드 디렉터리 선생성 — serve-static 이 루트를 가리키므로 없어도 기동은 되지만,
  // 첫 업로드까지 404 가 나지 않도록 미리 만들어 둔다.
  mkdirSync(join(process.cwd(), 'public', 'uploads'), { recursive: true })

  // bodyParser: false 로 기본을 끄고, 릴스 base64 PNG 를 담을 수 있도록 50mb 로 올린다.
  const app = await NestFactory.create(AppModule, { cors: true, bodyParser: false })
  app.use(json({ limit: '50mb' }))
  app.use(urlencoded({ extended: true, limit: '50mb' }))

  // 전역 검증 파이프 — DTO 기반 검증 + 알 수 없는 필드 제거 + 타입 변환
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // Swagger UI — /docs
  const config = new DocumentBuilder()
    .setTitle('결 · 카드뉴스 API')
    .setDescription('단계 3 API 1차 · 프로젝트 CRUD + 카드 업데이트 + 카드 자동 생성')
    .setVersion('0.1.0')
    .build()
  const document = SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('docs', app, document)

  const port = Number(process.env.PORT ?? 4000)
  await app.listen(port, '0.0.0.0')
  console.log(`[backend] listening on :${port}`)
  console.log(`[backend] Swagger UI  :${port}/docs`)
}

bootstrap()
