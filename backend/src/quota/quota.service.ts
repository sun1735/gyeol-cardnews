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
  // 관리자(role='admin') 는 한도 무시 — 사용량은 계속 기록해 분석용 데이터만 남김.
  async checkAndIncrement(
    user: AuthUser | null | undefined,
    action: QuotaAction,
  ): Promise<{ plan: PlanKey; current: number; limit: number }> {
    if (!user) return { plan: 'free', current: 0, limit: 0 }

    const isAdmin = user.role === 'admin'
    const plan = await this.getUserPlan(user.id)
    const limit = PLAN_LIMITS[plan][action] as number
    const yearMonth = currentYearMonth()

    // 한 달치 카운터 조회(없으면 0)
    const counter = await this.prisma.usageCounter.findUnique({
      where: { userId_yearMonth: { userId: user.id, yearMonth } },
    })
    const currentCount = counter ? counter[fieldForAction(action)] : 0

    // imageGen 은 크레딧 팩으로도 보충 가능. 플랜 한도 소진 후 크레딧 잔량이 있으면 크레딧에서 차감.
    const isImage = action === 'imageGen'
    if (!isAdmin && currentCount >= limit) {
      if (isImage) {
        const pack = await this.findActiveCreditPack(user.id)
        if (pack) {
          // 크레딧 1 소진 — usageCounter 는 증가하지 않음 (플랜 한도 보호)
          await this.prisma.creditPack.update({
            where: { id: pack.id },
            data: { creditsUsed: { increment: 1 } },
          })
          return { plan, current: currentCount, limit }
        }
      }
      throw new HttpException(
        {
          message: `이번 달 ${labelFor(action)} 한도(${limit}회)에 도달했습니다. 플랜 업그레이드 또는 1회권 구매로 이용하세요.`,
          action,
          current: currentCount,
          limit,
          plan,
        },
        HttpStatus.PAYMENT_REQUIRED,
      )
    }

    // upsert + 증가 (관리자도 기록은 함 — 사용량 분석)
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

    // 관리자 응답의 limit 은 -1(무제한) 로 표기 — 프런트 UI 에서 "∞" 로 표시.
    return { plan, current: currentCount + 1, limit: isAdmin ? -1 : limit }
  }

  // 남은 크레딧(이미지) 합계 — 만료 전·미소진 팩들만 카운트.
  async getCreditBalance(userId: string): Promise<{ remaining: number; packs: number }> {
    const now = new Date()
    const packs = await this.prisma.creditPack.findMany({
      where: {
        userId,
        expiresAt: { gt: now },
      },
      select: { creditsTotal: true, creditsUsed: true },
    })
    const remaining = packs.reduce(
      (acc, p) => acc + Math.max(0, p.creditsTotal - p.creditsUsed),
      0,
    )
    return { remaining, packs: packs.length }
  }

  // 가장 먼저 만료될 유효 팩부터 소진 (FIFO by expiresAt).
  private async findActiveCreditPack(userId: string) {
    const now = new Date()
    return this.prisma.creditPack.findFirst({
      where: {
        userId,
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'asc' },
      // creditsUsed < creditsTotal 필터: Prisma 는 두 컬럼 비교 직접 지원 안 해서 findMany 후 필터가 안전하나,
      // 단일 로우만 필요하므로 raw 없이 findFirst 후 코드에서 체크.
    }).then((pack) => (pack && pack.creditsUsed < pack.creditsTotal ? pack : null))
  }

  // 프런트 사용량 메터용 현재값 조회. 관리자면 isUnlimited=true 로 UI 가 ∞ 표시.
  async getUsage(userId: string): Promise<{
    plan: PlanKey
    role: string
    isUnlimited: boolean
    limits: typeof PLAN_LIMITS.free
    counts: {
      imageGen: number
      textGen: number
      ragJob: number
      ideaGen: number
    }
    credits: { remaining: number; packs: number }
    yearMonth: string
  }> {
    const plan = await this.getUserPlan(userId)
    const yearMonth = currentYearMonth()
    const [counter, credits, roleRow] = await Promise.all([
      this.prisma.usageCounter.findUnique({
        where: { userId_yearMonth: { userId, yearMonth } },
      }),
      this.getCreditBalance(userId),
      this.prisma.user.findUnique({ where: { id: userId }, select: { role: true } }),
    ])
    const role = roleRow?.role ?? 'user'
    return {
      plan,
      role,
      isUnlimited: role === 'admin',
      limits: PLAN_LIMITS[plan],
      counts: {
        imageGen: counter?.imageGenCount ?? 0,
        textGen: counter?.textGenCount ?? 0,
        ragJob: counter?.ragJobCount ?? 0,
        ideaGen: counter?.ideaGenCount ?? 0,
      },
      credits,
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
