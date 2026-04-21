/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:4000'

const nextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    return {
      // beforeFiles: rewrite 가 먼저 실행 — /api/auth/* 는 NextAuth 가 frontend 에서 처리하도록 예외 처리.
      // 남은 /api/* 는 모두 backend 로 프록시.
      beforeFiles: [
        // NextAuth 라우트 (/api/auth/*) 는 프론트 app router 가 처리 → rewrite 적용 안 함
      ],
      afterFiles: [
        // /api/auth/* 제외하고 backend 로 프록시
        {
          source: '/api/:path((?!auth).*)*',
          destination: `${API_ORIGIN}/api/:path*`,
        },
        { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
        { source: '/health', destination: `${API_ORIGIN}/health` },
      ],
      fallback: [],
    }
  },
}

export default nextConfig
