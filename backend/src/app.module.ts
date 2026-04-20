import { Module } from '@nestjs/common'
import { ServeStaticModule } from '@nestjs/serve-static'
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
})
export class AppModule {}
