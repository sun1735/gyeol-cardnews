import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'

// 관리자 전용 가드. AuthGuard 가 req.user 를 채운 뒤 동작.
// req.user.role === 'admin' 이어야 통과. 그 외 403.
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest()
    const user = req.user
    if (!user) throw new UnauthorizedException('로그인이 필요합니다')
    if (user.role !== 'admin') throw new ForbiddenException('관리자 권한이 필요합니다')
    return true
  }
}
