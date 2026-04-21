/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:4000'

// 백엔드로 프록시할 API 경로들 (명시적 화이트리스트).
// /api/auth/* 는 NextAuth 가 frontend 에서 직접 처리하므로 제외.
const BACKEND_API_PATHS = [
  'brands',
  'projects',
  'cards',
  'generate',
  'upload',
  'backgrounds',
  'images',
  'knowledge',
  'reels',
  'quota',
]

const nextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    const apiRewrites = BACKEND_API_PATHS.flatMap((p) => [
      { source: `/api/${p}`, destination: `${API_ORIGIN}/api/${p}` },
      { source: `/api/${p}/:path*`, destination: `${API_ORIGIN}/api/${p}/:path*` },
    ])
    return [
      ...apiRewrites,
      { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
      { source: '/health', destination: `${API_ORIGIN}/health` },
    ]
  },
}

export default nextConfig
