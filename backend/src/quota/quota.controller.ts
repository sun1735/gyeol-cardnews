import { Controller, Get, UnauthorizedException } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentUser, Public } from '../auth/auth.guard'
import type { AuthUser } from '../auth/auth.service'
import { QuotaService } from './quota.service'
import { PLAN_LIMITS, PLAN_PRICE_KRW } from './plans'

@ApiTags('quota')
@Controller('api/quota')
export class QuotaController {
  constructor(private quota: QuotaService) {}

  @Get('me')
  @ApiOperation({ summary: '현재 로그인 유저의 플랜·한도·이번 달 사용량' })
  async me(@CurrentUser() user: AuthUser | null) {
    if (!user) throw new UnauthorizedException('로그인이 필요합니다')
    return this.quota.getUsage(user.id)
  }

  @Public()
  @Get('plans')
  @ApiOperation({ summary: '전체 플랜·가격·한도 카탈로그 (비로그인도 조회 가능)' })
  plans() {
    return {
      plans: (['free', 'pro', 'team'] as const).map((k) => ({
        key: k,
        price: PLAN_PRICE_KRW[k],
        limits: PLAN_LIMITS[k],
      })),
    }
  }
}
