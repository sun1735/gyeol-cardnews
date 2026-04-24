'use client'

// 비로그인 방문자 대상 랜딩 페이지.
// 구성: 히어로 → 기능 3줄 → 템플릿 갤러리 → 3단계 안내 → 요금 미리보기 → 최종 CTA → 푸터.
// 기존 TemplatePreview 를 재사용해 "실제로 이렇게 나옵니다" 를 보여주는 게 핵심.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { TemplatePreview } from './templates/TemplatePreview'

// 실제 생성된 숏폼 MP4 샘플. /public/samples/yoosun-reel.mp4 가 있으면 재생,
// 없으면 플레이스홀더(폰 목업) 표시. (파일명은 레거시 호환 유지)
function ReelSamplePreview() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [available, setAvailable] = useState<'loading' | 'ready' | 'missing'>('loading')

  useEffect(() => {
    // HEAD 로 파일 존재만 체크 (본문 다운로드 방지)
    let cancelled = false
    fetch('/samples/yoosun-reel.mp4', { method: 'HEAD' })
      .then((r) => {
        if (cancelled) return
        setAvailable(r.ok ? 'ready' : 'missing')
      })
      .catch(() => !cancelled && setAvailable('missing'))
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="relative">
      {/* 폰 목업 프레임 — 9:16 비율, 실제로 비디오가 돌아가는 느낌 */}
      <div
        className="mx-auto relative rounded-[32px] overflow-hidden shadow-2xl border-[6px] border-slate-900"
        style={{ width: 240, height: 427, background: '#0f172a' }}
      >
        {available === 'ready' ? (
          <video
            ref={videoRef}
            src="/samples/yoosun-reel.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          // 플레이스홀더: 실제 샘플 이미지를 9:16 로 확대해 세로로 스크롤 느낌
          <div className="relative w-full h-full">
            <img
              src="/samples/yoosun-basic.png"
              alt=""
              className="w-full h-full object-cover"
              style={{ animation: 'reelSlow 8s ease-in-out infinite alternate' }}
            />
            <style>{`@keyframes reelSlow { 0%{object-position:center 0%} 100%{object-position:center 100%} }`}</style>
            {/* 상단 숏폼 UI 흉내 (플랫폼 공용) */}
            <div className="absolute top-3 left-0 right-0 flex items-center justify-between px-4">
              <span className="text-white text-[11px] font-bold">SHORTS</span>
              <div className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-white/80" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                <span className="w-1.5 h-1.5 rounded-full bg-white/40" />
              </div>
            </div>
            {/* 하단 정보 */}
            <div className="absolute bottom-3 left-0 right-0 px-3 text-white">
              <div className="text-[11px] font-bold tracking-wide drop-shadow">@brand_account</div>
              <div className="text-[10px] opacity-80 mt-0.5 drop-shadow">카드 시리즈 자동 변환 · 9:16 MP4</div>
            </div>
            {/* 재생 버튼 오버레이 */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-14 h-14 rounded-full bg-white/90 flex items-center justify-center shadow-2xl">
                <span style={{ fontSize: 22, marginLeft: 3 }}>▶</span>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 샘플 라벨 */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-600 text-white text-[11px] font-bold tracking-wider uppercase">
          {available === 'ready' ? '실제 생성 숏폼' : '숏폼 샘플 미리보기'}
        </div>
        <div className="mt-2 text-[13px] text-slate-600 font-medium">
          카드뉴스 5장 → 9:16 MP4 자동 합성
        </div>
      </div>
    </div>
  )
}

export function Landing() {
  const scrollToId = (id: string) => () => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* ─────────── 헤더 ─────────── */}
      <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-bold text-[12px] tracking-tight"
              style={{ background: 'linear-gradient(145deg, #4338ca 0%, #312e81 100%)' }}
            >
              N2C
            </div>
            <span className="text-[17px] font-bold tracking-[-0.02em]">
              Note<span style={{ color: '#4338ca' }}>2</span>Card
            </span>
          </div>
          <nav className="flex items-center gap-1.5">
            <button
              onClick={scrollToId('templates')}
              className="hidden sm:inline-flex px-3 py-2 text-[14px] font-medium text-slate-600 hover:text-slate-900 transition"
            >
              템플릿
            </button>
            <button
              onClick={scrollToId('pricing')}
              className="hidden sm:inline-flex px-3 py-2 text-[14px] font-medium text-slate-600 hover:text-slate-900 transition"
            >
              요금
            </button>
            <Link
              href="/signin"
              className="px-3 py-2 text-[14px] font-medium text-slate-700 hover:text-slate-900 transition"
            >
              로그인
            </Link>
            <Link
              href="/signup"
              className="ml-1 px-4 py-2 rounded-[10px] text-white text-[14px] font-bold transition hover:opacity-95"
              style={{ background: '#4338ca' }}
            >
              무료로 시작
            </Link>
          </nav>
        </div>
      </header>

      {/* ─────────── 히어로 ─────────── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(circle at 80% -10%, rgba(67,56,202,0.16) 0%, rgba(255,255,255,0) 50%), linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)',
          }}
        />
        <div className="max-w-6xl mx-auto px-5 py-20 sm:py-28 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-[13px] font-bold mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              AI 카드뉴스 생성 · Powered by Gemini
            </div>
            <h1 className="text-[44px] sm:text-[56px] font-black tracking-[-0.035em] leading-[1.05]">
              브랜드 톤 유지{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #4338ca 0%, #7c3aed 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                }}
              >
                5~10장 카드뉴스
              </span>
              <br />시리즈 자동 생성
            </h1>
            <p className="mt-6 text-[18px] sm:text-[19px] text-slate-600 leading-relaxed font-medium">
              브랜드 지식노트를 업로드하면 AI 가 톤·색상·핵심 메시지를 기억해
              <br className="hidden sm:inline" />
              일관된 스토리의 인스타 카드뉴스 5~10장을 한 번에 완성합니다.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="px-6 py-4 rounded-[12px] text-white text-[16px] font-bold transition hover:opacity-95 inline-flex items-center gap-2"
                style={{ background: '#4338ca', boxShadow: '0 10px 24px rgba(67,56,202,0.25)' }}
              >
                무료로 시작하기
                <span>→</span>
              </Link>
              <button
                onClick={scrollToId('templates')}
                className="px-6 py-4 rounded-[12px] text-[16px] font-bold text-slate-700 border-2 border-slate-200 hover:border-slate-300 transition"
              >
                템플릿 살펴보기
              </button>
            </div>
            <p className="mt-5 text-[13px] text-slate-500 font-medium">
              신용카드 없이 시작 · 월 3장 무료 · 언제든 업그레이드
            </p>
          </div>

          {/* 우측 미리보기 — 실제 시리즈 5장 샘플 오버랩 + "→ 숏폼" 힌트 */}
          <div className="relative h-[440px] hidden lg:block">
            {/* 카드 5장이 살짝 겹쳐 시리즈 감각 */}
            {[
              { top: 0, right: 100, rotate: -6, width: 230, opacity: 0.85 },
              { top: 30, right: 60, rotate: -3, width: 240, opacity: 0.92 },
              { top: 60, right: 20, rotate: 0, width: 260, opacity: 1 },
            ].map((s, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  top: s.top,
                  right: s.right,
                  transform: `rotate(${s.rotate}deg)`,
                  opacity: s.opacity,
                  zIndex: i + 1,
                }}
              >
                <div className="rounded-[20px] overflow-hidden shadow-2xl">
                  <TemplatePreview
                    template="basic"
                    displayWidth={s.width}
                    sampleImageUrl="/samples/yoosun-basic.png"
                    sampleAspect="4:5"
                  />
                </div>
              </div>
            ))}
            {/* "→ 숏폼 MP4" 플로팅 뱃지 */}
            <div
              className="absolute"
              style={{ bottom: 20, left: 0, zIndex: 10 }}
            >
              <div className="px-4 py-3 rounded-[14px] bg-white border border-slate-200 shadow-xl flex items-center gap-2.5">
                <span className="text-[28px]">🎬</span>
                <div>
                  <div className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                    한 번 더 클릭
                  </div>
                  <div className="text-[15px] font-black text-slate-900">
                    숏폼 MP4 한 개
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─────────── 기능 3줄 ─────────── */}
      <section className="max-w-6xl mx-auto px-5 py-20 sm:py-24">
        <h2 className="text-[28px] sm:text-[36px] font-black tracking-[-0.025em] text-center">
          왜 Note2Card 인가
        </h2>
        <p className="mt-3 text-center text-slate-600 text-[16px] font-medium">
          단순한 텍스트 생성을 넘어 — 브랜드 일관성까지 책임집니다
        </p>
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              emoji: '📚',
              title: '브랜드 메모리',
              desc: '브랜드 문서·FAQ·보도자료를 한 번 올리면 AI 가 톤·핵심 메시지·숫자·고유명사를 기억합니다. 매번 같은 브랜드 감성으로 생성.',
            },
            {
              emoji: '🧵',
              title: '5~10장 시리즈 일관성',
              desc: 'Cover → Content → CTA 흐름으로 5~10장이 연결된 스토리. GPT 로 한 장씩 뽑는 것과 차원이 다른 결과.',
            },
            {
              emoji: '🎬',
              title: '숏폼 MP4 자동 변환',
              desc: '생성한 카드뉴스 시리즈를 9:16 세로 숏폼 MP4 로 한 번에 합성. 페이드·슬라이드 전환 자동 · 인스타 릴스·틱톡·유튜브 쇼츠 바로 업로드.',
            },
          ].map((f, i) => (
            <div
              key={i}
              className="p-7 rounded-[16px] border border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm transition"
            >
              <div
                className="w-12 h-12 rounded-[12px] flex items-center justify-center text-[24px] mb-5"
                style={{ background: '#eef2ff' }}
              >
                {f.emoji}
              </div>
              <h3 className="text-[18px] font-bold tracking-[-0.015em]">{f.title}</h3>
              <p className="mt-2 text-[14px] text-slate-600 leading-relaxed font-medium">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────── 결과물 · 숏폼 변환 ─────────── */}
      <section id="templates" className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-20 sm:py-24">
          <div className="text-center">
            <h2 className="text-[28px] sm:text-[36px] font-black tracking-[-0.025em]">
              카드뉴스 5~10장 <span style={{ color: '#4338ca' }}>→</span> 숏폼 MP4 한 번에
            </h2>
            <p className="mt-3 text-slate-600 text-[16px] font-medium">
              브랜드 톤 유지하며 시리즈로 생성 · 9:16 숏폼 MP4 한 번에 합성 (릴스·틱톡·쇼츠 공용)
            </p>
          </div>
          {/* 시리즈 카드 5장 샘플 + 숏폼 MP4 프리뷰 */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-6 items-center">
            {/* 좌: 실제 생성된 YOOSUN 시리즈 */}
            <div className="p-6 bg-white rounded-[20px] border border-slate-200 relative">
              <div className="absolute top-4 right-4 z-10 px-2.5 py-1 rounded-full text-white text-[10px] font-bold tracking-wider uppercase" style={{ background: '#4338ca' }}>
                실제 생성 시리즈
              </div>
              <div className="flex justify-center overflow-hidden">
                <TemplatePreview
                  template="basic"
                  displayWidth={280}
                  sampleImageUrl="/samples/yoosun-basic.png"
                  sampleAspect="4:5"
                />
              </div>
              <div className="mt-5 text-center">
                <h3 className="text-[20px] font-bold tracking-[-0.015em]">
                  브랜드 톤 유지 시리즈
                </h3>
                <p className="mt-1.5 text-[14px] text-slate-600 font-medium leading-relaxed">
                  Cover → 성분 → 복용법 → 후기 → 구매 5장이 같은 브랜드 감성으로 일관되게 나옵니다
                </p>
              </div>
            </div>

            {/* 우: 실제 생성된 숏폼 MP4 embed */}
            <ReelSamplePreview />
          </div>

          {/* 숏폼 변환 기능 상세 */}
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { emoji: '📐', label: '9:16 세로', sub: '자동 레이아웃' },
              { emoji: '✨', label: '3종 전환', sub: '페이드·슬라이드·줌' },
              { emoji: '🚀', label: '10~30초', sub: 'FFmpeg 고속 합성' },
              { emoji: '📲', label: '바로 업로드', sub: '릴스·틱톡·쇼츠' }, // 플랫폼명 유지
            ].map((f, i) => (
              <div
                key={i}
                className="p-4 rounded-[14px] bg-white border border-slate-200 text-center"
              >
                <div className="text-[28px]">{f.emoji}</div>
                <div className="mt-1 text-[14px] font-bold">{f.label}</div>
                <div className="text-[11px] text-slate-500 font-medium mt-0.5">{f.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────── 3단계 안내 ─────────── */}
      <section className="max-w-6xl mx-auto px-5 py-20 sm:py-24">
        <h2 className="text-[28px] sm:text-[36px] font-black tracking-[-0.025em] text-center">
          어떻게 만들어지나
        </h2>
        <p className="mt-3 text-center text-slate-600 text-[16px] font-medium">
          3단계, 가입 후 5분 안에 첫 카드뉴스 완성
        </p>
        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {[
            {
              n: '01',
              title: '브랜드 등록',
              desc: '브랜드명·톤·색상 + 문서·이미지 몇 개 업로드. 이게 AI 의 학습 자료가 됩니다.',
            },
            {
              n: '02',
              title: '주제 입력',
              desc: '"5월 봄맞이 20% 세일, 아쿠아 세럼" 같은 한 문장만. 템플릿·장수를 고르면 끝.',
            },
            {
              n: '03',
              title: '내보내기',
              desc: '생성된 카드를 바로 편집하거나, PNG·ZIP·숏폼 MP4 로 다운로드해서 업로드.',
            },
          ].map((s, i) => (
            <div
              key={i}
              className="relative p-7 rounded-[16px] border border-slate-200 bg-white"
            >
              <div
                className="text-[48px] font-black leading-none mb-4"
                style={{
                  background: 'linear-gradient(135deg, #4338ca 0%, #7c3aed 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  color: 'transparent',
                  letterSpacing: '-0.04em',
                }}
              >
                {s.n}
              </div>
              <h3 className="text-[19px] font-bold tracking-[-0.015em]">{s.title}</h3>
              <p className="mt-2 text-[14px] text-slate-600 leading-relaxed font-medium">
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────── 요금 미리보기 ─────────── */}
      <section id="pricing" className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-5 py-20 sm:py-24">
          <div className="text-center">
            <h2 className="text-[28px] sm:text-[36px] font-black tracking-[-0.025em]">
              합리적인 요금
            </h2>
            <p className="mt-3 text-slate-600 text-[16px] font-medium">
              체험해 보고 원할 때 업그레이드하세요
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
            {[
              {
                key: 'free',
                name: 'Free',
                price: '₩0',
                period: '체험용',
                highlight: false,
                items: ['월 이미지 3장', '카드 5장', '브랜드 1개', '워터마크 포함'],
              },
              {
                key: 'pro',
                name: 'Pro',
                price: '₩12,900',
                period: '/ 월',
                highlight: true,
                items: [
                  '월 이미지 100장',
                  '카드 100장',
                  '브랜드 5개',
                  '워터마크 없음',
                  '숏폼 MP4 내보내기',
                ],
              },
              {
                key: 'team',
                name: 'Team',
                price: '₩39,000',
                period: '/ 월',
                highlight: false,
                items: [
                  '월 이미지 500장',
                  '카드 500장',
                  '브랜드 20개',
                  '팀 시트 5명',
                  'API 액세스',
                ],
              },
            ].map((p) => (
              <div
                key={p.key}
                className={`p-7 rounded-[18px] bg-white transition ${
                  p.highlight
                    ? 'ring-2 ring-indigo-500 shadow-xl relative'
                    : 'border border-slate-200'
                }`}
              >
                {p.highlight && (
                  <div
                    className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-white text-[11px] font-bold tracking-wider uppercase"
                    style={{ background: '#4338ca' }}
                  >
                    추천
                  </div>
                )}
                <h3 className="text-[20px] font-bold tracking-[-0.015em]">{p.name}</h3>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-[36px] font-black tracking-[-0.03em]">{p.price}</span>
                  <span className="text-[14px] text-slate-500 font-medium">{p.period}</span>
                </div>
                <ul className="mt-6 space-y-2.5">
                  {p.items.map((it, i) => (
                    <li key={i} className="flex items-start gap-2 text-[14px] text-slate-700 font-medium">
                      <span className="text-indigo-600 mt-0.5">✓</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-[13px] text-slate-500 font-medium">
            연 결제 시 17% 할인 · 언제든 플랜 변경·취소 가능
          </p>

          {/* 1회권 안내 */}
          <div className="mt-10 max-w-3xl mx-auto p-6 rounded-[16px] bg-indigo-50/60 border border-indigo-100 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-indigo-200 text-indigo-700 text-[12px] font-bold mb-3">
              NEW · 자동결제 부담 없이
            </div>
            <h3 className="text-[20px] font-bold tracking-[-0.015em]">1회권도 있습니다</h3>
            <p className="mt-2 text-[14px] text-slate-600 font-medium leading-relaxed">
              스타터 ₩2,900 (10장) · 스탠다드 ₩9,900 (50장) · 프리미엄 ₩19,900 (120장).
              <br />
              구매 후 30일 유효, 플랜 한도 소진 후 자동으로 차감됩니다.
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1 text-[14px] text-indigo-700 font-bold hover:underline"
            >
              자세한 요금 보기 →
            </Link>
          </div>
        </div>
      </section>

      {/* ─────────── 최종 CTA ─────────── */}
      <section className="max-w-6xl mx-auto px-5 py-20 sm:py-24 text-center">
        <h2 className="text-[32px] sm:text-[44px] font-black tracking-[-0.03em] leading-tight">
          지금 시작하면{' '}
          <span style={{ color: '#4338ca' }}>5분 안에</span>
          <br />첫 카드뉴스가 손에 들어옵니다
        </h2>
        <p className="mt-5 text-[17px] text-slate-600 font-medium">
          무료로 가입하고 월 3장 이미지 · 5장 카드를 테스트해보세요
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/signup"
            className="px-8 py-4 rounded-[12px] text-white text-[16px] font-bold hover:opacity-95 inline-flex items-center gap-2 transition"
            style={{ background: '#4338ca', boxShadow: '0 10px 24px rgba(67,56,202,0.25)' }}
          >
            무료 회원가입
            <span>→</span>
          </Link>
          <Link
            href="/signin"
            className="px-8 py-4 rounded-[12px] text-[16px] font-bold text-slate-700 border-2 border-slate-200 hover:border-slate-300 transition"
          >
            로그인
          </Link>
        </div>
      </section>

      {/* ─────────── 푸터 ─────────── */}
      <footer className="bg-slate-950 text-slate-400">
        <div className="max-w-6xl mx-auto px-5 py-12 grid grid-cols-1 sm:grid-cols-[1.3fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-2.5">
              <div
                className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-bold text-[12px]"
                style={{ background: 'linear-gradient(145deg, #4338ca 0%, #312e81 100%)' }}
              >
                N2C
              </div>
              <span className="text-[16px] font-bold text-white tracking-[-0.02em]">Note2Card</span>
            </div>
            <p className="mt-4 text-[13px] leading-relaxed font-medium max-w-sm">
              브랜드 지식노트 기반 AI 카드뉴스 생성기. 인스타·쇼핑몰·블로그 콘텐츠 제작 시간을 1/10 로.
            </p>
          </div>
          <div>
            <h4 className="text-white text-[13px] font-bold uppercase tracking-wider mb-3">제품</h4>
            <ul className="space-y-2 text-[14px] font-medium">
              <li>
                <button onClick={scrollToId('templates')} className="hover:text-white transition">
                  템플릿
                </button>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-white transition">
                  요금
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-white transition">
                  가입하기
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-white text-[13px] font-bold uppercase tracking-wider mb-3">정책</h4>
            <ul className="space-y-2 text-[14px] font-medium">
              <li>
                <Link href="/terms" className="hover:text-white transition">
                  이용약관
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition">
                  개인정보처리방침
                </Link>
              </li>
              <li>
                <a
                  href="mailto:sun17351735@gmail.com"
                  className="hover:text-white transition"
                >
                  문의
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-slate-800">
          <div className="max-w-6xl mx-auto px-5 py-5 text-[12px] text-slate-500 font-medium">
            © {new Date().getFullYear()} Note2Card · Built with Next.js · Powered by Gemini
          </div>
        </div>
      </footer>
    </main>
  )
}
