import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import * as jwt from 'jsonwebtoken'

// NextAuth v4 — Google OAuth 전용. 세션은 JWT 전략.
// 백엔드(NestJS)가 공유 NEXTAUTH_SECRET 으로 검증할 HS256 API 토큰을 session.apiToken 으로 노출.
const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
const authSecret =
  process.env.NEXTAUTH_SECRET?.trim() ||
  process.env.AUTH_SECRET?.trim() ||
  // 운영에서는 반드시 환경변수로 교체 권장. (누락 시 세션 엔드포인트 500 방지용)
  'note2card-dev-secret-change-in-production'

const providers = []
if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  )
} else {
  // OAuth 설정이 비어 있어도 /api/auth/session 이 500 나지 않도록 안전한 더미 provider를 둔다.
  providers.push(
    CredentialsProvider({
      id: 'disabled',
      name: 'Login disabled',
      credentials: {},
      async authorize() {
        return null
      },
    }),
  )
}

export const authOptions: NextAuthOptions = {
  providers,
  secret: authSecret,
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  callbacks: {
    async jwt({ token, profile }) {
      if (profile) {
        const p = profile as { email?: string; name?: string; picture?: string }
        if (p.email) token.email = p.email
        if (p.name) token.name = p.name
        if (p.picture) token.picture = p.picture
      }
      return token
    },
    async session({ session, token }) {
      const secret = authSecret
      if (secret && token.email) {
        const apiToken = jwt.sign(
          {
            email: token.email,
            name: token.name ?? '',
            picture: token.picture ?? '',
          },
          secret,
          { algorithm: 'HS256', expiresIn: '7d' },
        )
        ;(session as any).apiToken = apiToken
      }
      return session
    },
  },
}
