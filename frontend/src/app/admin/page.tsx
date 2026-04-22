'use client'

import { useSession, signIn } from 'next-auth/react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'

// 관리자 페이지 — stats / users / brands / jobs 4개 탭.
// 인증: session.apiToken 을 Authorization 헤더에 실어 백엔드 /api/admin/* 호출.
// role 판정은 백엔드(AdminGuard) 가 최종 — 프런트는 UX 편의상 세션 role 만 참고.

type Tab = 'stats' | 'users' | 'brands' | 'jobs'

interface Stats {
  users: number
  brands: number
  jobs: number
  month: string
  usageThisMonth: { imageGen: number; textGen: number; ragJob: number; ideaGen: number }
  jobStatus: { status: string; count: number }[]
  planBreakdown: { plan: string; count: number }[]
}

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  plan: string
  planStartedAt: string | null
  planExpiresAt: string | null
  createdAt: string
  authType: 'email' | 'social'
  brandCount: number
}

interface BrandRow {
  id: string
  name: string
  tone: string
  primaryColor: string
  createdAt: string
  ownerId: string | null
  owner: { email: string; name: string } | null
}

interface JobRow {
  id: string
  brandId: string | null
  mode: string
  status: string
  progress: number
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

function useApi(apiToken: string | undefined) {
  return useMemo(() => {
    async function call<T>(path: string, init?: RequestInit): Promise<T> {
      const resp = await fetch(path, {
        ...init,
        headers: {
          'Content-Type': 'application/json',
          ...(apiToken ? { Authorization: `Bearer ${apiToken}` } : {}),
          ...(init?.headers ?? {}),
        },
      })
      if (!resp.ok) {
        const text = await resp.text()
        throw new Error(`${resp.status}: ${text}`)
      }
      return resp.json() as Promise<T>
    }
    return { call }
  }, [apiToken])
}

export default function AdminPage() {
  const { data: session, status } = useSession()
  const apiToken = (session as any)?.apiToken as string | undefined
  const role = (session as any)?.role as string | undefined
  const api = useApi(apiToken)

  const [tab, setTab] = useState<Tab>('stats')
  const [stats, setStats] = useState<Stats | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [userQuery, setUserQuery] = useState('')
  const [brands, setBrands] = useState<BrandRow[]>([])
  const [jobs, setJobs] = useState<JobRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)
  const [me, setMe] = useState<{
    email?: string
    role?: string
    plan?: string
    name?: string
  } | null>(null)
  const [meError, setMeError] = useState<string | null>(null)

  async function loadStats() {
    setLoading(true)
    setError(null)
    try {
      const s = await api.call<Stats>('/api/admin/stats')
      setStats(s)
    } catch (e: any) {
      handleError(e)
    } finally {
      setLoading(false)
    }
  }
  async function loadUsers(q?: string) {
    setLoading(true)
    setError(null)
    try {
      const qs = q ? `?q=${encodeURIComponent(q)}` : ''
      const r = await api.call<{ items: UserRow[]; total: number }>(`/api/admin/users${qs}`)
      setUsers(r.items)
    } catch (e: any) {
      handleError(e)
    } finally {
      setLoading(false)
    }
  }
  async function loadBrands() {
    setLoading(true)
    setError(null)
    try {
      const r = await api.call<{ items: BrandRow[] }>('/api/admin/brands')
      setBrands(r.items)
    } catch (e: any) {
      handleError(e)
    } finally {
      setLoading(false)
    }
  }
  async function loadJobs() {
    setLoading(true)
    setError(null)
    try {
      const r = await api.call<{ items: JobRow[] }>('/api/admin/jobs')
      setJobs(r.items)
    } catch (e: any) {
      handleError(e)
    } finally {
      setLoading(false)
    }
  }

  function handleError(e: any) {
    const msg = String(e?.message ?? e)
    if (msg.startsWith('401') || msg.includes('로그인')) {
      setAuthError('로그인이 필요합니다')
    } else if (msg.startsWith('403') || msg.includes('관리자')) {
      setAuthError('관리자 권한이 필요합니다')
    } else {
      setError(msg)
    }
  }

