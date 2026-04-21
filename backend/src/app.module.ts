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

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
      serveRoot: '/',
    }),
    // IP 기반 rate limit — 비용/악용 방어. 다중 버킷 설정:
    //  short: 1초 10회  (버스트 방지)
    //  medium: 1분 60회 (일반 API)
    //  long: 1시간 500회 (장기 악용 방어)
    // 개별 엔드포인트는 @Throttle 데코레이터로 override (이미지 생성·아이디어 추천 등 유료 API)
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 60_000, limit: 60 },
      { name: 'long', ttl: 3_600_000, limit: 500 },
    ]),
    PrismaModule,
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
