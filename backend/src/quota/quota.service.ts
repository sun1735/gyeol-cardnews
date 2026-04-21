import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { AuthUser } from '../auth/auth.service'
import { normalizePlan, PLAN_LIMITS, PlanKey } from './plans'

export type QuotaAction = 'imageGen' | 'textGen' | 'ragJob' | 'ideaGen'

const COUNTER_FIELD: Record<QuotaAction, keyof typeof PLAN_LIMITS.free> = {
  imageGen: 'imageGen',
  textGen: 'textGen',
  ragJob: 'ragJob',
  ideaGen: 'ideaGen',
}

@Injectable()
export class QuotaService {
  private readonly logger = new Logger('QuotaService')
  constructor(private prisma: PrismaService) {}

  // 액션 수행 전 호출. 한도 초과 시 402 Payment Required throw.
  // user 가 null 이면(비로그인) 통과 — AUTH_MODE off 에서 레거시 호환.
  async checkAndIncrement(
    user: AuthUser | null | undefined,
    action: QuotaAction,
  ): Promise<{ plan: PlanKey; current: number; limit: number }> {
    if (!user) return { plan: 'free', current: 0, limit: 0 }

    const plan = await this.getUserPlan(user.id)
    const limit = PLAN_LIMITS[plan][action] as number
    const yearMonth = currentYearMonth()

    // 한 달치 카운터 조회(없으면 0)
    const counter = await this.prisma.usageCounter.findUnique({
      where: { userId_yearMonth: { userId: user.id, yearMonth } },
    })
    const currentCount = counter ? counter[fieldForAction(action)] : 0
    if (currentCount >= limit) {
      throw new HttpException(
        {
          message: `이번 달 ${labelFor(action)} 한도(${limit}회)에 도달했습니다. 플랜을 업그레이드해 주세요.`,
          action,
          current: currentCount,
          limit,
          plan,
        },
        HttpStatus.PAYMENT_REQUIRED,
      )
    }

    // upsert + 증가
    await this.prisma.usageCounter.upsert({
      where: { userId_yearMonth: { userId: user.id, yearMonth } },
      create: {
        userId: user.id,
        yearMonth,
        [fieldForAction(action)]: 1,
      },
      update: {
        [fieldForAction(action)]: { increment: 1 },
      },
    })

    return { plan, current: currentCount + 1, limit }
  }

  // 프런트 사용량 메터용 현재값 조회
  async getUsage(userId: string): Promise<{
    plan: PlanKey
    limits: typeof PLAN_LIMITS.free
    counts: {
      imageGen: number
      textGen: number
      ragJob: number
      ideaGen: number
    }
    yearMonth: string
  }> {
    const plan = await this.getUserPlan(userId)
    const yearMonth = currentYearMonth()
    const counter = await this.prisma.usageCounter.findUnique({
      where: { userId_yearMonth: { userId, yearMonth } },
    })
    return {
      plan,
      limits: PLAN_LIMITS[plan],
      counts: {
        imageGen: counter?.imageGenCount ?? 0,
        textGen: counter?.textGenCount ?? 0,
        ragJob: counter?.ragJobCount ?? 0,
        ideaGen: counter?.ideaGenCount ?? 0,
      },
      yearMonth,
    }
  }

  private async getUserPlan(userId: string): Promise<PlanKey> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { plan: true, planExpiresAt: true },
    })
    if (!user) return 'free'
    // 만료 지난 유료 플랜은 free 로 간주 (결제 갱신 실패 시)
    if (
      user.planExpiresAt &&
      user.planExpiresAt.getTime() < Date.now() &&
      user.plan !== 'free'
    ) {
      this.logger.warn(`User ${userId} plan expired — downgrading to free`)
      return 'free'
    }
    return normalizePlan(user.plan)
  }
}

function currentYearMonth(): string {
  const d = new Date()
  const y = d.getUTCFullYear()
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function fieldForAction(a: QuotaAction): 'imageGenCount' | 'textGenCount' | 'ragJobCount' | 'ideaGenCount' {
  return (a + 'Count') as any
}

function labelFor(a: QuotaAction): string {
  switch (a) {
    case 'imageGen':
      return 'AI 이미지 생성·편집'
    case 'textGen':
      return '텍스트 카드 생성'
    case 'ragJob':
      return '지식노트 기반 생성'
    case 'ideaGen':
      return '아이디어 추천'
  }
}
