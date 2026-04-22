'use client'

import { signIn } from 'next-auth/react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'

interface ProvidersMap {
  google?: unknown
  kakao?: unknown
  naver?: unknown
  credentials?: unknown
}

function SignInInner() {
  const sp = useSearchParams()
  const router = useRouter()
  const callbackUrl = sp.get('callbackUrl') ?? '/'
  const errorParam = sp.get('error')
  const [providers, setProviders] = useState<ProvidersMap>({})
  const [loading, setLoading] = useState(true)

  // 이메일·비밀번호 폼 상태
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    fetch('/api/auth/providers')
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return
        setProviders({
          google: !!data?.google,
          kakao: !!data?.kakao,
          naver: !!data?.naver,
          credentials: !!data?.credentials,
        })
      })
      .catch(() => {
        if (!mounted) return
        setProviders({})
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  // 소셜 로그인 영역은 항상 노출. 특정 provider 환경변수가 없으면 버튼만 비활성.
  const anySocial = true

  async function onSubmitEmail(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setFormError(null)
    if (!email.trim() || !password) {
      setFormError('이메일과 비밀번호를 입력해 주세요')
      return
    }
    setSubmitting(true)
    try {
      const res = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
        callbackUrl,
      })
      if (!res) {
        setFormError('로그인 요청 실패')
      } else if (res.error) {
        setFormError('이메일 또는 비밀번호가 올바르지 않습니다')
      } else if (res.ok) {
        // NEXTAUTH_URL 가 localhost 로 설정되어 있으면 res.url 이 localhost 절대경로가 되므로
        // callbackUrl(상대경로) 로 명시적으로 이동해 현재 호스트를 유지.
        router.push(callbackUrl)
      }
    } catch {
      setFormError('로그인 중 오류가 발생했습니다')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-5 py-10">
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 max-w-sm w-full">
        {/* 로고 */}
        <div className="text-center">
          <div
            className="w-11 h-11 mx-auto mb-3 rounded-[12px] flex items-center justify-center text-white font-bold text-[12px]"
            style={{ background: 'linear-gradient(145deg, #4338ca 0%, #312e81 100%)' }}
            aria-hidden
          >
            N2C
          </div>
          <h1 className="text-2xl font-bold tracking-[-0.02em]">
            Note<span style={{ color: 'var(--n2c-primary)' }}>2</span>Card
          </h1>
          <p className="mt-2 text-slate-500 text-sm leading-relaxed">
            로그인하고 카드뉴스를 만들어 보세요
          </p>
        </div>

        {errorParam && (
          <div className="mt-5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
            로그인 오류: {errorParam}
          </div>
        )}

        {/* 이메일·비밀번호 폼 */}
        <form onSubmit={onSubmitEmail} className="mt-6 space-y-3">
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
            />
          </label>
          <label className="block">
            <span className="block text-[12px] font-medium text-slate-700 mb-1">비밀번호</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-[10px] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="8자 이상"
              disabled={submitting}
            />
          </label>
          {formError && (
            <div className="text-[12px] text-red-700 bg-red-50 border border-red-200 rounded-md p-2">
              {formError}
            </div>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-[10px] text-white text-[14px] font-semibold transition disabled:opacity-60"
            style={{ background: submitting ? '#6366f1' : '#4338ca' }}
          >
            {submitting ? '로그인 중…' : '이메일로 로그인'}
          </button>
          <p className="text-center text-[12px] text-slate-500">
            계정이 없으신가요?{' '}
            <Link href="/signup" className="text-indigo-700 font-medium hover:underline">
              회원가입
            </Link>
          </p>
        </form>

        {/* 구분선 */}
        {anySocial && (
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-200" />
            <span className="text-[11px] text-slate-400 uppercase tracking-wider">또는</span>
            <div className="flex-1 h-px bg-slate-200" />
          </div>
        )}

        {/* 소셜 로그인 — provider 환경변수 미설정 시 disabled 처리 */}
        <div className="space-y-2.5">
          {loading ? (
            <div className="text-center text-slate-400 text-sm py-4">연결 중…</div>
          ) : (
            <>
              {/* Google */}
              <button
                onClick={() => signIn('google', { callbackUrl })}
                disabled={!providers.google}
                className="w-full flex items-center justify-center gap-3 border border-slate-200 rounded-[10px] px-4 py-3 bg-white hover:bg-slate-50 hover:border-slate-300 text-[14px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                title={providers.google ? '' : '준비 중'}
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google 계정으로 계속
              </button>

              {/* Kakao */}
              <button
                onClick={() => signIn('kakao', { callbackUrl })}
                disabled={!providers.kakao}
                className="w-full flex items-center justify-center gap-3 rounded-[10px] px-4 py-3 text-[14px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: providers.kakao ? '#FEE500' : '#f1f5f9',
                  color: providers.kakao ? '#181600' : '#94a3b8',
                }}
                title={providers.kakao ? '' : '준비 중'}
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path fill="currentColor" d="M12 3C6.48 3 2 6.48 2 10.8c0 2.78 1.82 5.22 4.57 6.6l-1.14 4.15c-.1.36.32.65.63.45l5.03-3.28c.3.02.6.03.91.03 5.52 0 10-3.48 10-7.75S17.52 3 12 3z" />
                </svg>
                카카오로 계속
              </button>

              {/* Naver */}
              <button
                onClick={() => signIn('naver', { callbackUrl })}
                disabled={!providers.naver}
                className="w-full flex items-center justify-center gap-3 rounded-[10px] px-4 py-3 text-[14px] font-medium transition disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  background: providers.naver ? '#03C75A' : '#f1f5f9',
                  color: providers.naver ? '#ffffff' : '#94a3b8',
                }}
                title={providers.naver ? '' : '준비 중'}
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden>
                  <path fill="currentColor" d="M16.273 12.845L7.376 0H0v24h7.727V11.156L16.624 24H24V0h-7.727v12.845z" />
                </svg>
                네이버로 계속
              </button>
            </>
          )}
        </div>

        {!loading && !providers.google && !providers.kakao && !providers.naver && (
          <p className="mt-4 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2.5 leading-relaxed">
            간편 로그인은 관리자가 OAuth 환경변수 설정 후 활성화됩니다.
          </p>
        )}

        {/* 구분선 */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-[11px] text-slate-500 leading-relaxed text-center">
            로그인 시{' '}
            <Link href="/terms" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">
              이용약관
            </Link>
            과{' '}
            <Link href="/privacy" className="text-slate-700 underline underline-offset-2 hover:text-slate-900">
              개인정보처리방침
            </Link>
            에 동의하는 것으로 간주됩니다
          </p>
        </div>
      </div>
    </main>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center text-slate-400">로딩…</div>}>
      <SignInInner />
    </Suspense>
  )
}
