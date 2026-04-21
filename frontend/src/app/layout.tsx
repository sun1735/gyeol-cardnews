import './globals.css'
import type { Metadata } from 'next'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Note2Card · 노트투카드',
  description: '브랜드 지식노트 기반 카드뉴스 자동 생성/편집/다운로드',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-slate-50 text-slate-900 min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
