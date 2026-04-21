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

// 전역 가드로 등록 — 모든 요청에서 Authorization: Bearer <JWT> 를 검증한다.
// @Public() 데코레이터가 달린 핸들러는 통과시키고, 그 외는 인증 실패 시 401.
// AUTH_MODE=disabled 환경변수가 설정되면 전체 공개(개발·마이그레이션 기간).
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    // 인증 비활성 모드 — 기존 유저 보호 전에 테스트용
    if (process.env.AUTH_MODE === 'disabled') return true

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (isPublic) return true

    const req = ctx.switchToHttp().getRequest()
    const header: string | undefined = req.headers?.authorization
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) throw new UnauthorizedException('로그인이 필요합니다')

    const user = await this.auth.verifyAndUpsert(token)
    if (!user) throw new UnauthorizedException('유효하지 않은 토큰')
    req.user = user
    return true
  }
}
