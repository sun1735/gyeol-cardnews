'use client'

import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'

function SignUpInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const callbackUrl = sp.get('callbackUrl') ?? '/'
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)

    const em = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError('이메일 형식이 올바르지 않습니다')
      return
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다')
      return
    }
    if (password !== password2) {
      setError('비밀번호 확인이 일치하지 않습니다')
      return
    }

    setSubmitting(true)
    try {
      const resp = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, password, name: name.trim() }),
      })
      if (!resp.ok) {
        const j = await resp.json().catch(() => null)
        setError(j?.message ?? '회원가입에 실패했습니다')
        return
      }
      // 가입 성공 → 바로 로그인
      const login = await signIn('credentials', {
        email: em,
        password,
        redirect: false,
        callbackUrl,
      })
      if (login?.ok) {
        router.push(login.url ?? callbackUrl)
      } else {
        // 로그인 실패 시 signin 페이지로
        router.push('/signin')
      }
    } catch {
      setError('회원가입 중 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-5 py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-sm w-full">
        <div className="text-center">
          <div
            className="w-11 h-11 mx-auto mb-3 rounded-[12px] flex items-center justify-center text-white font-bold text-[12px]"
            style={{ background: 'linear-gradient(145deg, #4338ca 0%, #312e81 100%)' }}
            aria-hidden
          >
            N2C
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">회원가입</h1>
          <p className="mt-2 text-slate-500 text-sm leading-relaxed">
            이메일로 Note2Card 계정을 만들어 보세요
          </p>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-3">
          <label className="block">
            <span className="block text-[12px] font-medium text-slate-700 mb-1">이름 (선택)</span>
            <input
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="홍길동"
              disabled={submitting}
              maxLength={40}
            />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-slate-700 mb-1">이메일</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="you@example.com"
              disabled={submitting}
              required
            />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-slate-700 mb-1">비밀번호</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="8자 이상"
              disabled={submitting}
              required
              minLength={8}
            />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-slate-700 mb-1">비밀번호 확인</span>
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="한 번 더"
              disabled={submitting}
              required
              minLength={8}
            />
          </label>
          {error && (
            <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
              {error}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-[10px] text-white text-[14px] font-semibold transition disabled:opacity-60"
            style={{ background: submitting ? '#6366f1' : '#4338ca' }}
          >
            {submitting ? '가입 중…' : '회원가입'}
          </button>
          <p className="text-center text-[12px] text-slate-500">
            이미 계정이 있으신가요?{' '}
            <Link href="/signin" className="text-indigo-700 font-medium hover:underline">
              로그인
            </Link>
          </p>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-[11px] text-slate-500 leading-relaxed text-center">
            가입 시{' '}
            <Link href="/terms" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">
              이용약관
            </Link>
            과{' '}
            <Link href="/privacy" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">
              개인정보처리방침
            </Link>
            에 동의하게 됩니다
          </p>
        </div>
      </div>
    </main>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400">로딩…</div>}>
      <SignUpInner />
    </Suspense>
  )
}
