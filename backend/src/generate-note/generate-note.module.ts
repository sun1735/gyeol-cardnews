import { Module } from '@nestjs/common'
import { GenerateNoteController } from './generate-note.controller'
import { GenerateNoteService } from './generate-note.service'
import { Orchestrator } from './orchestrator'
import { KnowledgeSearchService } from './knowledge-search.service'
import { ImageRankerService } from './image-ranker.service'

@Module({
  controllers: [GenerateNoteController],
  providers: [GenerateNoteService, Orchestrator, KnowledgeSearchService, ImageRankerService],
})
export class GenerateNoteModule {}
