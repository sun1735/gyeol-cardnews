import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { AdminGuard } from '../auth/admin.guard'

// 관리자 전용 엔드포인트. AuthGuard + AdminGuard 로 보호.
// 기본 통계, 유저 목록, 브랜드 목록, 플랜·역할 수동 조정.

interface UpdateUserDto {
  role?: 'user' | 'admin'
  plan?: 'free' | 'pro' | 'team'
}

@UseGuards(AdminGuard)
@Controller('api/admin')
export class AdminController {
  constructor(private prisma: PrismaService) {}

  // 대시보드 요약 — 유저/브랜드/생성잡/사용량 합계.
  @Get('stats')
  async stats() {
    const now = new Date()
    const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
    const [users, brands, jobs, counters, recentJobs] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.brandProfile.count(),
      this.prisma.generationJob.count(),
      this.prisma.usageCounter.aggregate({
        where: { yearMonth: ym },
        _sum: { imageGenCount: true, textGenCount: true, ragJobCount: true, ideaGenCount: true },
      }),
      this.prisma.generationJob.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ])
    const planBreakdown = await this.prisma.user.groupBy({
      by: ['plan'],
      _count: { _all: true },
    })
    return {
      users,
      brands,
      jobs,
      month: ym,
      usageThisMonth: {
        imageGen: counters._sum.imageGenCount ?? 0,
        textGen: counters._sum.textGenCount ?? 0,
        ragJob: counters._sum.ragJobCount ?? 0,
        ideaGen: counters._sum.ideaGenCount ?? 0,
      },
      jobStatus: recentJobs.map((r) => ({ status: r.status, count: r._count._all })),
      planBreakdown: planBreakdown.map((r) => ({ plan: r.plan, count: r._count._all })),
    }
  }

  // 유저 목록. q 로 이메일·이름 LIKE 검색. 기본 100개.
  @Get('users')
  async users(
    @Query('q') q?: string,
    @Query('take') takeRaw?: string,
  ) {
    const take = Math.min(Math.max(Number(takeRaw) || 100, 1), 500)
    const where = q
      ? {
          OR: [
            { email: { contains: q, mode: 'insensitive' as const } },
            { name: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          plan: true,
          planStartedAt: true,
          planExpiresAt: true,
          createdAt: true,
          passwordHash: true,
          _count: { select: { brands: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ])
    return {
      total,
      items: items.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        plan: u.plan,
        planStartedAt: u.planStartedAt,
        planExpiresAt: u.planExpiresAt,
        createdAt: u.createdAt,
        authType: u.passwordHash ? 'email' : 'social',
        brandCount: u._count.brands,
      })),
    }
  }

  // 유저 역할/플랜 수정.
  @Patch('users/:id')
  async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const data: any = {}
    if (dto.role === 'user' || dto.role === 'admin') data.role = dto.role
    if (dto.plan === 'free' || dto.plan === 'pro' || dto.plan === 'team') {
      data.plan = dto.plan
      if (dto.plan === 'free') {
        data.planStartedAt = null
        data.planExpiresAt = null
      } else {
        data.planStartedAt = new Date()
        // 수동 지급: 30일 연장
        data.planExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      }
    }
    if (Object.keys(data).length === 0) {
      throw new HttpException('변경할 필드가 없습니다', HttpStatus.BAD_REQUEST)
    }
    const user = await this.prisma.user.update({ where: { id }, data })
    return { id: user.id, role: user.role, plan: user.plan }
  }

  // 유저 삭제 (연쇄: 브랜드·카운터·프로젝트 등).
  @Delete('users/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteUser(@Param('id') id: string) {
    await this.prisma.user.delete({ where: { id } })
  }

  // 전체 브랜드 목록 (소유자 포함).
  @Get('brands')
  async brands(@Query('take') takeRaw?: string) {
    const take = Math.min(Math.max(Number(takeRaw) || 200, 1), 500)
    const items = await this.prisma.brandProfile.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        tone: true,
        primaryColor: true,
        createdAt: true,
        ownerId: true,
        owner: { select: { email: true, name: true } },
      },
    })
    return { items }
  }

  // 최근 생성 잡 — 상태 모니터링.
  @Get('jobs')
  async jobs(@Query('take') takeRaw?: string) {
    const take = Math.min(Math.max(Number(takeRaw) || 50, 1), 200)
    const items = await this.prisma.generationJob.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        brandId: true,
        mode: true,
        status: true,
        progress: true,
        errorMessage: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return { items }
  }
}
