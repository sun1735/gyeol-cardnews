import { Injectable, Logger } from '@nestjs/common'
import * as jwt from 'jsonwebtoken'
import { PrismaService } from '../prisma/prisma.service'

export interface AuthUser {
  id: string
  email: string
  name?: string
  role?: string
}

// 프런트(auth-options.ts) 와 반드시 동일해야 하는 fallback secret.
// NEXTAUTH_SECRET 환경변수가 우선이지만 미설정 시 이 값으로 양쪽이 일치.
export const FALLBACK_AUTH_SECRET = 'note2card-dev-secret-change-in-production'

// 관리자 이메일 — 코드 레벨 고정 목록 + ADMIN_EMAILS 환경변수 병합.
// 해당 이메일로 로그인하는 유저는 auth 검증 시마다 자동 role='admin' 승격.
const HARDCODED_ADMIN_EMAILS = ['sun17351735@gmail.com']

function isAdminEmail(email: string): boolean {
  const envList = (process.env.ADMIN_EMAILS ?? '')
    .split(/[,\s]+/)
    .filter(Boolean)
  const all = [...HARDCODED_ADMIN_EMAILS, ...envList].map((s) => s.toLowerCase())
  return all.includes(email.toLowerCase())
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('AuthService')
  constructor(private prisma: PrismaService) {}

  // NextAuth v4 가 서명한 JWT 를 검증하고 User DB 레코드(없으면 생성)를 반환.
  // 프런트와 동일한 NEXTAUTH_SECRET 을 공유. 환경변수 없으면 코드 레벨 fallback 사용.
  async verifyAndUpsert(token: string): Promise<AuthUser | null> {
    const secret = process.env.NEXTAUTH_SECRET?.trim() || FALLBACK_AUTH_SECRET
    try {
      // NextAuth v4 기본은 HS256 이 아닌 A256GCM 암호화 JWT. 그러나 간단한 공유시엔 signIn callback 에서
      // HS256 JWT 을 별도 발급해 프론트가 Authorization 에 실어 보내는 방식이 안정적.
      // 여기서는 HS256 JWT 를 기대한다 (프론트 /api/auth/token 엔드포인트가 발급).
      const payload = jwt.verify(token, secret, { algorithms: ['HS256'] }) as jwt.JwtPayload
      const email = typeof payload.email === 'string' ? payload.email : null
      if (!email) return null
      const name = typeof payload.name === 'string' ? payload.name : ''
      const picture = typeof payload.picture === 'string' ? payload.picture : ''
      // upsert (이메일 기준)
      const shouldBeAdmin = isAdminEmail(email)
      const user = await this.prisma.user.upsert({
        where: { email },
        update: {
          name,
          imageUrl: picture,
          ...(shouldBeAdmin ? { role: 'admin' } : {}),
        },
        create: {
          email,
          name,
          imageUrl: picture,
          role: shouldBeAdmin ? 'admin' : 'user',
        },
      })
      return { id: user.id, email: user.email, name: user.name, role: user.role }
    } catch (e: any) {
      this.logger.warn(`JWT 검증 실패: ${e?.message ?? e}`)
      return null
    }
  }
}
