import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import KakaoProvider from 'next-auth/providers/kakao'
import NaverProvider from 'next-auth/providers/naver'
import CredentialsProvider from 'next-auth/providers/credentials'
import * as jwt from 'jsonwebtoken'

// NextAuth v4 — Google·Kakao·Naver 간편 로그인 + 이메일·비밀번호.
// 세션은 JWT 전략. 백엔드(NestJS) 가 공유 NEXTAUTH_SECRET 으로 검증할 HS256 API 토큰을
// session.apiToken 으로 노출.

const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:4000'

const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim()
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
const kakaoClientId = process.env.KAKAO_CLIENT_ID?.trim()
const kakaoClientSecret = process.env.KAKAO_CLIENT_SECRET?.trim()
const naverClientId = process.env.NAVER_CLIENT_ID?.trim()
const naverClientSecret = process.env.NAVER_CLIENT_SECRET?.trim()

const authSecret =
  process.env.NEXTAUTH_SECRET?.trim() ||
  process.env.AUTH_SECRET?.trim() ||
  // 운영에서는 반드시 환경변수로 교체 권장. (누락 시 세션 엔드포인트 500 방지용)
  'note2card-dev-secret-change-in-production'

const providers: NextAuthOptions['providers'] = []

// 이메일·비밀번호 로그인은 항상 활성화. 검증은 백엔드 /api/auth/verify 로 위임.
providers.push(
  CredentialsProvider({
    id: 'credentials',
    name: '이메일 로그인',
    credentials: {
      email: { label: '이메일', type: 'email' },
      password: { label: '비밀번호', type: 'password' },
    },
    async authorize(credentials) {
      const email = credentials?.email?.trim().toLowerCase()
      const password = credentials?.password
      if (!email || !password) return null
      try {
        const resp = await fetch(`${API_ORIGIN}/api/account/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        })
        if (!resp.ok) return null
        const user = await resp.json()
        return {
          id: user.id,
          email: user.email,
          name: user.name || '',
          image: user.image || '',
          role: user.role || 'user',
        } as any
      } catch {
        return null
      }
    },
  }),
)
if (googleClientId && googleClientSecret) {
  providers.push(
    GoogleProvider({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
    }),
  )
}
if (kakaoClientId && kakaoClientSecret) {
  providers.push(
    KakaoProvider({
      clientId: kakaoClientId,
      clientSecret: kakaoClientSecret,
    }),
  )
}
if (naverClientId && naverClientSecret) {
  providers.push(
    NaverProvider({
      clientId: naverClientId,
      clientSecret: naverClientSecret,
    }),
  )
}
export const authOptions: NextAuthOptions = {
  providers,
  secret: authSecret,
  session: { strategy: 'jwt' },
  pages: { signIn: '/signin' },
  callbacks: {
    // 각 provider 의 profile 구조가 달라서 email/name/picture 를 일관되게 token 에 올린다.
    async jwt({ token, profile, account, user }) {
      if (profile && account) {
        const email = extractEmail(profile, account.provider)
        const name = extractName(profile, account.provider)
        const picture = extractPicture(profile, account.provider)
        if (email) token.email = email
        if (name) token.name = name
        if (picture) token.picture = picture
        token.authProvider = account.provider
      } else if (user && !token.email) {
        if (user.email) token.email = user.email
        if (user.name) token.name = user.name
        if ((user as any).image) token.picture = (user as any).image
        // Credentials 로그인 시 provider 기록
        if (account?.provider) token.authProvider = account.provider
      }
      // Credentials authorize 가 role 을 넘기면 보존
      if ((user as any)?.role) (token as any).role = (user as any).role

      // OAuth 로그인 직후 role 이 비면 백엔드 /api/account/me 로 조회.
      // ADMIN_EMAILS 환경변수가 백엔드에 설정되어 있으면 verifyAndUpsert 가 자동 admin 승격.
      if (account && token.email && !(token as any).role) {
        try {
          const apiToken = jwt.sign(
            { email: token.email, name: token.name ?? '', picture: token.picture ?? '' },
            authSecret,
            { algorithm: 'HS256', expiresIn: '5m' },
          )
          const resp = await fetch(`${API_ORIGIN}/api/account/me`, {
            headers: { Authorization: `Bearer ${apiToken}` },
          })
          if (resp.ok) {
            const me = await resp.json().catch(() => null)
            if (me?.role) (token as any).role = me.role
          }
        } catch {
          // 실패해도 로그인 자체는 진행. admin 링크만 안 보일 뿐.
        }
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
            provider: (token as any).authProvider ?? 'unknown',
          },
          secret,
          { algorithm: 'HS256', expiresIn: '7d' },
        )
        ;(session as any).apiToken = apiToken
        ;(session as any).provider = (token as any).authProvider
        // 관리자 여부는 세션에 노출해 프런트 가드/메뉴 판정
        if ((token as any).role) (session as any).role = (token as any).role
        // user 객체도 정규화 (카카오/네이버의 경우 NextAuth 기본 user 가 미채워질 때 대비)
        if (session.user) {
          if (!session.user.email && typeof token.email === 'string') session.user.email = token.email
          if (!session.user.name && typeof token.name === 'string') session.user.name = token.name
          if (!session.user.image && typeof token.picture === 'string') session.user.image = token.picture
        }
      }
      return session
    },
  },
}

function extractEmail(profile: any, provider: string): string | null {
  if (!profile) return null
  if (provider === 'kakao') {
    // Kakao: profile.kakao_account.email
    return profile.kakao_account?.email ?? null
  }
  if (provider === 'naver') {
    // Naver: profile.response.email 또는 profile.email
    return profile.response?.email ?? profile.email ?? null
  }
  // Google 등 표준
  return profile.email ?? null
}

function extractName(profile: any, provider: string): string | null {
  if (!profile) return null
  if (provider === 'kakao') {
    return (
      profile.kakao_account?.profile?.nickname ??
      profile.properties?.nickname ??
      null
    )
  }
  if (provider === 'naver') {
    return profile.response?.name ?? profile.response?.nickname ?? null
  }
  return profile.name ?? null
}

function extractPicture(profile: any, provider: string): string | null {
  if (!profile) return null
  if (provider === 'kakao') {
    return (
      profile.kakao_account?.profile?.profile_image_url ??
      profile.properties?.profile_image ??
      null
    )
  }
  if (provider === 'naver') {
    return profile.response?.profile_image ?? null
  }
  return profile.picture ?? profile.image ?? null
}
