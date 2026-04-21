import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'GYEOL · 카드뉴스 생성기',
  description: '브랜드 톤앤매너에 맞춘 카드뉴스 자동 생성/편집/다운로드',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-slate-50 text-slate-900 min-h-screen">{children}</body>
    </html>
  )
}
