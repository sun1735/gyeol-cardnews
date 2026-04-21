import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  createParamDecorator,
  SetMetadata,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthService, AuthUser } from './auth.service'

export const IS_PUBLIC_KEY = 'isPublic'
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true)

export const CurrentUser = createParamDecorator(
  (_, ctx: ExecutionContext): AuthUser | null => {
    const req = ctx.switchToHttp().getRequest()
    return req.user ?? null
  },
)

// 전역 가드로 등록. 기본은 opt-in — `AUTH_MODE=enabled` 일 때만 인증을 강제한다.
// 그 외(미설정 또는 'disabled')에서는 토큰이 있으면 유저 upsert 해서 req.user 로 실어주되,
// 토큰이 없어도 통과시킨다. 마이그레이션 기간 안전.
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (isPublic) return true

    const req = ctx.switchToHttp().getRequest()
    const header: string | undefined = req.headers?.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null
    const enforced = process.env.AUTH_MODE === 'enabled'

    if (!token) {
      if (enforced) throw new UnauthorizedException('로그인이 필요합니다')
      return true
    }

    const user = await this.auth.verifyAndUpsert(token)
    if (!user) {
      if (enforced) throw new UnauthorizedException('유효하지 않은 토큰')
      return true
    }
    req.user = user
    return true
  }
}
