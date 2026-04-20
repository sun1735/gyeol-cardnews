import { Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { GenerateFromNoteDto } from './dto/generate-from-note.dto'
import { Orchestrator } from './orchestrator'

// in-process 비동기 잡 실행기. 단일 인스턴스 MVP 전제.
// 부팅 시 running 상태 행은 좀비이므로 failed 로 되돌린다.
// 멀티 인스턴스·다운타임 복구가 필요해지면 BullMQ 등으로 교체.

@Injectable()
export class GenerateNoteService implements OnModuleInit {
  private readonly logger = new Logger('GenerateNoteService')

  constructor(
    private prisma: PrismaService,
    private orchestrator: Orchestrator,
  ) {}

  async onModuleInit(): Promise<void> {
    const zombies = await this.prisma.generationJob.updateMany({
      where: { status: 'running' },
      data: {
        status: 'failed',
        errorMessage: '백엔드 재시작으로 중단됨 — 다시 시도해 주세요',
      },
    })
    if (zombies.count > 0) {
      this.logger.warn(`좀비 잡 ${zombies.count} 건을 failed 로 복구`)
    }
  }

  async enqueue(dto: GenerateFromNoteDto): Promise<{ jobId: string; status: string }> {
    const brand = await this.prisma.brandProfile.findUnique({ where: { id: dto.brandId } })
    if (!brand) throw new NotFoundException('brandId 가 유효하지 않습니다')

    const job = await this.prisma.generationJob.create({
      data: {
        brandId: dto.brandId,
        mode: 'note_rag',
        status: 'queued',
        progress: 0,
        requestJson: JSON.stringify(dto),
      },
    })
    // 응답 반환 후 비동기 처리 — 호출자를 블록하지 않는다.
    setImmediate(() => this.processJob(job.id).catch((e) => {
      this.logger.error(`processJob 미처리 예외 (${job.id}): ${e?.message ?? e}`)
    }))
    return { jobId: job.id, status: job.status }
  }

  async getJob(id: string) {
    const job = await this.prisma.generationJob.findUnique({ where: { id } })
    if (!job) throw new NotFoundException('job 을 찾을 수 없습니다')
    const body: Record<string, unknown> = {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }
    if (job.errorMessage) body.errorMessage = job.errorMessage
    if (job.status === 'done' || job.status === 'partial') {
      try {
        const parsed = job.resultJson ? JSON.parse(job.resultJson) : null
        if (parsed) Object.assign(body, parsed)
      } catch {
        body.errorMessage = (body.errorMessage as string) ?? 'resultJson 파싱 실패'
      }
    }
    return body
  }

  // 실제 오케스트레이션. 실패 시 상태 전이를 보장한다.
  private async processJob(jobId: string): Promise<void> {
    await this.setRunning(jobId, 5)
    const job = await this.prisma.generationJob.findUnique({ where: { id: jobId } })
    if (!job) return
    const dto: GenerateFromNoteDto = JSON.parse(job.requestJson)

    try {
      const { cards, meta, partial } = await this.orchestrator.run(dto, (p) => this.setRunning(jobId, p))
      await this.prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: partial ? 'partial' : 'done',
          progress: 100,
          resultJson: JSON.stringify({ cards, meta }),
        },
      })
    } catch (e: any) {
      this.logger.warn(`job ${jobId} 실패: ${e?.message ?? e}`)
      await this.prisma.generationJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errorMessage: (e?.message ?? '알 수 없는 오류').slice(0, 500),
        },
      })
    }
  }

  private async setRunning(jobId: string, progress: number): Promise<void> {
    try {
      await this.prisma.generationJob.update({
        where: { id: jobId },
        data: { status: 'running', progress: Math.max(0, Math.min(100, Math.floor(progress))) },
      })
    } catch (e: any) {
      this.logger.warn(`progress 업데이트 실패 (${jobId}): ${e?.message ?? e}`)
    }
  }
}
