import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'
import { ServeStaticModule } from '@nestjs/serve-static'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { join } from 'path'
import { PrismaModule } from './prisma/prisma.module'
import { HealthModule } from './health/health.module'
import { BrandsModule } from './brands/brands.module'
import { ProjectsModule } from './projects/projects.module'
import { CardsModule } from './cards/cards.module'
import { GenerateModule } from './generate/generate.module'
import { UploadModule } from './upload/upload.module'
import { BackgroundsModule } from './backgrounds/backgrounds.module'
import { ReelsModule } from './reels/reels.module'
import { ImagesModule } from './images/images.module'
import { KnowledgeModule } from './knowledge/knowledge.module'
import { GenerateNoteModule } from './generate-note/generate-note.module'
import { AuthModule } from './auth/auth.module'

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/',
    }),
    // IP 기반 rate limit — 기본 1분 60회. @Throttle 로 엔드포인트별 override.
    // (Railway 단일 프록시 IP 뒤라 IP 기준은 근사값 — 인증 도입 후 userId 키로 교체 권장)
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60_000, limit: 60 },
    ]),
    PrismaModule,
    AuthModule,
    HealthModule,
    BrandsModule,
    ProjectsModule,
    CardsModule,
    GenerateModule,
    UploadModule,
    BackgroundsModule,
    ReelsModule,
    ImagesModule,
    KnowledgeModule,
    GenerateNoteModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
