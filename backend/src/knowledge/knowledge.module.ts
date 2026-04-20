import { Module } from '@nestjs/common'
import { KnowledgeDocsController } from './docs.controller'
import { KnowledgeImagesController } from './images.controller'

@Module({
  controllers: [KnowledgeDocsController, KnowledgeImagesController],
})
export class KnowledgeModule {}
