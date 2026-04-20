/** @type {import('next').NextConfig} */
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:4000'

const nextConfig = {
  images: { unoptimized: true },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_ORIGIN}/api/:path*` },
      { source: '/uploads/:path*', destination: `${API_ORIGIN}/uploads/:path*` },
      { source: '/health', destination: `${API_ORIGIN}/health` },
    ]
  },
}

export default nextConfig
