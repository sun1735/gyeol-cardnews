'use client'

import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import type { BackgroundTemplate, Brand, CardData, Layout, SizePreset } from '@/lib/types'

type ReelTransition = 'fade' | 'slide' | 'zoom'

const SIZE_PX: Record<SizePreset, { w: number; h: number; display: number }> = {
  '1:1': { w: 1080, h: 1080, display: 360 },
  '4:5': { w: 1080, h: 1350, display: 340 },
  '9:16': { w: 1080, h: 1920, display: 280 },
}

const SIZE_LABELS: Record<SizePreset, string> = {
  '1:1': '정사각',
  '4:5': '세로',
  '9:16': '스토리',
}

interface ManualInput {
  title: string
  body: string
  subtext: string
  cta: string
}

function emptyManual(): ManualInput {
  return { title: '', body: '', subtext: '', cta: '' }
}

function randId() {
  return Math.random().toString(36).slice(2, 10)
}

// 단계 7: 파일명 규칙 — 브랜드명_YYYYMMDD_NN.png / 브랜드명_YYYYMMDD.zip
function safeBrandName(name: string | undefined) {
  if (!name) return '결'
  // Windows·macOS 공통으로 파일명에 부적절한 문자 + 공백 제거
  const cleaned = name.replace(/[\\/:*?"<>|\s]+/g, '')
  return cleaned || '결'
}

function todayStamp() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

function pngFilename(brand: string | undefined, index: number) {
  return `${safeBrandName(brand)}_${todayStamp()}_${String(index + 1).padStart(2, '0')}.png`
}

function zipFilename(brand: string | undefined) {
  return `${safeBrandName(brand)}_${todayStamp()}.zip`
}

export default function Page() {
  const [mode, setMode] = useState<'auto' | 'manual'>('auto')
  const [size, setSize] = useState<SizePreset>('1:1')
  const [count, setCount] = useState(3)
  const [prompt, setPrompt] = useState('')
  const [manual, setManual] = useState<ManualInput[]>(
    Array.from({ length: 5 }, emptyManual)
  )
  const [cards, setCards] = useState<CardData[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [showBrandPanel, setShowBrandPanel] = useState(false)
  const [healthStatus, setHealthStatus] = useState<string>('확인 중…')
  const [backgrounds, setBackgrounds] = useState<BackgroundTemplate[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  // 단계 10: 릴스 내보내기
  const [reelTransition, setReelTransition] = useState<ReelTransition>('fade')
  const [reelDuration, setReelDuration] = useState(3)
  const [isExportingReel, setIsExportingReel] = useState(false)
  const [lastReelUrl, setLastReelUrl] = useState<string | null>(null)

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === selectedBrandId),
    [brands, selectedBrandId]
  )

  async function loadBrands() {
    try {
      const r = await fetch('/api/brands').then((r) => r.json())
      setBrands(r.brands ?? [])
    } catch {
      setBrands([])
    }
  }

  async function checkHealth() {
    try {
      const r = await fetch('/health').then((r) => r.json())
      setHealthStatus(`${r.status} · DB ${r.db}`)
    } catch {
      setHealthStatus('backend 연결 실패')
    }
  }

  async function loadBackgrounds() {
    try {
      const r = await fetch('/api/backgrounds').then((r) => r.json())
      setBackgrounds(r.backgrounds ?? [])
    } catch {
      setBackgrounds([])
    }
  }

  useEffect(() => {
    loadBrands()
    checkHealth()
    loadBackgrounds()
  }, [])

  async function handleGenerate() {
    setIsGenerating(true)
    try {
      const body =
        mode === 'auto'
          ? {
              mode: 'auto',
              prompt,
              count,
              brandId: selectedBrandId || undefined,
            }
          : {
              mode: 'manual',
              cards: manual.slice(0, count).map((m) => ({
                title: m.title,
                body: m.body,
                subtext: m.subtext,
                cta: m.cta,
              })),
              brandId: selectedBrandId || undefined,
            }
      const r = await fetch('/api/generate/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json())
      const newCards: CardData[] = r.cards ?? []
      setCards(newCards)
      setSelectedCardId(newCards[0]?.id ?? null)
    } finally {
      setIsGenerating(false)
    }
  }

  function updateCard(id: string, patch: Partial<CardData>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function addCard() {
    setCards((prev) => {
      if (prev.length >= 5) return prev
      const layout: Layout = prev.length === 0 ? 'cover' : 'content'
      const newCard: CardData = {
        id: randId(),
        title: '',
        body: '',
        subtext: '',
        cta: '',
        imageUrl: backgrounds.find((b) => b.key === 'calm')?.url,
        layout,
      }
      setSelectedCardId(newCard.id)
      setTimeout(() => {
        document.getElementById(`card-item-${newCard.id}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        })
      }, 50)
      return [...prev, newCard]
    })
  }

  function deleteCard(id: string) {
    setCards((prev) => {
      const next = prev.filter((c) => c.id !== id)
      if (selectedCardId === id) setSelectedCardId(next[0]?.id ?? null)
      return next
    })
  }

  function moveCard(id: string, delta: -1 | 1) {
    setCards((prev) => {
      const idx = prev.findIndex((c) => c.id === id)
      if (idx < 0) return prev
      const newIdx = idx + delta
      if (newIdx < 0 || newIdx >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[newIdx]] = [next[newIdx], next[idx]]
      return next
    })
  }

  function updateManual(i: number, patch: Partial<ManualInput>) {
    setManual((prev) => {
      const next = [...prev]
      next[i] = { ...(next[i] ?? emptyManual()), ...patch }
      return next
    })
  }

  async function handleCardImageUpload(id: string, file: File) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('consent', 'true') // 업로드 권리 고지 동의 — 업로드 UI 의 안내 문구로 설명됨
    const r = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
    if (r.url) updateCard(id, { imageUrl: r.url })
  }

  async function downloadPng(cardId: string, index: number) {
    const mod = await import('html-to-image')
    const node = document.getElementById(`card-${cardId}`)
    if (!node) return
    const d = SIZE_PX[size]
    // 출력 해상도: 1:1 → 1080×1080, 4:5 → 1080×1350, 9:16 → 1080×1920 (±1px rounding)
    const pixelRatio = d.w / d.display
    const dataUrl = await mod.toPng(node, { pixelRatio, cacheBust: true })
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = pngFilename(selectedBrand?.name, index)
    a.click()
  }

  // 단계 10: 9:16 MP4 릴스 내보내기
  async function exportReel() {
    if (cards.length < 2) {
      alert('릴스 생성에는 최소 2장의 카드가 필요합니다.')
      return
    }
    setIsExportingReel(true)
    setLastReelUrl(null)
    const previousSize = size
    const needsSwitch = size !== '9:16'
    try {
      if (needsSwitch) {
        // 9:16 로 강제 전환 후 DOM commit + 페인트 완료 대기
        flushSync(() => setSize('9:16'))
        await new Promise<void>((r) =>
          requestAnimationFrame(() => requestAnimationFrame(() => r())),
        )
      }

      const mod = await import('html-to-image')
      const d = SIZE_PX['9:16']
      const pixelRatio = d.w / d.display

      const frames: string[] = []
      for (const c of cards) {
        const node = document.getElementById(`card-${c.id}`)
        if (!node) continue
        const dataUrl = await mod.toPng(node, { pixelRatio, cacheBust: true })
        frames.push(dataUrl)
      }
      if (frames.length < 2) throw new Error('프레임 렌더 실패')

      const res = await fetch('/api/reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frames,
          transition: reelTransition,
          durationPerCard: reelDuration,
          brandName: selectedBrand?.name,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({} as any))
        throw new Error(`HTTP ${res.status} · ${j?.message ?? '서버 오류'}`)
      }
      const j = await res.json()
      setLastReelUrl(j.url)
      // 자동 다운로드
      const a = document.createElement('a')
      a.href = j.url
      a.download = j.filename
      a.click()
    } catch (e: any) {
      alert(`릴스 생성 실패: ${e?.message ?? e}`)
    } finally {
      if (needsSwitch) setSize(previousSize)
      setIsExportingReel(false)
    }
  }

  async function downloadZip() {
    if (!cards.length) return
    setIsExporting(true)
    try {
      const [{ toPng }, JSZipMod] = await Promise.all([
        import('html-to-image'),
        import('jszip'),
      ])
      const zip = new JSZipMod.default()
      const d = SIZE_PX[size]
      const pixelRatio = d.w / d.display
      const brandName = selectedBrand?.name
      for (let i = 0; i < cards.length; i++) {
        const c = cards[i]
        const node = document.getElementById(`card-${c.id}`)
        if (!node) continue
        const dataUrl = await toPng(node, { pixelRatio, cacheBust: true })
        const b64 = dataUrl.split(',')[1]
        zip.file(pngFilename(brandName, i), b64, { base64: true })
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = zipFilename(brandName)
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setIsExporting(false)
    }
  }

  // ===== 브랜드 관리 =====
  const [newBrand, setNewBrand] = useState({
    name: '',
    tone: '',
    defaultPhrase: '',
    primaryColor: '#0f766e',
    secondaryColor: '#f0fdfa',
    textColor: '#111827',
    fontFamily: 'Pretendard, sans-serif',
    assets: [] as { url: string; caption: string; kind: string }[],
  })

  async function uploadBrandImage(file: File) {
    const fd = new FormData()
    fd.append('file', file)
    fd.append('consent', 'true') // 업로드 권리 고지 동의
    const r = await fetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
    if (r.url) {
      setNewBrand((prev) => ({
        ...prev,
        assets: [...prev.assets, { url: r.url, caption: '', kind: 'image' }],
      }))
    }
  }

  async function saveBrand() {
    if (!newBrand.name.trim()) {
      alert('브랜드 이름을 입력해 주세요.')
      return
    }
    const res = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBrand),
    })
    if (!res.ok) {
      alert('저장 실패 (같은 이름이 이미 있을 수 있어요)')
      return
    }
    setNewBrand({
      name: '',
      tone: '',
      defaultPhrase: '',
      primaryColor: '#0f766e',
      secondaryColor: '#f0fdfa',
      textColor: '#111827',
      fontFamily: 'Pretendard, sans-serif',
      assets: [],
    })
    await loadBrands()
  }

  async function deleteBrand(id: string) {
    if (!confirm('이 브랜드를 삭제할까요?')) return
    await fetch(`/api/brands/${id}`, { method: 'DELETE' })
    if (selectedBrandId === id) setSelectedBrandId('')
    await loadBrands()
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">결 · 카드뉴스 생성기</h1>
          <p className="text-sm text-slate-500">
            브랜드 톤앤매너에 맞춘 1~5장 카드뉴스 MVP ·{' '}
            <span className="font-mono">{healthStatus}</span>
          </p>
        </div>
        <button
          onClick={() => setShowBrandPanel((s) => !s)}
          className="px-3 py-2 rounded-md border border-slate-300 hover:bg-slate-100 text-sm"
        >
          {showBrandPanel ? '브랜드 패널 닫기' : '브랜드 관리'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6">
        <section className="space-y-4">
          <div className="bg-white rounded-xl border p-4 space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">브랜드 카테고리</label>
              <select
                value={selectedBrandId}
                onChange={(e) => setSelectedBrandId(e.target.value)}
                className="w-full border rounded-md px-2 py-2 text-sm"
              >
                <option value="">(선택 없음)</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setMode('auto')}
                className={`flex-1 px-3 py-2 rounded-md text-sm border ${
                  mode === 'auto' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'
                }`}
              >
                프롬프트 자동 생성
              </button>
              <button
                onClick={() => setMode('manual')}
                className={`flex-1 px-3 py-2 rounded-md text-sm border ${
                  mode === 'manual' ? 'bg-slate-900 text-white border-slate-900' : 'bg-white'
                }`}
              >
                카드별 수동 입력
              </button>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">사이즈 프리셋</label>
              <div className="grid grid-cols-3 gap-1">
                {(['1:1', '4:5', '9:16'] as SizePreset[]).map((p) => (
                  <button
                    key={p}
                    onClick={() => setSize(p)}
                    className={`px-1 py-1.5 rounded-md text-xs border leading-tight transition ${
                      size === p
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className="block font-semibold">{p}</span>
                    <span className="block text-[10px] opacity-75">{SIZE_LABELS[p]}</span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                전환 시 모든 카드 프리뷰가 즉시 새 비율로 다시 렌더됩니다.
              </p>
            </div>

            <div>
              <label className="block text-xs text-slate-500 mb-1">카드 수 (생성 시)</label>
              <input
                type="number"
                min={1}
                max={5}
                value={count}
                onChange={(e) =>
                  setCount(Math.max(1, Math.min(5, Number(e.target.value) || 1)))
                }
                className="w-full border rounded-md px-2 py-2 text-sm"
              />
            </div>

            {mode === 'auto' ? (
              <div>
                <label className="block text-sm font-medium mb-1">프롬프트</label>
                <textarea
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="예) 유순 임산부와 유아를 위한 케어 서비스 안내"
                  className="w-full border rounded-md px-2 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">
                  과장·의학적 단정 표현은 자동으로 완화됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                <p className="text-xs text-slate-500">
                  비워둔 필드는 브랜드·레이아웃 기반으로 자동 채워집니다.
                </p>
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="border rounded-md p-2 bg-slate-50 space-y-1">
                    <div className="text-xs text-slate-500">카드 {i + 1}</div>
                    <input
                      className="w-full border rounded-md px-2 py-1 text-sm"
                      placeholder="제목 (title)"
                      value={manual[i]?.title ?? ''}
                      onChange={(e) => updateManual(i, { title: e.target.value })}
                    />
                    <textarea
                      rows={2}
                      className="w-full border rounded-md px-2 py-1 text-sm"
                      placeholder="본문 (body)"
                      value={manual[i]?.body ?? ''}
                      onChange={(e) => updateManual(i, { body: e.target.value })}
                    />
                    <div className="grid grid-cols-2 gap-1">
                      <input
                        className="border rounded-md px-2 py-1 text-sm"
                        placeholder="서브텍스트 (subtext)"
                        value={manual[i]?.subtext ?? ''}
                        onChange={(e) => updateManual(i, { subtext: e.target.value })}
                      />
                      <input
                        className="border rounded-md px-2 py-1 text-sm"
                        placeholder="CTA"
                        value={manual[i]?.cta ?? ''}
                        onChange={(e) => updateManual(i, { cta: e.target.value })}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              disabled={isGenerating}
              onClick={handleGenerate}
              className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
            >
              {isGenerating ? '생성 중…' : '카드 생성'}
            </button>
          </div>

          {cards.length > 0 && (
            <div className="bg-white rounded-xl border p-4 space-y-2">
              <button
                onClick={downloadZip}
                disabled={isExporting}
                className="w-full bg-slate-900 hover:bg-black text-white rounded-md py-2 text-sm disabled:opacity-60"
              >
                {isExporting ? '내보내는 중…' : `전체 ZIP 다운로드 (${cards.length}장)`}
              </button>
              <div className="text-[11px] text-slate-500 space-y-0.5 font-mono">
                <div>📦 <span className="text-slate-700">{zipFilename(selectedBrand?.name)}</span></div>
                <div>🖼 <span className="text-slate-700">
                  {pngFilename(selectedBrand?.name, 0)} … {pngFilename(selectedBrand?.name, cards.length - 1)}
                </span></div>
                <div className="text-slate-400">
                  해상도 {SIZE_PX[size].w}×{SIZE_PX[size].h} · {size}
                </div>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                카드별 PNG는 각 카드 아래 "PNG 다운로드" 버튼으로 받을 수 있어요.
              </p>
            </div>
          )}

          {cards.length >= 2 && (
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="text-sm font-medium flex items-center gap-2">
                🎬 릴스 내보내기 <span className="text-xs text-slate-400 font-normal">9:16 MP4</span>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">전환 효과</label>
                <div className="grid grid-cols-3 gap-1">
                  {(['fade', 'slide', 'zoom'] as ReelTransition[]).map((t) => {
                    const ko = t === 'fade' ? '페이드' : t === 'slide' ? '슬라이드' : '줌'
                    return (
                      <button
                        key={t}
                        onClick={() => setReelTransition(t)}
                        className={`px-1 py-1.5 rounded-md text-xs border leading-tight ${
                          reelTransition === t
                            ? 'bg-rose-700 text-white border-rose-700'
                            : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        <span className="block font-semibold">{ko}</span>
                        <span className="block text-[10px] opacity-75">{t}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">
                  카드당 {reelDuration}초 · 총 약{' '}
                  <span className="font-semibold text-slate-700">
                    {Math.round((cards.length * reelDuration - (cards.length - 1) * 0.5) * 10) / 10}초
                  </span>
                </label>
                <input
                  type="range"
                  min={2}
                  max={5}
                  step={0.5}
                  value={reelDuration}
                  onChange={(e) => setReelDuration(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>2s</span><span>3s</span><span>4s</span><span>5s</span>
                </div>
              </div>

              <button
                onClick={exportReel}
                disabled={isExportingReel}
                className="w-full bg-rose-700 hover:bg-rose-800 text-white rounded-md py-2 text-sm font-medium disabled:opacity-60"
              >
                {isExportingReel ? '🎬 렌더링 중… (수초~수십초)' : '🎬 릴스 MP4 내보내기'}
              </button>

              {lastReelUrl && (
                <div className="border rounded-md overflow-hidden bg-black">
                  <video src={lastReelUrl} controls className="w-full h-auto" />
                  <a
                    href={lastReelUrl}
                    download
                    className="block text-center text-xs py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700"
                  >
                    ⬇ 다시 다운로드
                  </a>
                </div>
              )}

              <p className="text-[10px] text-slate-400 leading-relaxed">
                {size === '9:16'
                  ? '현재 9:16 프리뷰 그대로 렌더합니다.'
                  : `현재 프리뷰(${size})가 아닌 9:16 로 자동 전환 후 렌더, 완료 시 복귀.`}
                {' · '}
                카드 수정 후 다시 버튼을 누르면 최신 상태로 재렌더됩니다.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          {cards.length === 0 ? (
            <div className="bg-white rounded-xl border p-12 text-center text-slate-500">
              왼쪽에서 프롬프트나 수동 입력을 작성한 뒤 <b>카드 생성</b>을 눌러주세요.
            </div>
          ) : (
            <>
              {/* 단계 6: 카드 리스트 / 현재 카드 선택 */}
              <div className="bg-white rounded-xl border p-3 flex items-center gap-2 overflow-x-auto sticky top-2 z-10">
                <span className="text-xs text-slate-500 flex-shrink-0 font-medium pr-1">
                  카드 리스트
                </span>
                {cards.map((c, i) => (
                  <button
                    key={c.id}
                    onClick={() => {
                      setSelectedCardId(c.id)
                      document.getElementById(`card-item-${c.id}`)?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start',
                      })
                    }}
                    className={`relative flex-shrink-0 w-14 h-14 rounded-md border-2 overflow-hidden transition ${
                      selectedCardId === c.id
                        ? 'border-teal-600 ring-2 ring-teal-200'
                        : 'border-slate-200 hover:border-slate-400'
                    }`}
                    title={c.title || `카드 ${i + 1}`}
                  >
                    {c.imageUrl ? (
                      <img src={c.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div
                        className="w-full h-full"
                        style={{
                          background: `linear-gradient(135deg, ${
                            selectedBrand?.primaryColor ?? '#0f766e'
                          }33, ${selectedBrand?.primaryColor ?? '#0f766e'}cc)`,
                        }}
                      />
                    )}
                    <span className="absolute bottom-0 left-0 right-0 text-[10px] bg-black/55 text-white font-bold py-0.5">
                      {i + 1}
                    </span>
                  </button>
                ))}
                {cards.length < 5 && (
                  <button
                    onClick={addCard}
                    className="flex-shrink-0 w-14 h-14 rounded-md border-2 border-dashed border-slate-300 hover:border-teal-500 hover:text-teal-700 text-slate-400 flex items-center justify-center text-2xl transition"
                    title="카드 추가 (최대 5장)"
                  >
                    ＋
                  </button>
                )}
                <span className="ml-auto text-xs text-slate-400 flex-shrink-0 pr-1">
                  {cards.length} / 5
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {cards.map((c, idx) => (
                  <CardItem
                    key={c.id}
                    index={idx}
                    total={cards.length}
                    card={c}
                    brand={selectedBrand}
                    size={size}
                    backgrounds={backgrounds}
                    selected={selectedCardId === c.id}
                    onSelect={() => setSelectedCardId(c.id)}
                    onChange={(patch) => updateCard(c.id, patch)}
                    onImageFile={(f) => handleCardImageUpload(c.id, f)}
                    onDownload={() => downloadPng(c.id, idx)}
                    onMoveUp={() => moveCard(c.id, -1)}
                    onMoveDown={() => moveCard(c.id, 1)}
                    onDelete={() => deleteCard(c.id)}
                  />
                ))}
                {cards.length < 5 && (
                  <button
                    onClick={addCard}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-teal-500 hover:text-teal-700 transition min-h-[360px]"
                  >
                    <div className="text-5xl mb-2 leading-none">＋</div>
                    <div className="text-sm">카드 추가</div>
                    <div className="text-xs text-slate-400 mt-1">최대 5장</div>
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {showBrandPanel && (
        <section className="mt-8 bg-white rounded-xl border p-4">
          <h2 className="text-lg font-semibold mb-3">브랜드 카테고리 관리</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-medium">새 브랜드</h3>
              <input
                className="w-full border rounded-md px-2 py-2 text-sm"
                placeholder="브랜드 이름 (예: 유순)"
                value={newBrand.name}
                onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
              />
              <input
                className="w-full border rounded-md px-2 py-2 text-sm"
                placeholder="톤앤매너 (예: 따뜻하고 진솔한)"
                value={newBrand.tone}
                onChange={(e) => setNewBrand({ ...newBrand, tone: e.target.value })}
              />
              <input
                className="w-full border rounded-md px-2 py-2 text-sm"
                placeholder="기본 문구 (예: 오늘도 평안한 하루)"
                value={newBrand.defaultPhrase}
                onChange={(e) => setNewBrand({ ...newBrand, defaultPhrase: e.target.value })}
              />
              <div className="grid grid-cols-3 gap-2">
                <label className="text-xs text-slate-500">
                  주색
                  <input
                    type="color"
                    value={newBrand.primaryColor}
                    onChange={(e) =>
                      setNewBrand({ ...newBrand, primaryColor: e.target.value })
                    }
                    className="w-full h-9 border rounded-md"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  배경
                  <input
                    type="color"
                    value={newBrand.secondaryColor}
                    onChange={(e) =>
                      setNewBrand({ ...newBrand, secondaryColor: e.target.value })
                    }
                    className="w-full h-9 border rounded-md"
                  />
                </label>
                <label className="text-xs text-slate-500">
                  글자
                  <input
                    type="color"
                    value={newBrand.textColor}
                    onChange={(e) => setNewBrand({ ...newBrand, textColor: e.target.value })}
                    className="w-full h-9 border rounded-md"
                  />
                </label>
              </div>
              <input
                className="w-full border rounded-md px-2 py-2 text-sm"
                placeholder="폰트 (예: Pretendard, sans-serif)"
                value={newBrand.fontFamily}
                onChange={(e) => setNewBrand({ ...newBrand, fontFamily: e.target.value })}
              />
              <div>
                <label className="inline-block cursor-pointer border rounded-md px-3 py-2 text-sm bg-slate-50 hover:bg-slate-100">
                  보유 이미지 업로드
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) uploadBrandImage(f)
                      e.target.value = ''
                    }}
                  />
                </label>
                <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                  업로드 시 본인 저작권/사용권 보유에 동의한 것으로 간주됩니다. 제3자의 초상권·저작권 침해 책임은 업로더에게 있습니다.
                </p>
                <div className="flex gap-2 mt-2 flex-wrap">
                  {newBrand.assets.map((img, i) => (
                    <div key={i} className="relative">
                      <img
                        src={img.url}
                        alt=""
                        className="w-16 h-16 object-cover rounded-md border"
                      />
                      <button
                        onClick={() =>
                          setNewBrand((prev) => ({
                            ...prev,
                            assets: prev.assets.filter((_, j) => j !== i),
                          }))
                        }
                        className="absolute -top-2 -right-2 bg-white border rounded-full w-5 h-5 text-xs"
                        title="제거"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={saveBrand}
                className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-md py-2 text-sm"
              >
                브랜드 저장
              </button>
            </div>

            <div>
              <h3 className="text-sm font-medium mb-2">저장된 브랜드</h3>
              <ul className="space-y-2">
                {brands.length === 0 && (
                  <li className="text-sm text-slate-500">아직 저장된 브랜드가 없어요.</li>
                )}
                {brands.map((b) => (
                  <li
                    key={b.id}
                    className="border rounded-md p-2 flex items-center justify-between"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{b.name}</div>
                      <div className="text-xs text-slate-500 truncate">
                        {b.tone || '—'} · 이미지 {b.assets.length}장
                      </div>
                      <div className="flex gap-1 mt-1">
                        <span
                          className="inline-block w-4 h-4 rounded-sm border"
                          style={{ background: b.primaryColor }}
                        />
                        <span
                          className="inline-block w-4 h-4 rounded-sm border"
                          style={{ background: b.secondaryColor }}
                        />
                        <span
                          className="inline-block w-4 h-4 rounded-sm border"
                          style={{ background: b.textColor }}
                        />
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button
                        onClick={() => setSelectedBrandId(b.id)}
                        className={`text-xs px-2 py-1 border rounded-md ${
                          selectedBrandId === b.id ? 'bg-slate-900 text-white' : ''
                        }`}
                      >
                        {selectedBrandId === b.id ? '선택됨' : '선택'}
                      </button>
                      <button
                        onClick={() => deleteBrand(b.id)}
                        className="text-xs px-2 py-1 border rounded-md text-red-600"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}
    </main>
  )
}

function CardItem({
  card,
  brand,
  size,
  index,
  total,
  backgrounds,
  selected,
  onSelect,
  onChange,
  onImageFile,
  onDownload,
  onMoveUp,
  onMoveDown,
  onDelete,
}: {
  card: CardData
  brand?: Brand
  size: SizePreset
  index: number
  total: number
  backgrounds: BackgroundTemplate[]
  selected: boolean
  onSelect: () => void
  onChange: (patch: Partial<CardData>) => void
  onImageFile: (f: File) => void
  onDownload: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}) {
  const d = SIZE_PX[size]
  const ratio = d.display / d.w
  const height = Math.round(d.h * ratio)
  const primary = brand?.primaryColor ?? '#0f766e'
  const bg = brand?.secondaryColor ?? '#f0fdfa'
  const text = brand?.textColor ?? '#111827'
  const font = brand?.fontFamily ?? 'Pretendard, sans-serif'

  const isCover = card.layout === 'cover'
  const onImage = !!card.imageUrl && isCover
  const titleSize = isCover ? Math.round(d.display * 0.08) : Math.round(d.display * 0.062)
  const bodySize = Math.round(d.display * 0.042)
  const subtextSize = Math.round(d.display * 0.036)
  const ctaSize = Math.round(d.display * 0.04)
  const pad = Math.round(d.display * 0.08)

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      id={`card-item-${card.id}`}
      onClick={onSelect}
      className={`border rounded-xl bg-white p-3 space-y-2 transition cursor-pointer ${
        selected ? 'ring-2 ring-teal-500 border-teal-400' : 'hover:border-slate-300'
      }`}
    >
      {/* 헤더: 순서 · 이동/삭제 · 레이아웃 선택 */}
      <div className="flex items-center justify-between text-xs gap-2">
        <div className="flex items-center gap-1 flex-wrap text-slate-500">
          <span className="font-semibold text-slate-900">{index + 1} / {total}</span>
          <button
            onClick={(e) => { stop(e); onMoveUp() }}
            disabled={index === 0}
            className="px-1.5 py-0.5 border rounded disabled:opacity-30 hover:bg-slate-50"
            title="위로"
          >
            ↑
          </button>
          <button
            onClick={(e) => { stop(e); onMoveDown() }}
            disabled={index === total - 1}
            className="px-1.5 py-0.5 border rounded disabled:opacity-30 hover:bg-slate-50"
            title="아래로"
          >
            ↓
          </button>
          <button
            onClick={(e) => {
              stop(e)
              if (confirm('이 카드를 삭제할까요?')) onDelete()
            }}
            className="px-1.5 py-0.5 border rounded text-red-600 hover:bg-red-50"
            title="삭제"
          >
            삭제
          </button>
        </div>
        <select
          value={card.layout}
          onChange={(e) => onChange({ layout: e.target.value as Layout })}
          onClick={stop}
          className="text-xs border rounded px-1 py-0.5 bg-white uppercase"
          title="레이아웃"
        >
          <option value="cover">cover</option>
          <option value="content">content</option>
          <option value="cta">cta</option>
        </select>
      </div>

      {/* 카드 프리뷰 (렌더 대상) */}
      <div className="flex justify-center">
        <div
          id={`card-${card.id}`}
          className="relative overflow-hidden rounded-md shadow-sm"
          style={{
            width: d.display,
            height,
            background: bg,
            color: text,
            fontFamily: font,
          }}
        >
          {card.imageUrl ? (
            <img
              src={card.imageUrl}
              alt=""
              crossOrigin="anonymous"
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: isCover ? 0.9 : 0.35,
              }}
            />
          ) : (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `linear-gradient(135deg, ${primary}1A, ${primary}80)`,
              }}
            />
          )}

          {onImage && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,0.6) 100%)',
              }}
            />
          )}

          <div
            style={{
              position: 'absolute',
              inset: 0,
              padding: pad,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: isCover ? 'flex-end' : 'center',
              gap: Math.round(d.display * 0.018),
            }}
          >
            {card.subtext && (
              <div
                style={{
                  fontSize: subtextSize,
                  fontWeight: 500,
                  letterSpacing: '0.04em',
                  color: onImage ? '#e2e8f0' : primary,
                }}
              >
                {card.subtext}
              </div>
            )}
            <div
              style={{
                fontSize: titleSize,
                fontWeight: 800,
                color: onImage ? '#ffffff' : text,
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
              }}
            >
              {card.title || ' '}
            </div>
            {card.body && (
              <div
                style={{
                  fontSize: bodySize,
                  lineHeight: 1.65,
                  color: onImage ? '#f8fafc' : text,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {card.body}
              </div>
            )}
            {card.cta && (
              <div
                style={{
                  alignSelf: 'flex-start',
                  marginTop: Math.round(d.display * 0.015),
                  fontSize: ctaSize,
                  fontWeight: 600,
                  color: onImage ? primary : '#ffffff',
                  background: onImage ? '#ffffff' : primary,
                  padding: `${Math.round(d.display * 0.018)}px ${Math.round(d.display * 0.038)}px`,
                  borderRadius: Math.round(d.display * 0.015),
                }}
              >
                {card.cta}
              </div>
            )}
          </div>

          <div
            style={{
              position: 'absolute',
              left: Math.round(d.display * 0.04),
              top: Math.round(d.display * 0.04),
              fontSize: Math.round(d.display * 0.03),
              padding: `${Math.round(d.display * 0.01)}px ${Math.round(d.display * 0.02)}px`,
              background: primary,
              color: '#fff',
              borderRadius: 4,
              fontWeight: 600,
            }}
          >
            {index + 1} / {total}
          </div>
        </div>
      </div>

      {/* 인라인 텍스트 편집 — 입력 즉시 프리뷰 반영 */}
      <input
        className="w-full border rounded-md px-2 py-1 text-sm"
        value={card.title}
        onChange={(e) => onChange({ title: e.target.value })}
        onClick={stop}
        placeholder="제목 (title)"
      />
      <textarea
        rows={3}
        className="w-full border rounded-md px-2 py-1 text-sm"
        value={card.body}
        onChange={(e) => onChange({ body: e.target.value })}
        onClick={stop}
        placeholder="본문 (body)"
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="border rounded-md px-2 py-1 text-sm"
          value={card.subtext}
          onChange={(e) => onChange({ subtext: e.target.value })}
          onClick={stop}
          placeholder="서브텍스트 (subtext)"
        />
        <input
          className="border rounded-md px-2 py-1 text-sm"
          value={card.cta}
          onChange={(e) => onChange({ cta: e.target.value })}
          onClick={stop}
          placeholder="CTA"
        />
      </div>

      <div className="flex gap-2 items-center flex-wrap">
        <label
          onClick={stop}
          className="text-xs px-2 py-1 border rounded-md cursor-pointer bg-slate-50 hover:bg-slate-100"
        >
          이미지 교체/추가
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImageFile(f)
              e.target.value = ''
            }}
          />
        </label>
        {card.imageUrl && (
          <button
            onClick={(e) => { stop(e); onChange({ imageUrl: undefined }) }}
            className="text-xs px-2 py-1 border rounded-md"
          >
            이미지 제거
          </button>
        )}
        <button
          onClick={(e) => { stop(e); onDownload() }}
          className="text-xs px-2 py-1 border rounded-md ml-auto bg-slate-900 text-white"
        >
          PNG 다운로드
        </button>
      </div>

      {backgrounds.length > 0 && (
        <div className="flex gap-1.5 items-center flex-wrap pt-1">
          <span className="text-xs text-slate-500 mr-1">기본 배경:</span>
          {backgrounds.map((bgItem) => {
            const active = card.imageUrl === bgItem.url
            return (
              <button
                key={bgItem.key}
                title={bgItem.label}
                onClick={(e) => { stop(e); onChange({ imageUrl: bgItem.url }) }}
                className={`w-6 h-6 rounded-full border transition ${
                  active ? 'ring-2 ring-slate-900 scale-110' : 'hover:scale-110'
                }`}
                style={{
                  background: `linear-gradient(135deg, ${bgItem.palette[0]}, ${bgItem.palette[1]})`,
                }}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
