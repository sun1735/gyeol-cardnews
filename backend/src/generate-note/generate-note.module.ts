import { Module } from '@nestjs/common'
import { GenerateNoteController } from './generate-note.controller'
import { GenerateNoteService } from './generate-note.service'
import { Orchestrator } from './orchestrator'

@Module({
  controllers: [GenerateNoteController],
  providers: [GenerateNoteService, Orchestrator],
})
export class GenerateNoteModule {}