  // 진단: 백엔드에서 본 현재 유저의 role/plan 을 실시간 확인.
  async function loadMe() {
    setMeError(null)
    try {
      const r = await api.call<{
        email: string
        role: string
        plan: string
        name: string
      }>('/api/account/me')
      setMe(r)
    } catch (e: any) {
      setMe(null)
      setMeError(String(e?.message ?? e))
    }
  }

  useEffect(() => {
    if (status !== 'authenticated') return
    void loadMe()
    if (tab === 'stats') void loadStats()
    else if (tab === 'users') void loadUsers(userQuery)
    else if (tab === 'brands') void loadBrands()
    else if (tab === 'jobs') void loadJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, status, apiToken])

  async function updateUser(id: string, patch: { role?: string; plan?: string }) {
    try {
      await api.call(`/api/admin/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(patch),
      })
      await loadUsers(userQuery)
    } catch (e: any) {
      alert('업데이트 실패: ' + (e?.message ?? e))
    }
  }
  async function deleteUser(id: string, email: string) {
    if (!confirm(`${email} 유저를 삭제할까요? (소유 브랜드/데이터 연쇄 삭제됨)`)) return
    try {
      await api.call(`/api/admin/users/${id}`, { method: 'DELETE' })
      await loadUsers(userQuery)
    } catch (e: any) {
      alert('삭제 실패: ' + (e?.message ?? e))
    }
  }

  if (status === 'loading') {
    return <main className="p-10 text-center text-slate-400">로딩…</main>
  }
  if (status === 'unauthenticated') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-10">
        <h1 className="text-2xl font-bold">관리자 페이지</h1>
        <p className="text-slate-500">로그인이 필요합니다.</p>
        <button
          onClick={() => signIn(undefined, { callbackUrl: '/admin' })}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium"
        >
          로그인
        </button>
      </main>
    )
  }
  if (authError) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-10">
        <h1 className="text-2xl font-bold">접근 불가</h1>
        <p className="text-slate-600 text-sm">{authError}</p>
        {/* 진단 정보 — 백엔드가 본 내 role 을 그대로 표시 */}
        <div className="bg-white border border-slate-200 rounded-xl p-4 text-sm space-y-1 min-w-[320px]">
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            진단 정보
          </div>
          <Diag label="세션 이메일" value={session?.user?.email ?? '(없음)'} />
          <Diag label="세션 role" value={role ?? '(없음)'} />
          <Diag
            label="API 토큰"
            value={apiToken ? apiToken.slice(0, 16) + '…' : '(없음)'}
          />
          <Diag label="백엔드 me.email" value={me?.email ?? '(없음)'} />
          <Diag label="백엔드 me.role" value={me?.role ?? '(없음)'} />
          {meError && (
            <div className="text-[11px] text-red-600 break-all pt-1 border-t border-slate-100 mt-2">
              /me 에러: {meError}
            </div>
          )}
          {me && me.role !== 'admin' && (
            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mt-2 leading-relaxed">
              Railway 백엔드 서비스의 <code>ADMIN_EMAILS</code> 환경변수에
              <br />
              <b>{me.email}</b> 이(가) 포함되어 있는지 확인하세요. 설정 후 재배포 →
              로그아웃·재로그인 필요.
            </div>
          )}
        </div>
        <Link href="/" className="px-4 py-2 rounded-md bg-slate-100 text-sm font-medium">
          홈으로
        </Link>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-sm text-slate-500 hover:text-slate-700">
              ← 홈
            </Link>
            <h1 className="text-lg font-bold tracking-tight">관리자</h1>
            {role && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                {role}
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500">{session?.user?.email}</div>
        </div>
        <nav className="max-w-6xl mx-auto px-5 flex gap-1 -mb-px">
          {(
            [
              { k: 'stats', label: '통계' },
              { k: 'users', label: '유저' },
              { k: 'brands', label: '브랜드' },
              { k: 'jobs', label: '생성 잡' },
            ] as const
          ).map((t) => {
            const active = tab === t.k
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition ${
                  active
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {t.label}
              </button>
            )
          })}
        </nav>
      </header>

      <div className="max-w-6xl mx-auto px-5 py-6">
        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
            {error}
          </div>
        )}

        {tab === 'stats' && <StatsPanel stats={stats} loading={loading} />}

        {tab === 'users' && (
          <UsersPanel
            users={users}
            loading={loading}
            query={userQuery}
            onQueryChange={setUserQuery}
            onSearch={() => loadUsers(userQuery)}
            onUpdate={updateUser}
            onDelete={deleteUser}
          />
        )}

        {tab === 'brands' && <BrandsPanel brands={brands} loading={loading} />}
        {tab === 'jobs' && <JobsPanel jobs={jobs} loading={loading} />}
      </div>
    </main>
  )
}

function StatsPanel({ stats, loading }: { stats: Stats | null; loading: boolean }) {
  if (loading) return <div className="text-slate-400 text-sm">불러오는 중…</div>
  if (!stats) return <div className="text-slate-400 text-sm">데이터 없음</div>
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="총 유저" value={stats.users} />
        <Stat label="총 브랜드" value={stats.brands} />
        <Stat label="총 생성 잡" value={stats.jobs} />
        <Stat label="이번 달" value={stats.month} text />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={`이번 달 사용량 (${stats.month})`}>
          <Row label="이미지 생성/편집" value={stats.usageThisMonth.imageGen} />
          <Row label="텍스트 카드" value={stats.usageThisMonth.textGen} />
          <Row label="RAG 잡" value={stats.usageThisMonth.ragJob} />
          <Row label="아이디어" value={stats.usageThisMonth.ideaGen} />
        </Card>
        <Card title="잡 상태 분포">
          {stats.jobStatus.length === 0 ? (
            <p className="text-sm text-slate-400">데이터 없음</p>
          ) : (
            stats.jobStatus.map((s) => <Row key={s.status} label={s.status} value={s.count} />)
          )}
        </Card>
        <Card title="플랜 분포">
          {stats.planBreakdown.map((p) => (
            <Row key={p.plan} label={p.plan} value={p.count} />
          ))}
        </Card>
      </div>
    </div>
  )
}

function Stat({ label, value, text }: { label: string; value: string | number; text?: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-[11px] text-slate-500 font-medium">{label}</div>
      <div className={text ? 'text-lg font-semibold mt-1' : 'text-2xl font-bold mt-1'}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold mb-3">{title}</h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold tabular-nums">{value.toLocaleString()}</span>
    </div>
  )
}

function Diag({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-[12px]">
      <span className="text-slate-500">{label}</span>
      <span className="font-mono text-slate-800 break-all text-right">{value}</span>
    </div>
  )
}

function UsersPanel({
  users,
  loading,
  query,
  onQueryChange,
  onSearch,
  onUpdate,
  onDelete,
}: {
  users: UserRow[]
  loading: boolean
  query: string
  onQueryChange: (v: string) => void
  onSearch: () => void
  onUpdate: (id: string, patch: { role?: string; plan?: string }) => void
  onDelete: (id: string, email: string) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSearch()}
          placeholder="이메일 또는 이름으로 검색"
          className="flex-1 px-3 py-2 border border-slate-200 rounded-md text-sm"
        />
        <button
          onClick={onSearch}
          className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm font-medium"
        >
          검색
        </button>
      </div>
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600 text-[12px]">
            <tr>
              <th className="text-left px-3 py-2">이메일</th>
              <th className="text-left px-3 py-2">이름</th>
              <th className="text-left px-3 py-2">유형</th>
              <th className="text-left px-3 py-2">역할</th>
              <th className="text-left px-3 py-2">플랜</th>
              <th className="text-right px-3 py-2">브랜드</th>
              <th className="text-left px-3 py-2">가입일</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="text-center text-slate-400 py-6">
                  불러오는 중…
                </td>
              </tr>
            )}
            {!loading && users.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center text-slate-400 py-6">
                  결과 없음
                </td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium">{u.email}</td>
                <td className="px-3 py-2 text-slate-600">{u.name || '-'}</td>
                <td className="px-3 py-2 text-[12px] text-slate-500">
                  {u.authType === 'email' ? '이메일' : '소셜'}
                </td>
                <td className="px-3 py-2">
                  <select
                    value={u.role}
                    onChange={(e) => onUpdate(u.id, { role: e.target.value })}
                    className="text-xs border border-slate-200 rounded px-2 py-1"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={u.plan}
                    onChange={(e) => onUpdate(u.id, { plan: e.target.value })}
                    className="text-xs border border-slate-200 rounded px-2 py-1"
                  >
                    <option value="free">free</option>
                    <option value="pro">pro</option>
                    <option value="team">team</option>
                  </select>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{u.brandCount}</td>
                <td className="px-3 py-2 text-[12px] text-slate-500">
                  {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => onDelete(u.id, u.email)}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BrandsPanel({ brands, loading }: { brands: BrandRow[]; loading: boolean }) {
  if (loading) return <div className="text-slate-400 text-sm">불러오는 중…</div>
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-[12px]">
          <tr>
            <th className="text-left px-3 py-2">이름</th>
            <th className="text-left px-3 py-2">톤</th>
            <th className="text-left px-3 py-2">소유자</th>
            <th className="text-left px-3 py-2">컬러</th>
            <th className="text-left px-3 py-2">생성일</th>
          </tr>
        </thead>
        <tbody>
          {brands.length === 0 && (
            <tr>
              <td colSpan={5} className="text-center text-slate-400 py-6">
                데이터 없음
              </td>
            </tr>
          )}
          {brands.map((b) => (
            <tr key={b.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2 font-medium">{b.name}</td>
              <td className="px-3 py-2 text-slate-600 text-[12px]">{b.tone || '-'}</td>
              <td className="px-3 py-2 text-[12px] text-slate-500">
                {b.owner?.email ?? (b.ownerId ? b.ownerId : '레거시')}
              </td>
              <td className="px-3 py-2">
                <span
                  className="inline-block w-5 h-5 rounded border border-slate-200 align-middle"
                  style={{ background: b.primaryColor }}
                  title={b.primaryColor}
                />
              </td>
              <td className="px-3 py-2 text-[12px] text-slate-500">
                {new Date(b.createdAt).toLocaleDateString('ko-KR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function JobsPanel({ jobs, loading }: { jobs: JobRow[]; loading: boolean }) {
  if (loading) return <div className="text-slate-400 text-sm">불러오는 중…</div>
  const statusColor: Record<string, string> = {
    done: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    partial: 'text-amber-700 bg-amber-50 border-amber-200',
    failed: 'text-red-700 bg-red-50 border-red-200',
    running: 'text-indigo-700 bg-indigo-50 border-indigo-200',
    queued: 'text-slate-700 bg-slate-50 border-slate-200',
  }
  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-600 text-[12px]">
          <tr>
            <th className="text-left px-3 py-2">ID</th>
            <th className="text-left px-3 py-2">모드</th>
            <th className="text-left px-3 py-2">상태</th>
            <th className="text-right px-3 py-2">진행률</th>
            <th className="text-left px-3 py-2">에러</th>
            <th className="text-left px-3 py-2">업데이트</th>
          </tr>
        </thead>
        <tbody>
          {jobs.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-slate-400 py-6">
                데이터 없음
              </td>
            </tr>
          )}
          {jobs.map((j) => (
            <tr key={j.id} className="border-t border-slate-100 hover:bg-slate-50">
              <td className="px-3 py-2 font-mono text-[11px]">{j.id.slice(0, 8)}</td>
              <td className="px-3 py-2 text-[12px]">{j.mode}</td>
              <td className="px-3 py-2">
                <span
                  className={`text-[11px] px-2 py-0.5 rounded-full border ${
                    statusColor[j.status] ?? 'text-slate-700 bg-slate-50 border-slate-200'
                  }`}
                >
                  {j.status}
                </span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[12px]">{j.progress}%</td>
              <td className="px-3 py-2 text-[11px] text-red-600 max-w-[240px] truncate">
                {j.errorMessage ?? ''}
              </td>
              <td className="px-3 py-2 text-[12px] text-slate-500">
                {new Date(j.updatedAt).toLocaleString('ko-KR')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
