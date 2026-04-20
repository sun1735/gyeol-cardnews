import { Controller, Get } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Controller('health')
export class HealthController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async check() {
    let db: 'ok' | 'error' = 'error'
    try {
      await this.prisma.$queryRaw`SELECT 1`
      db = 'ok'
    } catch {
      db = 'error'
    }
    return {
      status: db === 'ok' ? 'ok' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    }
  }
}
