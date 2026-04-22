import { NextRequest, NextResponse } from 'next/server'

// NextAuth 가 /api/auth/* 를 잡고 있으므로 회원가입만 별도 라우트로 노출.
// 내부적으로 백엔드 /api/auth/register 로 프록시 (bcrypt 해시·DB 쓰기는 백엔드).
export const runtime = 'nodejs'
const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:4000'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const resp = await fetch(`${API_ORIGIN}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    const text = await resp.text()
    return new NextResponse(text, {
      status: resp.status,
      headers: {
        'Content-Type': resp.headers.get('content-type') ?? 'application/json',
      },
    })
  } catch (e: any) {
    return NextResponse.json(
      { message: '회원가입 서버 통신 실패', detail: e?.message ?? String(e) },
      { status: 502 },
    )
  }
}
