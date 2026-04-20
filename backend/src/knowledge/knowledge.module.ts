import { Module } from '@nestjs/common'
import { KnowledgeDocsController } from './docs.controller'
import { KnowledgeImagesController } from './images.controller'
import { RecommendController } from './recommend.controller'

@Module({
  controllers: [KnowledgeDocsController, KnowledgeImagesController, RecommendController],
})
export class KnowledgeModule {}
