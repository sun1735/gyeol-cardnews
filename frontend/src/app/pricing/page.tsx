'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'

type PlanKey = 'free' | 'pro' | 'team'

interface PlanInfo {
  key: PlanKey
  price: { monthly: number; yearly: number }
  limits: {
    imageGen: number
    textGen: number
    ragJob: number
    ideaGen: number
    brands: number
    watermark: boolean
    reels: boolean
    customDomain: boolean
    apiAccess: boolean
    teamSeats: number
  }
}

const PLAN_LABELS: Record<PlanKey, { name: string; sub: string; color: string; cta: string }> = {
  free: { name: 'Free', sub: '감탄하고 시작하기', color: 'slate', cta: '지금 시작' },
  pro: { name: 'Pro', sub: '개인·소상공인 필수', color: 'indigo', cta: 'Pro 업그레이드' },
  team: { name: 'Team', sub: '에이전시·팀 전용', color: 'violet', cta: 'Team 문의하기' },
}

const PLAN_FEATURES: Record<PlanKey, string[]> = {
  free: [
    '월 5회 텍스트 카드뉴스',
    'AI 이미지 월 3장',
    '브랜드 1개 · 지식노트 3개',
    'Powered by Note2Card 워터마크',
  ],
  pro: [
    '월 100회 텍스트 카드뉴스',
    'AI 이미지 월 100장',
    '브랜드 5개 · 지식노트 무제한',
    '워터마크 제거',
    '릴스 MP4 내보내기',
    '우선순위 큐 · 빠른 처리',
  ],
  team: [
    '월 500회 텍스트 · AI 이미지 월 500장',
    '브랜드 20개',
    '팀원 5명까지',
    '커스텀 도메인 연동',
    'API 액세스 (Zapier·Slack 봇)',
    '전담 채팅 지원',
  ],
}

function formatKRW(n: number) {
  return n.toLocaleString('ko-KR') + '원'
}

export default function PricingPage() {
  const { data: session, status } = useSession()
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [plans, setPlans] = useState<PlanInfo[]>([])
  const [currentPlan, setCurrentPlan] = useState<PlanKey>('free')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/quota/plans')
      .then((r) => r.json())
      .then((d) => setPlans(d?.plans ?? []))
      .catch(() => setPlans([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (status !== 'authenticated') return
    const apiToken = (session as any)?.apiToken as string | undefined
    if (!apiToken) return
    fetch('/api/quota/me', {
      headers: { Authorization: `Bearer ${apiToken}` },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d?.plan) setCurrentPlan(d.plan)
      })
      .catch(() => {})
  }, [status, session])

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <div className="mb-6">
        <Link href="/" className="text-sm text-indigo-700 hover:underline">
          ← 홈으로
        </Link>
      </div>

      <div className="text-center mb-10">
        <h1 className="text-4xl font-black tracking-tight">
          필요한 만큼만<span className="text-indigo-700">.</span>
        </h1>
        <p className="mt-3 text-slate-600 text-lg">
          카드 1장 만드는 데 드는 비용은 약 53원. 합리적인 가격으로 제공합니다.
        </p>

        {/* 월/년 토글 */}
        <div className="inline-flex mt-6 p-1 rounded-xl bg-slate-100 border">
          <button
            onClick={() => setCycle('monthly')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${
              cycle === 'monthly' ? 'bg-white shadow-sm' : 'text-slate-500'
            }`}
          >
            월 결제
          </button>
          <button
            onClick={() => setCycle('yearly')}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-2 ${
              cycle === 'yearly' ? 'bg-white shadow-sm' : 'text-slate-500'
            }`}
          >
            연 결제
            <span className="text-[10px] font-bold bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded">
              17% 할인
            </span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-10">로딩 중…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
            const L = PLAN_LABELS[p.key]
            const isCurrent = p.key === currentPlan
            const price = cycle === 'monthly' ? p.price.monthly : p.price.yearly
            const monthlyEquivalent = cycle === 'yearly' ? Math.round(p.price.yearly / 12) : price
            const isPro = p.key === 'pro'
            return (
              <div
                key={p.key}
                className={`rounded-2xl border p-6 bg-white flex flex-col ${
                  isPro ? 'border-indigo-400 shadow-lg ring-2 ring-indigo-100 relative' : ''
                }`}
              >
                {isPro && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-700 text-white text-xs font-bold px-3 py-1 rounded-full">
                    가장 인기
                  </div>
                )}
                <div className="mb-4">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    {L.sub}
                  </div>
                  <div className="text-2xl font-black mt-1">{L.name}</div>
                </div>

                <div className="mb-5">
                  {p.key === 'free' ? (
                    <div className="text-3xl font-black">무료</div>
                  ) : (
                    <>
                      <div className="text-3xl font-black">
                        {formatKRW(monthlyEquivalent)}
                        <span className="text-base font-medium text-slate-500">/월</span>
                      </div>
                      {cycle === 'yearly' && (
                        <div className="text-xs text-slate-500 mt-1">
                          연 {formatKRW(p.price.yearly)} 일시결제
                        </div>
                      )}
                    </>
                  )}
                </div>

                <ul className="space-y-2 mb-6 text-sm text-slate-700 flex-1">
                  {PLAN_FEATURES[p.key].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className={`text-${L.color}-600 mt-0.5`}>✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-3 rounded-lg border-2 border-slate-300 text-slate-500 font-semibold"
                  >
                    현재 플랜
                  </button>
                ) : p.key === 'free' ? (
                  status === 'authenticated' ? (
                    <Link
                      href="/"
                      className="block text-center w-full py-3 rounded-lg border border-slate-300 font-semibold hover:bg-slate-50"
                    >
                      바로 사용하기 →
                    </Link>
                  ) : (
                    <Link
                      href="/signin?callbackUrl=/pricing"
                      className="block text-center w-full py-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold"
                    >
                      로그인 · 회원가입
                    </Link>
                  )
                ) : (
                  <button
                    onClick={() => {
                      if (status !== 'authenticated') {
                        window.location.href = '/signin?callbackUrl=/pricing'
                        return
                      }
                      alert(
                        '결제 연동 준비 중입니다. 정식 런칭 전 문의 주시면 수동 업그레이드 해드립니다.',
                      )
                    }}
                    className={`w-full py-3 rounded-lg font-semibold text-white shadow-sm ${
                      isPro
                        ? 'bg-indigo-700 hover:bg-indigo-800'
                        : 'bg-violet-700 hover:bg-violet-800'
                    }`}
                  >
                    {L.cta}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-10 text-center text-sm text-slate-500 leading-relaxed">
        모든 플랜은 언제든 해지·변경 가능 · 결제는{' '}
        <a href="https://tosspayments.com" target="_blank" rel="noopener" className="underline">
          토스페이먼츠
        </a>{' '}
        를 통해 안전하게 처리됩니다
        <div className="mt-1">
          <Link href="/terms" className="hover:underline mx-2">
            이용약관
          </Link>
          ·
          <Link href="/privacy" className="hover:underline mx-2">
            개인정보처리방침
          </Link>
        </div>
      </div>
    </main>
  )
}
