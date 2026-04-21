import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import * as jwt from 'jsonwebtoken'

// NextAuth v4 — Google OAuth 전용. 세션은 JWT 전략.
// 백엔드(NestJS)가 공유 NEXTAUTH_SECRET 으로 검증할 HS256 API 토큰을 session.apiToken 으로 노출.
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
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
      const secret = process.env.NEXTAUTH_SECRET
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
