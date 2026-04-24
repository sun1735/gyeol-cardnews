'use client'

import { useEffect, useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { signIn, signOut, useSession } from 'next-auth/react'
import type { BackgroundTemplate, Brand, CardData, Layout, SizePreset, Template } from '@/lib/types'
// LayoutRenderer 가 product-ad/promo 렌더링을 전담. DynamicCard 는 layoutDsl 없는 레거시 카드용 fallback.
// ProductAdCard/PromoCard (구 고정 템플릿) 는 더 이상 렌더 경로에 사용되지 않음.
import { DynamicCard } from '@/components/templates/DynamicCard'
import { LayoutRenderer } from '@/components/LayoutRenderer'
import { TEMPLATES } from '@/components/templates/registry'
import { TemplatePreview } from '@/components/templates/TemplatePreview'
import { Landing } from '@/components/Landing'

// 인증 세션의 API 토큰을 모든 /api/* fetch 에 자동으로 실어 보내는 래퍼.
// NextAuth session.apiToken 이 있으면 Authorization 헤더에 추가.
function useAuthedFetch() {
  const { data: session } = useSession()
  const apiToken = (session as any)?.apiToken as string | undefined
  return (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (apiToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${apiToken}`)
    }
    return fetch(input, { ...init, headers })
  }
}

type ReelTransition = 'fade' | 'slide' | 'zoom'

const SIZE_PX: Record<Exclude<SizePreset, 'custom'>, { w: number; h: number; display: number }> = {
  '1:1': { w: 1080, h: 1080, display: 360 },
  '4:5': { w: 1080, h: 1350, display: 340 },
  '9:16': { w: 1080, h: 1920, display: 280 },
}

const SIZE_LABELS: Record<SizePreset, string> = {
  '1:1': '정사각',
  '4:5': '인스타 피드',
  '9:16': '릴스 · 스토리',
  custom: '배너 · 자유',
}

const SIZE_SUBLABELS: Record<SizePreset, string> = {
  '1:1': '1080×1080',
  '4:5': '1080×1350',
  '9:16': '1080×1920',
  custom: '직접 입력',
}

// custom 프리셋에서 실제 크기 계산 — display 폭은 360 상한으로 비율 유지.
function resolveSizePx(
  preset: SizePreset,
  custom: { w: number; h: number },
): { w: number; h: number; display: number } {
  if (preset !== 'custom') return SIZE_PX[preset]
  const w = Math.max(200, Math.min(4000, Math.floor(custom.w) || 1080))
  const h = Math.max(200, Math.min(4000, Math.floor(custom.h) || 1080))
  const display = w >= h ? 360 : Math.round((360 * w) / h)
  return { w, h, display }
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
  if (!name) return 'Note2Card'
  // Windows·macOS 공통으로 파일명에 부적절한 문자 + 공백 제거
  const cleaned = name.replace(/[\\/:*?"<>|\s]+/g, '')
  return cleaned || 'Note2Card'
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

type GenMode = 'auto' | 'manual' | 'note-rag'

export default function Page() {
  const { data: session, status: authStatus } = useSession()
  const authedFetch = useAuthedFetch()
  const isLoggedIn = authStatus === 'authenticated'

  // 사용량 메터 — 로그인 시 /api/quota/me 로 이번 달 카운트 조회.
  // 관리자는 isUnlimited=true → UI 에서 ∞ 표시.
  const [quotaUsage, setQuotaUsage] = useState<{
    plan: string
    role?: string
    isUnlimited?: boolean
    limits: { imageGen: number; textGen: number; ragJob: number; ideaGen: number }
    counts: { imageGen: number; textGen: number; ragJob: number; ideaGen: number }
  } | null>(null)
  useEffect(() => {
    if (!isLoggedIn) {
      setQuotaUsage(null)
      return
    }
    authedFetch('/api/quota/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setQuotaUsage(d))
      .catch(() => {})
  }, [isLoggedIn, session])
  const [mode, setMode] = useState<GenMode>('auto')
  // 카드 템플릿 — basic(기본) / product-ad(상품 광고) / promo(프로모션, 추후).
  const [template, setTemplate] = useState<Template>('basic')
  // requiresNoteRag 인 템플릿은 모드가 note-rag 가 아니면 자동 basic 복귀.
  useEffect(() => {
    const meta = TEMPLATES.find((t) => t.key === template)
    if (meta?.requiresNoteRag && mode !== 'note-rag') setTemplate('basic')
  }, [mode, template])

  // product-ad / promo 는 AI 가 구도까지 설계하므로 카드 수를 1장으로 강제.
  const forceSingleCard = template === 'product-ad' || template === 'promo'
  const [size, setSize] = useState<SizePreset>('1:1')
  const [customSize, setCustomSize] = useState({ w: 1080, h: 1080 })
  // 가로·세로 타이핑 드래프트 — 입력 중에는 clamp 하지 않아 숫자를 자유롭게 타이핑할 수 있다.
  // 커밋(blur 또는 Enter) 시 200~4000 범위로 클램프해서 customSize 에 반영.
  const [customInput, setCustomInput] = useState<{ w: string; h: string }>({ w: '1080', h: '1080' })
  const [count, setCount] = useState(3)
  // forceSingleCard 일 때 count=1 로 강제 (선언 위로 뺄 수 없어 여기서 처리)
  useEffect(() => {
    if (forceSingleCard && count !== 1) setCount(1)
  }, [forceSingleCard, count])
  const [prompt, setPrompt] = useState('')
  const [baseImages, setBaseImages] = useState<string[]>([]) // Mode A — 공통 참조 이미지 1~3장
  const [baseUploading, setBaseUploading] = useState(false)
  const [ragProgress, setRagProgress] = useState<number | null>(null) // 지식노트 기반 비동기 생성 진행률
  const [ragError, setRagError] = useState<string | null>(null)

  // AI 이미지 생성 모달 — window.prompt 대체
  const [aiGenDialog, setAiGenDialog] = useState<{
    cardId: string
    prompt: string
    loading: boolean
    error: string | null
  } | null>(null)

  // 공용 다이얼로그 — 네이티브 confirm/alert 대체
  type DialogVariant = 'default' | 'danger' | 'warning' | 'info' | 'success'
  type DialogState =
    | null
    | {
        type: 'alert' | 'confirm'
        title: string
        message: string
        variant?: DialogVariant
        confirmLabel?: string
        cancelLabel?: string
        resolve: (ok: boolean) => void
      }
  const [dialog, setDialog] = useState<DialogState>(null)

  function openConfirm(opts: {
    title: string
    message: string
    confirmLabel?: string
    cancelLabel?: string
    variant?: DialogVariant
  }): Promise<boolean> {
    return new Promise((resolve) => {
      setDialog({ type: 'confirm', ...opts, resolve })
    })
  }

  function openAlert(opts: {
    title: string
    message: string
    variant?: DialogVariant
    confirmLabel?: string
  }): Promise<void> {
    return new Promise((resolve) => {
      setDialog({ type: 'alert', ...opts, resolve: () => resolve() })
    })
  }

  function closeDialog(result: boolean) {
    if (dialog) dialog.resolve(result)
    setDialog(null)
  }

  // 브랜드 관리 모달 (통합 — 기본정보·지식노트·이미지·아이디어 4탭)
  const [brandModalOpen, setBrandModalOpen] = useState(false)
  const [brandModalTab, setBrandModalTab] = useState<'info' | 'docs' | 'images' | 'ideas'>('info')
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null) // null = 새 브랜드 생성 모드

  // 지식노트 — 선택된 브랜드의 문서·이미지 라이브러리
  const [knowledgeDocs, setKnowledgeDocs] = useState<
    Array<{ id: string; title: string; sourceType: string; chunkCount: number; createdAt: string }>
  >([])
  const [knowledgeImages, setKnowledgeImages] = useState<
    Array<{
      id: string
      url: string
      thumbnailUrl?: string | null
      label: string
      tags: string[]
      qualityScore: number
      width?: number | null
      height?: number | null
      sizeBytes?: number | null
    }>
  >([])
  const [newDocTitle, setNewDocTitle] = useState('')
  const [newDocText, setNewDocText] = useState('')
  const [docSaving, setDocSaving] = useState(false)
  const [newImageLabel, setNewImageLabel] = useState('')
  const [newImageTags, setNewImageTags] = useState('')
  const [imageUploading, setImageUploading] = useState(false)
  const [ideas, setIdeas] = useState<
    Array<{
      id: string
      title: string
      prompt: string
      suggestedCount: number
      reason: string
      usesImages: string[]
    }>
  >([])
  const [ideasLoading, setIdeasLoading] = useState(false)
  const [ideasError, setIdeasError] = useState<string | null>(null)
  const [manual, setManual] = useState<ManualInput[]>(
    Array.from({ length: 5 }, emptyManual)
  )
  const [cards, setCards] = useState<CardData[]>([])
  const [brands, setBrands] = useState<Brand[]>([])
  const [selectedBrandId, setSelectedBrandId] = useState<string>('')
  // showBrandPanel 제거됨 — 브랜드 모달(brandModalOpen) 하나로 통합
  const [isGenerating, setIsGenerating] = useState(false)
  const [healthStatus, setHealthStatus] = useState<string>('확인 중…')
  const [backgrounds, setBackgrounds] = useState<BackgroundTemplate[]>([])
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  // 단계 10: 릴스 내보내기
  const [reelTransition, setReelTransition] = useState<ReelTransition>('fade')
  const [reelDuration, setReelDuration] = useState(3)
  const [reelImageQuality, setReelImageQuality] = useState<number>(0.88)
  const [isExportingReel, setIsExportingReel] = useState(false)
  const [reelStatus, setReelStatus] = useState<string | null>(null)
  const [lastReelUrl, setLastReelUrl] = useState<string | null>(null)

  const selectedBrand = useMemo(
    () => brands.find((b) => b.id === selectedBrandId),
    [brands, selectedBrandId]
  )

  async function loadBrands() {
    try {
      const r = await authedFetch('/api/brands').then((r) => r.json())
      setBrands(r.brands ?? [])
    } catch {
      setBrands([])
    }
  }

  async function checkHealth() {
    try {
      const r = await authedFetch('/health').then((r) => r.json())
      setHealthStatus(`${r.status} · DB ${r.db}`)
    } catch {
      setHealthStatus('backend 연결 실패')
    }
  }

  async function loadBackgrounds() {
    try {
      const r = await authedFetch('/api/backgrounds').then((r) => r.json())
      setBackgrounds(r.backgrounds ?? [])
    } catch {
      setBackgrounds([])
    }
  }

  async function loadKnowledge(brandId: string) {
    try {
      const [d, i, ideasRes] = await Promise.all([
        authedFetch(`/api/knowledge/docs?brandId=${brandId}`).then((r) => r.json()),
        authedFetch(`/api/knowledge/images?brandId=${brandId}`).then((r) => r.json()),
        authedFetch(`/api/knowledge/ideas?brandId=${brandId}`).then((r) => r.json()),
      ])
      setKnowledgeDocs(d?.docs ?? [])
      setKnowledgeImages(i?.images ?? [])
      setIdeas(ideasRes?.ideas ?? [])
    } catch {
      setKnowledgeDocs([])
      setKnowledgeImages([])
      setIdeas([])
    }
  }

  async function createKnowledgeDoc() {
    if (!selectedBrandId || !newDocTitle.trim() || !newDocText.trim()) return
    setDocSaving(true)
    try {
      const r = await authedFetch('/api/knowledge/docs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrandId,
          title: newDocTitle.trim(),
          sourceType: 'note',
          contentText: newDocText,
        }),
      })
      if (r.ok) {
        setNewDocTitle('')
        setNewDocText('')
        await loadKnowledge(selectedBrandId)
      } else {
        const j = await r.json().catch(() => ({}))
        await openAlert({
          title: '문서 저장 실패',
          message: j?.message ?? `HTTP ${r.status}`,
          variant: 'danger',
        })
      }
    } finally {
      setDocSaving(false)
    }
  }

  async function deleteKnowledgeDoc(id: string) {
    if (!selectedBrandId) return
    const ok = await openConfirm({
      title: '문서를 삭제할까요?',
      message: '문서와 함께 관련 청크도 모두 삭제됩니다. 되돌릴 수 없어요.',
      confirmLabel: '삭제',
      variant: 'danger',
    })
    if (!ok) return
    await authedFetch(`/api/knowledge/docs/${id}`, { method: 'DELETE' })
    await loadKnowledge(selectedBrandId)
  }

  async function addKnowledgeImage(file: File) {
    if (!selectedBrandId) return
    setImageUploading(true)
    try {
      // 1) 파일 업로드 → URL
      const fd = new FormData()
      fd.append('file', file)
      fd.append('consent', 'true')
      const up = await authedFetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
      if (!up?.url) {
        await openAlert({
          title: '업로드 실패',
          message: '이미지 파일을 업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.',
          variant: 'danger',
        })
        return
      }
      // 2) knowledge 이미지 에셋 등록 — sharp 메타데이터 그대로 전달 (해시 기반 중복 제거 활용)
      const tags = newImageTags
        .split(/[,，\s]+/)
        .map((t) => t.trim())
        .filter(Boolean)
      const r = await authedFetch('/api/knowledge/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brandId: selectedBrandId,
          url: up.url,
          thumbnailUrl: up.thumbnailUrl ?? undefined,
          label: newImageLabel.trim(),
          tags,
          usageRights: 'owned',
          qualityScore: 0.8,
          width: up.width ?? undefined,
          height: up.height ?? undefined,
          sizeBytes: up.sizeBytes ?? undefined,
          mimeType: up.mimeType ?? undefined,
          sha256: up.sha256 ?? undefined,
        }),
      })
      if (r.ok) {
        setNewImageLabel('')
        setNewImageTags('')
        await loadKnowledge(selectedBrandId)
      } else {
        const j = await r.json().catch(() => ({}))
        await openAlert({
          title: '이미지 등록 실패',
          message: j?.message ?? `HTTP ${r.status}`,
          variant: 'danger',
        })
      }
    } finally {
      setImageUploading(false)
    }
  }

  async function deleteKnowledgeImage(id: string) {
    if (!selectedBrandId) return
    const ok = await openConfirm({
      title: '이미지를 제거할까요?',
      message: '라이브러리에서 이미지를 제거합니다. 원본 파일은 남아있지만 이 브랜드에서는 더 이상 사용되지 않아요.',
      confirmLabel: '제거',
      variant: 'danger',
    })
    if (!ok) return
    await authedFetch(`/api/knowledge/images/${id}`, { method: 'DELETE' })
    await loadKnowledge(selectedBrandId)
  }

  async function fetchIdeas() {
    if (!selectedBrandId) return
    setIdeasError(null)
    setIdeasLoading(true)
    try {
      const r = await authedFetch('/api/knowledge/recommend-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brandId: selectedBrandId, maxIdeas: 5 }),
      })
      if (r.status === 429) {
        setIdeasError('요청 빈도 제한에 걸렸습니다 (분당 5회). 1분 후 다시 시도해 주세요.')
        return
      }
      const j = await r.json()
      if (!r.ok) {
        setIdeasError(j?.message ?? `HTTP ${r.status}`)
        return
      }
      // 새로 생성된 아이디어는 기존 저장분 위에 쌓이는 형태로 보여준다.
      await loadKnowledge(selectedBrandId)
    } catch (e: any) {
      setIdeasError(e?.message ?? '알 수 없는 오류')
    } finally {
      setIdeasLoading(false)
    }
  }

  async function deleteIdea(id: string) {
    if (!selectedBrandId) return
    await authedFetch(`/api/knowledge/ideas/${id}`, { method: 'DELETE' })
    setIdeas((prev) => prev.filter((i) => i.id !== id))
  }

  async function deleteAllIdeas() {
    if (!selectedBrandId) return
    const ok = await openConfirm({
      title: '모든 아이디어를 삭제할까요?',
      message: `저장된 ${ideas.length}개의 아이디어가 모두 지워집니다. 다시 추천받을 수 있지만 같은 결과는 나오지 않을 수 있어요.`,
      confirmLabel: `${ideas.length}개 전체 삭제`,
      variant: 'danger',
    })
    if (!ok) return
    await authedFetch(`/api/knowledge/ideas?brandId=${selectedBrandId}`, { method: 'DELETE' })
    setIdeas([])
  }

  function applyIdea(idea: { prompt: string; suggestedCount: number }) {
    setMode('note-rag')
    setPrompt(idea.prompt)
    setCount(Math.max(1, Math.min(10, idea.suggestedCount)))
    setBrandModalOpen(false)
  }

  useEffect(() => {
    loadBrands()
    checkHealth()
    loadBackgrounds()
  }, [])

  // 지식노트 패널이 열리거나 브랜드가 바뀌면 문서·이미지 재로드
  useEffect(() => {
    if (brandModalOpen && selectedBrandId) {
      loadKnowledge(selectedBrandId)
    }
  }, [brandModalOpen, selectedBrandId])

  async function handleGenerate() {
    setRagError(null)
    setIsGenerating(true)
    try {
      if (mode === 'note-rag') {
        if (!selectedBrandId) {
          setRagError('지식노트 기반 생성은 브랜드 선택이 필수입니다.')
          return
        }
        setRagProgress(0)
        const enqRes = await authedFetch('/api/generate/cards-from-note', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            brandId: selectedBrandId,
            prompt,
            count,
            baseImageUrls: baseImages.length ? baseImages : undefined,
            sizePreset: size,
            template,
          }),
        })
        if (enqRes.status === 429) {
          setRagError('요청이 너무 자주 들어왔습니다. 1분 후 다시 시도해 주세요.')
          return
        }
        if (!enqRes.ok) {
          const j = await enqRes.json().catch(() => ({}))
          setRagError(j?.message ?? `HTTP ${enqRes.status}`)
          return
        }
        const { jobId } = await enqRes.json()
        const cards = await pollRagJob(jobId)
        // 응답에 template 필드가 없을 수도 있으므로 현재 선택값으로 보정
        const withTemplate = cards.map((c) => ({ ...c, template: c.template ?? template }))
        // 개발자 진단 로그 (note-rag 경로)
        console.log('[generate/cards-from-note] received', withTemplate.length, 'cards')
        console.table(
          withTemplate.map((c) => ({
            id: c.id?.slice(0, 6),
            template: c.template,
            hasLayoutDsl: !!c.layoutDsl,
            blocks: c.layoutDsl?.blocks?.length ?? 0,
            types: c.layoutDsl?.blocks?.map((b: any) => b.type).join(',') ?? '-',
          })),
        )
        setCards(withTemplate)
        setSelectedCardId(withTemplate[0]?.id ?? null)
        setRagProgress(100)
        return
      }

      const body =
        mode === 'auto'
          ? {
              mode: 'auto',
              prompt,
              count,
              brandId: selectedBrandId || undefined,
              baseImageUrls: baseImages.length ? baseImages : undefined,
              template,
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
              baseImageUrls: baseImages.length ? baseImages : undefined,
              template,
            }
      const r = await authedFetch('/api/generate/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json())
      const rawCards: CardData[] = r.cards ?? []
      const newCards = rawCards.map((c) => ({ ...c, template: c.template ?? template }))
      // 개발자 진단 로그 — 카드별 layoutDsl 존재 여부 + block 타입
      console.table(
        newCards.map((c) => ({
          id: c.id.slice(0, 6),
          template: c.template,
          hasLayoutDsl: !!c.layoutDsl,
          blocks: c.layoutDsl?.blocks?.length ?? 0,
          types: c.layoutDsl?.blocks?.map((b: any) => b.type).join(',') ?? '-',
        })),
      )
      setCards(newCards)
      setSelectedCardId(newCards[0]?.id ?? null)
    } finally {
      setIsGenerating(false)
      // progress 는 완료 후 2초간 노출해서 사용자에게 피드백
      if (mode === 'note-rag') {
        setTimeout(() => setRagProgress(null), 2000)
      }
    }
  }

  async function pollRagJob(jobId: string, timeoutMs = 180_000): Promise<CardData[]> {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      const r = await authedFetch(`/api/generate/jobs/${jobId}`).then((r) => r.json())
      setRagProgress(typeof r?.progress === 'number' ? r.progress : 0)
      if (r?.status === 'done' || r?.status === 'partial') {
        return (r.cards ?? []) as CardData[]
      }
      if (r?.status === 'failed') {
        throw new Error(r?.errorMessage ?? '잡 실패')
      }
      await new Promise((res) => setTimeout(res, 1500))
    }
    throw new Error(`잡 ${jobId} 시간 초과 (${Math.round(timeoutMs / 1000)}s)`)
  }

  function updateCard(id: string, patch: Partial<CardData>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }

  function addCard() {
    setCards((prev) => {
      if (prev.length >= 10) return prev
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

  // LayoutDSL 만 다시 생성 — 이미지·imageUrl 은 유지, LLM 에 새 배치만 요청.
  // 같은 프롬프트로 temperature 1.0 을 던지면 매번 다른 구도가 나옴.
  async function relayoutCard(id: string) {
    const target = cards.find((c) => c.id === id)
    if (!target) return
    if (target.template !== 'product-ad' && target.template !== 'promo') return
    const promptText = prompt.trim() || target.title || '새로운 배치'
    try {
      const r = await authedFetch('/api/generate/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'auto',
          prompt: promptText,
          count: 1,
          brandId: selectedBrandId || undefined,
          template: target.template,
        }),
      }).then((res) => res.json())
      const fresh: CardData | undefined = r?.cards?.[0]
      if (!fresh?.layoutDsl) {
        alert('새 배치 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }
      // 이미지·id·layout(cover/content/cta) 는 유지. DSL·title·body·subtext·cta 는 새로.
      setCards((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                layoutDsl: fresh.layoutDsl,
                title: fresh.title ?? c.title,
                body: fresh.body ?? c.body,
                subtext: fresh.subtext ?? c.subtext,
                cta: fresh.cta ?? c.cta,
              }
            : c,
        ),
      )
    } catch (e: any) {
      alert('새 배치 생성 실패: ' + (e?.message ?? e))
    }
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
    const r = await authedFetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
    if (r.url) updateCard(id, { imageUrl: r.url })
  }

  // Mode B — 카드별 AI 이미지 편집 (Gemini 2.5 Flash Image)
  // 현재 카드의 imageUrl + 브랜드 스타일 + Mode A 참조 이미지를 근거로 새 배경 생성
  async function handleAiEdit(card: CardData): Promise<void> {
    if (!card.imageUrl) {
      await openAlert({
        title: '이미지가 필요해요',
        message: '편집할 원본 이미지가 없습니다. 먼저 이미지를 업로드하거나 배경을 선택해 주세요.',
        variant: 'warning',
      })
      return
    }
    const instruction = (card.body || '').slice(0, 200) // 카드 본문을 힌트로 전달 (선택적)
    const body = {
      imageUrl: card.imageUrl,
      brandId: selectedBrandId || undefined,
      instruction: instruction || undefined,
      refImageUrls: baseImages.length ? baseImages : undefined,
    }
    const res = await authedFetch('/api/images/edit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (res.status === 429) {
      throw new Error('요청 빈도 제한에 걸렸습니다 (AI 편집: 분당 3회 · 시간당 30회). 잠시 후 다시 시도해 주세요.')
    }
    if (res.status === 402) {
      const j = await res.json().catch(() => ({}))
      throw new Error(`${j?.message ?? '월 한도 초과'} (요금제 페이지 /pricing 에서 업그레이드)`)
    }
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      throw new Error(j?.message ?? `HTTP ${res.status}`)
    }
    const j = await res.json()
    if (j?.url) updateCard(card.id, { imageUrl: j.url })
    // 사용량 카운터 리프레시
    if (isLoggedIn) {
      authedFetch('/api/quota/me').then((r) => r.ok && r.json()).then((d) => d && setQuotaUsage(d)).catch(() => {})
    }
  }

  // text-to-image 모달 열기 — 카드 기준 프롬프트 프리필
  function openAiGenerateDialog(card: CardData) {
    const defaultPrompt = [card.title, card.body].filter(Boolean).join('. ').slice(0, 300)
    setAiGenDialog({
      cardId: card.id,
      prompt: defaultPrompt,
      loading: false,
      error: null,
    })
  }

  // 모달 안에서 "생성" 버튼 클릭 시 호출
  async function submitAiGenerate() {
    if (!aiGenDialog) return
    const card = cards.find((c) => c.id === aiGenDialog.cardId)
    if (!card) return
    const finalPrompt = aiGenDialog.prompt.trim().slice(0, 1000)
    if (!finalPrompt) {
      setAiGenDialog({ ...aiGenDialog, error: '설명을 한 문장 이상 입력해 주세요.' })
      return
    }
    setAiGenDialog({ ...aiGenDialog, loading: true, error: null })
    try {
      const d = resolveSizePx(size, customSize)
      const aspectRatio: '1:1' | '4:5' | '9:16' | '16:9' | undefined =
        size === '1:1' || size === '4:5' || size === '9:16'
          ? size
          : d.w === d.h
            ? '1:1'
            : d.w > d.h
              ? '16:9'
              : '4:5'
      const res = await authedFetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          brandId: selectedBrandId || undefined,
          refImageUrls: baseImages.length ? baseImages : undefined,
          aspectRatio,
          width: d.w,
          height: d.h,
        }),
      })
      if (res.status === 429) {
        setAiGenDialog({
          ...aiGenDialog,
          loading: false,
          error: '요청 빈도 제한에 걸렸습니다 (AI 생성: 분당 3회). 잠시 후 다시 시도해 주세요.',
        })
        return
      }
      if (res.status === 402) {
        const j = await res.json().catch(() => ({}))
        setAiGenDialog({
          ...aiGenDialog,
          loading: false,
          error: `${j?.message ?? '월 한도 초과'} (/pricing 에서 업그레이드)`,
        })
        return
      }
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setAiGenDialog({
          ...aiGenDialog,
          loading: false,
          error: j?.message ?? `HTTP ${res.status}`,
        })
        return
      }
      const j = await res.json()
      if (j?.url) updateCard(card.id, { imageUrl: j.url })
      setAiGenDialog(null) // 성공 시 닫기
      // 사용량 카운터 리프레시
      if (isLoggedIn) {
        authedFetch('/api/quota/me').then((r) => r.ok && r.json()).then((d) => d && setQuotaUsage(d)).catch(() => {})
      }
    } catch (e: any) {
      setAiGenDialog({
        ...aiGenDialog,
        loading: false,
        error: e?.message ?? '알 수 없는 오류',
      })
    }
  }

  // Mode A — 프롬프트 상단에 공통 참조 이미지 1~3장 첨부
  async function addBaseImages(files: FileList | File[]) {
    const remaining = 3 - baseImages.length
    if (remaining <= 0) return
    const list = Array.from(files).slice(0, remaining)
    if (!list.length) return
    setBaseUploading(true)
    try {
      const urls: string[] = []
      for (const f of list) {
        const fd = new FormData()
        fd.append('file', f)
        fd.append('consent', 'true')
        const r = await authedFetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
        if (r?.url) urls.push(r.url)
      }
      if (urls.length) setBaseImages((prev) => [...prev, ...urls].slice(0, 3))
    } finally {
      setBaseUploading(false)
    }
  }

  function removeBaseImage(i: number) {
    setBaseImages((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function downloadPng(cardId: string, index: number) {
    const mod = await import('html-to-image')
    const node = document.getElementById(`card-${cardId}`)
    if (!node) return
    const d = resolveSizePx(size, customSize)
    // 출력 해상도: 프리셋 별 고정 또는 custom 입력값 (±1px rounding)
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
      await openAlert({
        title: '카드가 부족해요',
        message: '릴스는 최소 2장의 카드가 필요합니다. 카드를 추가한 뒤 다시 시도해 주세요.',
        variant: 'warning',
      })
      return
    }
    setIsExportingReel(true)
    setReelStatus('릴스 준비 중…')
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

      const renderFrames = async (quality: number): Promise<string[]> => {
        const frames: string[] = []
        for (let i = 0; i < cards.length; i++) {
          const c = cards[i]
          const node = document.getElementById(`card-${c.id}`)
          if (!node) continue
          setReelStatus(`프레임 렌더링 중… (${i + 1}/${cards.length})`)
          const dataUrl = await mod.toJpeg(node, {
            pixelRatio,
            quality,
            cacheBust: true,
            backgroundColor: '#ffffff',
          })
          frames.push(dataUrl)
        }
        return frames
      }

      const qualityAttempts = Array.from(new Set([reelImageQuality, 0.72])).filter(
        (q) => q >= 0.5 && q <= 0.95,
      )

      let j: any = null
      let lastErr: Error | null = null
      for (let i = 0; i < qualityAttempts.length; i++) {
        const q = qualityAttempts[i]
        const frames = await renderFrames(q)
        if (frames.length < 2) throw new Error('프레임 렌더 실패')

        setReelStatus(`서버에서 영상 생성 중… (품질 ${Math.round(q * 100)}%)`)
        const res = await authedFetch('/api/reels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            frames,
            transition: reelTransition,
            durationPerCard: reelDuration,
            brandName: selectedBrand?.name,
          }),
        })
        if (res.ok) {
          j = await res.json()
          break
        }

        const errBody = await res.json().catch(() => ({} as any))
        const msg = String(errBody?.message ?? `HTTP ${res.status} · 서버 오류`)
        const canRetryWithSmallerPayload =
          i < qualityAttempts.length - 1 &&
          (res.status === 413 ||
            /payload|too large|entity too large|request body|body limit/i.test(msg))
        if (canRetryWithSmallerPayload) {
          setReelStatus('용량 최적화 후 재시도 중…')
          continue
        }
        lastErr = new Error(`HTTP ${res.status} · ${msg}`)
        break
      }

      if (!j) throw lastErr ?? new Error('릴스 생성 실패')

      setReelStatus('다운로드 준비 중…')
      setLastReelUrl(j.url)
      // 자동 다운로드
      const a = document.createElement('a')
      a.href = j.url
      a.download = j.filename
      a.click()
      setReelStatus('릴스 생성 완료')
      setTimeout(() => setReelStatus(null), 2000)
    } catch (e: any) {
      setReelStatus(null)
      await openAlert({
        title: '릴스 생성 실패',
        message: String(e?.message ?? e),
        variant: 'danger',
      })
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
      const d = resolveSizePx(size, customSize)
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
    const r = await authedFetch('/api/upload', { method: 'POST', body: fd }).then((r) => r.json())
    if (r.url) {
      setNewBrand((prev) => ({
        ...prev,
        assets: [...prev.assets, { url: r.url, caption: '', kind: 'image' }],
      }))
    }
  }

  async function saveBrand() {
    if (!newBrand.name.trim()) {
      await openAlert({
        title: '브랜드 이름이 비어있어요',
        message: '브랜드 이름은 필수입니다. 예: "유순", "Note2Card" 처럼 한 줄로 입력해 주세요.',
        variant: 'warning',
      })
      return
    }
    const isEdit = !!editingBrandId
    const url = isEdit ? `/api/brands/${editingBrandId}` : '/api/brands'
    const method = isEdit ? 'PATCH' : 'POST'
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newBrand),
    })
    if (!res.ok) {
      await openAlert({
        title: isEdit ? '수정 실패' : '저장 실패',
        message: isEdit
          ? '브랜드 정보를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.'
          : '같은 이름의 브랜드가 이미 있을 수 있습니다. 다른 이름으로 저장해 주세요.',
        variant: 'danger',
      })
      return
    }
    const j = await res.json().catch(() => ({}))
    const savedId = j?.brand?.id ?? j?.id ?? editingBrandId
    resetBrandForm()
    await loadBrands()
    if (savedId && !isEdit) {
      setSelectedBrandId(savedId)
      setEditingBrandId(savedId) // 새로 생성 후 바로 편집 모드로 전환
    }
  }

  function resetBrandForm() {
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
  }

  function loadBrandIntoForm(b: Brand) {
    setNewBrand({
      name: b.name,
      tone: b.tone ?? '',
      defaultPhrase: b.defaultPhrase ?? '',
      primaryColor: b.primaryColor ?? '#0f766e',
      secondaryColor: b.secondaryColor ?? '#f0fdfa',
      textColor: b.textColor ?? '#111827',
      fontFamily: b.fontFamily ?? 'Pretendard, sans-serif',
      assets: (b.assets ?? []).map((a) => ({ url: a.url, caption: a.caption ?? '', kind: a.kind })),
    })
  }

  function openBrandModal(mode: 'create' | 'edit', brandId?: string) {
    setBrandModalOpen(true)
    setBrandModalTab('info')
    if (mode === 'create') {
      setEditingBrandId(null)
      resetBrandForm()
    } else {
      const b = brands.find((x) => x.id === (brandId ?? selectedBrandId))
      if (b) {
        setEditingBrandId(b.id)
        loadBrandIntoForm(b)
        if (selectedBrandId !== b.id) setSelectedBrandId(b.id)
      }
    }
  }

  async function deleteBrand(id: string) {
    const ok = await openConfirm({
      title: '이 브랜드를 영구 삭제할까요?',
      message:
        '브랜드와 함께 연결된 지식노트·이미지 라이브러리·아이디어가 모두 삭제됩니다. 되돌릴 수 없어요.',
      confirmLabel: '영구 삭제',
      variant: 'danger',
    })
    if (!ok) return
    await authedFetch(`/api/brands/${id}`, { method: 'DELETE' })
    if (selectedBrandId === id) {
      setSelectedBrandId('')
      setEditingBrandId(null)
      resetBrandForm()
    }
    await loadBrands()
  }

  // 비로그인 방문자 → 랜딩 페이지. 로딩 중은 잠깐 빈 화면(깜빡임 방지).
  if (authStatus === 'loading') {
    return <main className="min-h-screen bg-white" />
  }
  if (authStatus === 'unauthenticated') {
    return <Landing />
  }

  return (
    <main className="mx-auto max-w-7xl px-5 py-6">
      <header className="flex items-center justify-between mb-10 gap-4 flex-wrap">
        <a href="/" className="flex items-center gap-2.5 group">
          {/* 로고 — 미니멀 N2C 마크 */}
          <div
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-white font-bold text-[11px] tracking-tight"
            style={{ background: 'linear-gradient(145deg, #4338ca 0%, #312e81 100%)' }}
            aria-hidden
          >
            N2C
          </div>
          <div>
            <h1 className="text-[19px] font-bold tracking-[-0.02em] leading-none">
              Note<span style={{ color: 'var(--n2c-primary)' }}>2</span>Card
            </h1>
            <p className="mt-1 text-[12px] text-slate-500 leading-none">
              브랜드 지식노트 · 카드뉴스 생성기
            </p>
          </div>
        </a>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 현재 브랜드 배지 */}
          {selectedBrand ? (
            <button
              onClick={() => openBrandModal('edit', selectedBrand.id)}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300 transition"
              title="브랜드 관리"
            >
              <span
                className="w-5 h-5 rounded-full border border-slate-200"
                style={{ background: selectedBrand.primaryColor }}
                aria-hidden
              />
              <span className="text-sm font-medium">{selectedBrand.name}</span>
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                className="text-slate-400"
                aria-hidden
              >
                <path
                  d="M2.5 4.5L6 8l3.5-3.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          ) : (
            <button
              onClick={() => openBrandModal('create')}
              className="px-3.5 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300 text-sm font-medium transition"
            >
              브랜드 선택
            </button>
          )}
          {/* 브랜드 드롭다운 */}
          {brands.length > 1 && (
            <select
              value={selectedBrandId}
              onChange={(e) => setSelectedBrandId(e.target.value)}
              className="border border-slate-200 rounded-full px-3 py-1.5 text-sm bg-white hover:border-slate-300 transition"
              title="브랜드 전환"
            >
              <option value="">(선택 없음)</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
          {/* 사용량 · 요금제 — 관리자는 '무제한' 표시 */}
          {isLoggedIn && quotaUsage ? (
            <a
              href={quotaUsage.isUnlimited ? '/admin' : '/pricing'}
              className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full border border-slate-200 bg-white hover:border-slate-300 text-sm transition"
              title={
                quotaUsage.isUnlimited
                  ? `관리자 · 사용량 무제한 (이번 달 이미지 ${quotaUsage.counts.imageGen}장)`
                  : `AI 이미지 ${quotaUsage.counts.imageGen}/${quotaUsage.limits.imageGen} · 텍스트 ${quotaUsage.counts.textGen}/${quotaUsage.limits.textGen}`
              }
            >
              <span
                className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  background: quotaUsage.isUnlimited
                    ? '#4338ca'
                    : quotaUsage.plan === 'free'
                      ? '#f1f5f9'
                      : 'var(--n2c-primary-soft)',
                  color: quotaUsage.isUnlimited
                    ? '#ffffff'
                    : quotaUsage.plan === 'free'
                      ? '#64748b'
                      : 'var(--n2c-primary)',
                }}
              >
                {quotaUsage.isUnlimited ? 'ADMIN' : quotaUsage.plan}
              </span>
              <span className="text-slate-600 text-[13px] tabular-nums">
                {quotaUsage.counts.imageGen}
                <span className="text-slate-400">
                  /{quotaUsage.isUnlimited ? '∞' : quotaUsage.limits.imageGen}
                </span>
              </span>
            </a>
          ) : (
            <a
              href="/pricing"
              className="px-3.5 py-1.5 rounded-full text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
            >
              요금제
            </a>
          )}
          {/* 인증 */}
          {isLoggedIn ? (
            <div className="flex items-center gap-2">
              {(session as any)?.role === 'admin' && (
                <a
                  href="/admin"
                  className="text-[12px] font-medium px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition"
                  title="관리자"
                >
                  관리자
                </a>
              )}
              {session?.user?.image && (
                <img
                  src={session.user.image}
                  alt=""
                  className="w-8 h-8 rounded-full border border-slate-200"
                />
              )}
              <button
                onClick={async () => {
                  // NEXTAUTH_URL 오설정으로 localhost 로 튀는 문제 방어 — 수동 리다이렉트
                  await signOut({ redirect: false })
                  window.location.assign('/')
                }}
                className="text-sm text-slate-500 hover:text-slate-900 px-2 py-1 transition"
                title={session?.user?.email ?? '로그아웃'}
              >
                로그아웃
              </button>
            </div>
          ) : authStatus === 'loading' ? (
            <div className="text-sm text-slate-400">…</div>
          ) : (
            <a
              href="/signin"
              className="n2c-btn-primary px-4 py-2 rounded-full text-sm font-medium inline-flex items-center"
            >
              로그인 · 회원가입
            </a>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
        <section className="space-y-4">
          <div className="n2c-card p-6 space-y-5">
            {/* 모드 선택 */}
            <div>
              <div className="text-[13px] font-bold text-slate-700 uppercase tracking-[0.08em] mb-3">
                생성 방식
              </div>
              <div className="space-y-1.5">
                {(
                  [
                    { k: 'auto', title: '자동', desc: '프롬프트 한 줄 → 카드 1~10장' },
                    { k: 'manual', title: '수동', desc: '카드별 제목·본문 직접 입력' },
                    { k: 'note-rag', title: '지식노트 기반', desc: '브랜드 자료 자동 참조' },
                  ] as const
                ).map((m) => {
                  const active = mode === m.k
                  return (
                    <button
                      key={m.k}
                      onClick={() => setMode(m.k)}
                      className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-[10px] text-left transition ${
                        active
                          ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex-1">
                        <span className="block text-[16px] font-bold tracking-[-0.01em]">
                          {m.title}
                        </span>
                        <span
                          className={`block text-[13px] mt-1 font-medium ${
                            active ? 'text-indigo-700' : 'text-slate-600'
                          }`}
                        >
                          {m.desc}
                        </span>
                      </span>
                      {active && (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 16 16"
                          aria-hidden
                          className="text-indigo-700"
                        >
                          <path
                            d="M3 8l3.5 3.5L13 5"
                            stroke="currentColor"
                            strokeWidth="2"
                            fill="none"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 템플릿 선택 — 기본 / 상품 광고 / 프로모션 */}
            <div>
              <div className="text-[13px] font-bold text-slate-700 uppercase tracking-[0.08em] mb-3">
                카드 템플릿
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {TEMPLATES.map((t) => {
                  const active = template === t.key
                  const blocked = t.disabled || (t.requiresNoteRag && mode !== 'note-rag')
                  const desc = t.requiresNoteRag && mode !== 'note-rag' ? '지식노트 모드 전용' : t.description
                  return (
                    <button
                      key={t.key}
                      onClick={() => !blocked && setTemplate(t.key)}
                      disabled={blocked}
                      className={`px-2.5 py-2.5 rounded-[10px] text-left transition disabled:opacity-40 disabled:cursor-not-allowed ${
                        active
                          ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200'
                          : 'text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200'
                      }`}
                    >
                      <span className="block text-[15px] font-bold tracking-[-0.01em]">
                        {t.title}
                      </span>
                      <span
                        className={`block text-[12px] mt-0.5 font-medium ${
                          active ? 'text-indigo-700' : 'text-slate-600'
                        }`}
                      >
                        {desc}
                      </span>
                    </button>
                  )
                })}
              </div>
              {template === 'product-ad' && (
                <p className="mt-2.5 text-[13px] text-slate-600 leading-relaxed">
                  AI 가 <b>구도·컬러·장식까지</b> 결정합니다. 매 생성마다 다른 결과 —
                  마음에 들 때까지 "다시 만들기". 1장씩 생성, 수정도 가능합니다.
                </p>
              )}
              {template === 'promo' && (
                <p className="mt-2.5 text-[13px] text-slate-600 leading-relaxed">
                  이벤트·세일 감성으로 AI 가 레이아웃을 새로 짭니다. 매번 다른 구도 ·
                  1장씩 생성, 대형 할인율·기간 문구 중심.
                </p>
              )}
            </div>

            {mode === 'note-rag' && selectedBrand && (
              <button
                onClick={() => {
                  openBrandModal('edit', selectedBrand.id)
                  setBrandModalTab('docs')
                }}
                className="w-full px-3 py-2 text-sm rounded-[10px] text-slate-600 bg-slate-50 hover:bg-slate-100 transition"
              >
                {selectedBrand.name} 지식노트 관리 →
              </button>
            )}

            <div>
              <div className="text-[13px] font-bold text-slate-700 uppercase tracking-[0.08em] mb-3">
                사이즈
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {(['1:1', '4:5', '9:16', 'custom'] as SizePreset[]).map((p) => {
                  const active = size === p
                  const isCustom = p === 'custom'
                  return (
                    <button
                      key={p}
                      onClick={() => {
                        setSize(p)
                        if (p === 'custom') setCount(1)
                      }}
                      className={`px-3 py-2.5 rounded-[10px] text-left transition ${
                        active
                          ? 'bg-indigo-50 text-indigo-900 ring-1 ring-indigo-200 border border-transparent'
                          : 'text-slate-700 hover:bg-slate-50 border border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[16px] font-bold tabular-nums">
                          {isCustom ? '배너' : p}
                        </span>
                        <span
                          className={`text-[12px] tabular-nums font-medium ${
                            active ? 'text-indigo-600' : 'text-slate-500'
                          }`}
                        >
                          {SIZE_SUBLABELS[p]}
                        </span>
                      </div>
                      <div
                        className={`text-[13px] mt-1 font-medium ${
                          active ? 'text-indigo-700' : 'text-slate-600'
                        }`}
                      >
                        {SIZE_LABELS[p]}
                      </div>
                    </button>
                  )
                })}
              </div>
              {size === 'custom' ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {(
                    [
                      { dim: 'w' as const, label: '가로 (px)' },
                      { dim: 'h' as const, label: '세로 (px)' },
                    ]
                  ).map(({ dim, label }) => (
                    <label key={dim} className="block">
                      <span className="text-xs font-medium text-slate-600">{label}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={200}
                        max={4000}
                        value={customInput[dim]}
                        onChange={(e) =>
                          setCustomInput((p) => ({ ...p, [dim]: e.target.value }))
                        }
                        onBlur={(e) => {
                          const parsed = parseInt(e.target.value, 10)
                          const clamped = Number.isFinite(parsed)
                            ? Math.max(200, Math.min(4000, parsed))
                            : customSize[dim]
                          setCustomSize((s) => ({ ...s, [dim]: clamped }))
                          setCustomInput((p) => ({ ...p, [dim]: String(clamped) }))
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                        }}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 mt-1 focus:border-indigo-500"
                      />
                    </label>
                  ))}
                  <p className="col-span-2 text-xs text-amber-700 mt-1">
                    200~4000px · Enter 또는 바깥 클릭 시 확정됩니다. 배너는 이미지 1장 고정.
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-slate-600 mt-3 font-medium">
                  {size === '4:5' && '인스타그램 피드 표준 사이즈'}
                  {size === '9:16' && '인스타 릴스 · 스토리 · 틱톡'}
                  {size === '1:1' && '인스타 정사각 · 모든 SNS 공통'}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-3">
                <div className="text-[13px] font-bold text-slate-700 uppercase tracking-[0.08em]">
                  카드 수
                </div>
                <div className="text-[13px] text-slate-500 font-medium">
                  {size === 'custom'
                    ? '배너 1장 고정'
                    : forceSingleCard
                      ? 'AI 구도 생성 · 1장 고정'
                      : '최대 10'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCount((c) => Math.max(1, c - 1))}
                  disabled={size === 'custom' || forceSingleCard || count <= 1}
                  className="w-10 h-10 rounded-[10px] border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 text-lg text-slate-600"
                  aria-label="카드 수 감소"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={count}
                  disabled={size === 'custom' || forceSingleCard}
                  onChange={(e) =>
                    setCount(Math.max(1, Math.min(10, Number(e.target.value) || 1)))
                  }
                  className="flex-1 border border-slate-200 rounded-[10px] px-3 py-2 text-center font-semibold tabular-nums disabled:bg-slate-50 disabled:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setCount((c) => Math.min(10, c + 1))}
                  disabled={size === 'custom' || forceSingleCard || count >= 10}
                  className="w-10 h-10 rounded-[10px] border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-30 text-lg text-slate-600"
                  aria-label="카드 수 증가"
                >
                  +
                </button>
              </div>
            </div>

            {mode !== 'manual' ? (
              <div>
                <div className="flex items-baseline justify-between mb-3">
                  <div className="text-[13px] font-bold text-slate-700 uppercase tracking-[0.08em]">
                    프롬프트
                  </div>
                  {mode === 'note-rag' && (
                    <div className="text-[13px] text-slate-600 font-medium">
                      지식노트 자동 참조
                    </div>
                  )}
                </div>
                <textarea
                  rows={5}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={
                    mode === 'note-rag'
                      ? '예) 유순 제품 5월 1일 온라인 판매 시작 — 인스타 피드 6장'
                      : '예) 유순 임산부와 유아를 위한 케어 서비스 안내'
                  }
                  className="n2c-input w-full resize-none text-[15px]"
                />
                <p className="mt-2.5 text-[13px] text-slate-600 leading-relaxed">
                  과장·의학적 단정 표현은 자동으로 완화됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                <p className="text-[13px] text-slate-600">
                  비워둔 필드는 브랜드·레이아웃 기반으로 자동 채워집니다.
                </p>
                {Array.from({ length: count }).map((_, i) => (
                  <div key={i} className="border rounded-md p-2 bg-slate-50 space-y-1">
                    <div className="text-[12px] text-slate-600 font-semibold">카드 {i + 1}</div>
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

            <div>
              <div className="flex items-baseline justify-between mb-3">
                <div className="text-[13px] font-bold text-slate-700 uppercase tracking-[0.08em]">
                  참조 이미지
                </div>
                <div className="text-[11px] text-slate-400">선택 · 최대 3장</div>
              </div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  if (e.dataTransfer?.files?.length) addBaseImages(e.dataTransfer.files)
                }}
                className="border border-dashed border-slate-200 rounded-[12px] p-3 transition hover:border-slate-300"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] text-slate-500">
                    {baseImages.length === 0
                      ? '드래그 또는 파일 선택'
                      : `${baseImages.length} / 3 장`}
                  </span>
                  <label
                    className={`inline-flex items-center text-[12px] font-medium text-slate-700 px-2.5 py-1 rounded-md hover:bg-slate-50 cursor-pointer ${
                      baseImages.length >= 3 || baseUploading ? 'opacity-40 pointer-events-none' : ''
                    }`}
                  >
                    {baseUploading ? '업로드 중' : '파일 선택'}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) addBaseImages(e.target.files)
                        e.target.value = ''
                      }}
                    />
                  </label>
                </div>
                {baseImages.length > 0 && (
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {baseImages.map((url, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={url}
                          alt=""
                          className="w-14 h-14 object-cover rounded-lg"
                        />
                        <button
                          onClick={() => removeBaseImage(i)}
                          className="absolute -top-1.5 -right-1.5 bg-white shadow-sm border border-slate-200 rounded-full w-5 h-5 text-xs text-slate-500 hover:text-red-600 hover:border-red-200"
                          title="제거"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                본인 저작권/사용권 보유에 동의한 것으로 간주됩니다.
              </p>
            </div>

            <button
              disabled={isGenerating}
              onClick={handleGenerate}
              className="n2c-btn-primary w-full rounded-[12px] py-3.5 text-[15px] font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <span className="inline-flex items-center gap-2">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      opacity="0.25"
                    />
                    <path
                      fill="currentColor"
                      d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z"
                    />
                  </svg>
                  {mode === 'note-rag'
                    ? `생성 중 ${ragProgress ?? 0}%`
                    : '생성 중'}
                </span>
              ) : (
                '카드 생성'
              )}
            </button>
            {mode === 'note-rag' && ragProgress !== null && (
              <div className="h-2 w-full bg-violet-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-600 transition-[width] duration-300"
                  style={{ width: `${Math.min(100, Math.max(0, ragProgress))}%` }}
                />
              </div>
            )}
            {ragError && (
              <div className="text-sm text-red-600 leading-relaxed bg-red-50 border border-red-200 rounded-lg p-3">
                <strong className="font-semibold">오류:</strong> {ragError}
              </div>
            )}
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
                  해상도 {resolveSizePx(size, customSize).w}×{resolveSizePx(size, customSize).h} ·{' '}
                  {SIZE_LABELS[size]}
                </div>
              </div>
              <p className="text-xs text-slate-500 pt-1">
                카드별 PNG는 각 카드 아래 "PNG 다운로드" 버튼으로 받을 수 있어요.
              </p>
            </div>
          )}

          {cards.length >= 2 && (
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="text-sm font-medium flex items-center gap-2">
                  🎬 릴스 내보내기 <span className="text-xs text-slate-400 font-normal">9:16 MP4</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700">
                    {cards.length}장
                  </span>
                  <span className="px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700">
                    총 {Math.round((cards.length * reelDuration - (cards.length - 1) * 0.5) * 10) / 10}초
                  </span>
                </div>
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
                <label className="block text-xs text-slate-500 mb-1">렌더 품질</label>
                <div className="grid grid-cols-2 gap-1">
                  {[
                    { label: '표준', value: 0.82, hint: '빠름' },
                    { label: '고화질', value: 0.88, hint: '권장' },
                  ].map((q) => (
                    <button
                      key={q.label}
                      onClick={() => setReelImageQuality(q.value)}
                      className={`px-2 py-1.5 rounded-md text-xs border ${
                        reelImageQuality === q.value
                          ? 'bg-indigo-700 text-white border-indigo-700'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-semibold">{q.label}</span>
                      <span className="ml-1 opacity-80">({q.hint})</span>
                    </button>
                  ))}
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

              {reelStatus && (
                <div className="text-xs text-indigo-800 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
                  {reelStatus}
                </div>
              )}

              {lastReelUrl && (
                <div className="border rounded-md overflow-hidden bg-black">
                  <video src={lastReelUrl} controls className="w-full h-auto" preload="metadata" />
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
                카드 수정 후 다시 버튼을 누르면 최신 상태로 재렌더됩니다. 생성이 길어지면 자동으로 용량 최적화 재시도를 수행합니다.
              </p>
            </div>
          )}
        </section>

        <section className="space-y-4">
          {cards.length === 0 ? (
            (() => {
              const isBrandRequired = mode === 'note-rag'
              const step1Done = isBrandRequired ? !!selectedBrandId : true
              const step2Done =
                mode === 'manual'
                  ? manual.some((m) => m.title || m.body || m.subtext || m.cta)
                  : prompt.trim().length > 0
              const modeGuide: Record<
                GenMode,
                {
                  label: string
                  helper: string
                  step2Title: string
                  step2Desc: string
                  step2Example?: string
                  step3Desc: string
                }
              > = {
                auto: {
                  label: '자동',
                  helper: '한 줄 프롬프트로 카드 초안을 빠르게 만듭니다.',
                  step2Title: '프롬프트 입력',
                  step2Desc: '제품/행사/목적을 한 문장으로 입력하면 됩니다.',
                  step2Example: '유순 제품 5월 1일 온라인 판매 시작, 인스타 피드 카드뉴스 5장',
                  step3Desc: '생성 후 카드별 텍스트와 이미지를 필요에 맞게 수정해 마무리하세요.',
                },
                manual: {
                  label: '수동',
                  helper: '카드별 제목·본문을 직접 제어할 수 있습니다.',
                  step2Title: '카드별 내용 입력',
                  step2Desc: '왼쪽 수동 입력칸에 카드별 제목·본문·CTA를 입력하세요.',
                  step3Desc:
                    '생성 버튼을 누르면 입력한 내용 중심으로 카드가 만들어지고 빈 항목은 자동 보완됩니다.',
                },
                'note-rag': {
                  label: '지식노트',
                  helper: '브랜드 문서/이미지를 참고해 더 일관된 결과를 만듭니다.',
                  step2Title: '프롬프트 + 지식노트 기반 입력',
                  step2Desc:
                    '브랜드를 선택한 뒤 프롬프트를 입력하면 지식노트 자료를 근거로 내용을 작성합니다.',
                  step2Example: '유순 5월 프로모션 안내, 기존 브랜드 톤 유지, 인스타 피드 6장',
                  step3Desc:
                    '생성 완료까지 약간 더 걸릴 수 있으며, 완료 후 카드와 이미지를 그대로 편집할 수 있습니다.',
                },
              }
              const activeGuide = modeGuide[mode]
              const requiredDone = (isBrandRequired ? Number(!!selectedBrandId) : 0) + Number(step2Done)
              const requiredTotal = isBrandRequired ? 2 : 1
              const nextGuide = isBrandRequired && !step1Done
                ? '지식노트 모드는 브랜드 선택이 필수입니다.'
                : !step2Done
                  ? mode === 'manual'
                    ? '수동 입력칸에 카드 내용 1개 이상 작성하면 준비 완료입니다.'
                    : '프롬프트 한 줄만 입력하면 준비 완료입니다.'
                  : `${activeGuide.label} 모드 준비 완료. 왼쪽 하단의 카드 생성 버튼을 눌러주세요.`

              const nextTitle = isBrandRequired && !step1Done
                ? '브랜드 선택'
                : !step2Done
                  ? '입력 작성'
                  : '카드 생성하기'
              const step1StateLabel = isBrandRequired ? (step1Done ? '완료' : '필수') : '선택'

              const stepRow = (n: number, title: string, desc: string, state: 'done' | 'next' | 'pending', example?: string) => (
                <li className="flex gap-4 items-start py-4 border-b border-slate-100 last:border-0">
                  <div
                    className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[12px] font-semibold tabular-nums ${
                      state === 'done'
                        ? 'text-white'
                        : state === 'next'
                          ? 'text-white'
                          : 'bg-slate-100 text-slate-400'
                    }`}
                    style={
                      state === 'done'
                        ? { background: 'var(--n2c-primary)' }
                        : state === 'next'
                          ? { background: '#0b1220' }
                          : undefined
                    }
                  >
                    {state === 'done' ? (
                      <svg width="12" height="12" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      n
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <div className={`text-[14px] font-semibold ${state === 'pending' ? 'text-slate-500' : ''}`}>{title}</div>
                      {state === 'next' && (
                        <span className="text-[10px] font-semibold tracking-wider uppercase text-slate-500">
                          지금 할 일
                        </span>
                      )}
                    </div>
                    <p className={`text-[13px] mt-1 leading-relaxed ${state === 'pending' ? 'text-slate-400' : 'text-slate-600'}`}>
                      {desc}
                    </p>
                    {example && state !== 'done' && (
                      <button
                        onClick={() => {
                          setPrompt(example)
                          if (mode === 'auto') setCount(5)
                          if (mode === 'note-rag') setCount(6)
                        }}
                        className="mt-2 px-2.5 py-1 text-[12px] rounded-md border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition"
                      >
                        예시 입력
                      </button>
                    )}
                  </div>
                </li>
              )

              const step1State: 'done' | 'next' | 'pending' = isBrandRequired
                ? step1Done
                  ? 'done'
                  : 'next'
                : 'pending'
              const step2State: 'done' | 'next' | 'pending' = step2Done
                ? 'done'
                : step1Done
                  ? 'next'
                  : 'pending'
              const step3State: 'done' | 'next' | 'pending' =
                step1Done && step2Done ? 'next' : 'pending'

              return (
                <div className="n2c-card p-8 sm:p-10">
                  <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
                    <div>
                      <h2 className="text-[24px] font-bold tracking-[-0.02em] leading-tight">
                        시작하기
                      </h2>
                      <p className="mt-1.5 text-slate-600 text-[14px]">
                        3단계만 거치면 첫 카드뉴스가 완성됩니다
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">
                        {activeGuide.label} 모드
                      </span>
                      {isBrandRequired && (
                        <button
                          onClick={() =>
                            openBrandModal(
                              selectedBrandId ? 'edit' : 'create',
                              selectedBrandId || undefined,
                            )
                          }
                          className="text-[13px] text-slate-700 border border-slate-200 rounded-full px-3 py-1.5 hover:border-slate-300 transition"
                        >
                          {selectedBrandId ? '브랜드 관리' : '브랜드 선택'}
                        </button>
                      )}
                    </div>
                  </div>

                  <ol>
                    {stepRow(
                      1,
                      `브랜드 ${isBrandRequired ? '선택' : '선택 (선택 사항)'}`,
                      isBrandRequired
                        ? '지식노트 모드는 브랜드 선택이 필요합니다. 브랜드의 톤·색상·자료가 자동 반영됩니다.'
                        : '브랜드 없이도 생성할 수 있지만, 선택하면 톤·색감·문구가 자동으로 맞춰집니다.',
                      step1State,
                    )}
                    {stepRow(
                      2,
                      activeGuide.step2Title,
                      activeGuide.step2Desc,
                      step2State,
                      activeGuide.step2Example,
                    )}
                    {stepRow(
                      3,
                      '카드 생성하기',
                      activeGuide.step3Desc,
                      step3State,
                    )}
                  </ol>

                  {/* 템플릿 미리보기 갤러리 — 각 템플릿을 썸네일로 보여주고 클릭 시 즉시 선택.
                      requiresNoteRag 템플릿(상품광고·프로모션) 은 클릭 시 자동으로 지식노트 모드로 전환. */}
                  <div className="mt-8 pt-6 border-t border-slate-100">
                    <div className="flex items-baseline justify-between mb-4">
                      <h3 className="text-[14px] font-bold tracking-[-0.01em]">카드 템플릿</h3>
                      <span className="text-[11px] text-slate-500">
                        클릭하면 바로 선택됩니다
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {TEMPLATES.map((t) => {
                        const active = template === t.key
                        const selectTemplate = () => {
                          if (t.disabled) return
                          // 노트-RAG 전용 템플릿이면 모드도 함께 전환
                          if (t.requiresNoteRag && mode !== 'note-rag') setMode('note-rag')
                          setTemplate(t.key)
                          // 권장 비율도 자동 반영 (1:1 / 4:5 등)
                          if (t.recommendedAspect === '4:5') setSize('4:5')
                          else if (t.recommendedAspect === '1:1') setSize('1:1')
                        }
                        const primary = selectedBrand?.primaryColor ?? undefined
                        return (
                          <button
                            key={t.key}
                            onClick={selectTemplate}
                            disabled={t.disabled}
                            className={`group flex flex-col gap-2 p-2 rounded-[12px] transition text-left ${
                              active
                                ? 'ring-2 ring-indigo-500 bg-indigo-50/40'
                                : 'ring-1 ring-slate-200 hover:ring-slate-300 hover:bg-slate-50'
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                          >
                            <div className="flex items-center justify-center overflow-hidden rounded-[10px]">
                              <TemplatePreview
                                template={t.key}
                                displayWidth={160}
                                primaryColor={primary}
                                // basic 은 실제 생성 예시(YOOSUN) 를 사용해 "진짜 이렇게 나옵니다" 어필.
                                sampleImageUrl={t.key === 'basic' ? '/samples/yoosun-basic.png' : undefined}
                                sampleAspect="4:5"
                              />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[15px] font-bold tracking-[-0.01em]">
                                  {t.title}
                                </span>
                                {active && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-600 text-white font-bold">
                                    선택됨
                                  </span>
                                )}
                                {t.key === 'basic' && !active && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 text-white font-bold">
                                    실제 예시
                                  </span>
                                )}
                                {t.requiresNoteRag && !active && (
                                  <span className="text-[10px] text-slate-500 font-medium">지식노트</span>
                                )}
                              </div>
                              <div className="text-[12px] text-slate-600 mt-1 leading-snug font-medium">
                                {t.description}
                              </div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-3 text-[11px] text-slate-500 leading-relaxed">
                      · 상품 광고 / 프로모션 템플릿은 지식노트 모드에서 가격·할인율·기능 아이콘까지 자동 생성됩니다
                    </p>
                  </div>

                  <div className="mt-6 pt-6 border-t border-slate-100 text-[12px] text-slate-500 leading-relaxed">
                    브랜드를 만들어두면 톤·색상·기본 문구·지식노트 문서·이미지 라이브러리를 함께 관리할 수 있습니다.
                  </div>
                </div>
              )
            })()
          ) : (
            <>
              {/* 카드 리스트 */}
              <div className="n2c-card p-2.5 flex items-center gap-2 overflow-x-auto sticky top-2 z-10">
                <span className="text-[11px] text-slate-500 flex-shrink-0 font-semibold uppercase tracking-wider px-2">
                  카드
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
                        ? 'border-indigo-600 ring-2 ring-indigo-200'
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
                {cards.length < 10 && (
                  <button
                    onClick={addCard}
                    className="flex-shrink-0 w-14 h-14 rounded-md border-2 border-dashed border-slate-300 hover:border-indigo-500 hover:text-indigo-700 text-slate-400 flex items-center justify-center text-2xl transition"
                    title="카드 추가 (최대 10장)"
                  >
                    ＋
                  </button>
                )}
                <span className="ml-auto text-xs text-slate-400 flex-shrink-0 pr-1">
                  {cards.length} / 10
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
                    customSize={customSize}
                    backgrounds={backgrounds}
                    selected={selectedCardId === c.id}
                    onSelect={() => setSelectedCardId(c.id)}
                    onChange={(patch) => updateCard(c.id, patch)}
                    onImageFile={(f) => handleCardImageUpload(c.id, f)}
                    onAiEdit={() => handleAiEdit(c)}
                    onAiGenerate={() => openAiGenerateDialog(c)}
                    onDownload={() => downloadPng(c.id, idx)}
                    onMoveUp={() => moveCard(c.id, -1)}
                    onMoveDown={() => moveCard(c.id, 1)}
                    onDelete={async () => {
                      const ok = await openConfirm({
                        title: '이 카드를 삭제할까요?',
                        message: '카드 1장이 제거됩니다. 되돌릴 수 없어요.',
                        confirmLabel: '삭제',
                        variant: 'danger',
                      })
                      if (ok) deleteCard(c.id)
                    }}
                    onRelayout={
                      c.template === 'product-ad' || c.template === 'promo'
                        ? () => relayoutCard(c.id)
                        : undefined
                    }
                  />
                ))}
                {cards.length < 10 && (
                  <button
                    onClick={addCard}
                    className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center text-slate-400 hover:border-indigo-500 hover:text-indigo-700 transition min-h-[360px]"
                  >
                    <div className="text-5xl mb-2 leading-none">＋</div>
                    <div className="text-sm">카드 추가</div>
                    <div className="text-xs text-slate-400 mt-1">최대 10장</div>
                  </button>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {brandModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6"
          onClick={() => setBrandModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더: 타이틀 + 브랜드 선택 + 새 브랜드 + 닫기 */}
            <div className="border-b px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap flex-1 min-w-0">
                <h2 className="text-lg font-bold flex items-center gap-2 shrink-0">
                  <span>🏷️</span> 브랜드 관리
                </h2>
                {brands.length > 0 && (
                  <select
                    value={editingBrandId ?? ''}
                    onChange={(e) => {
                      const id = e.target.value
                      if (id) openBrandModal('edit', id)
                      else {
                        setEditingBrandId(null)
                        resetBrandForm()
                      }
                    }}
                    className="border border-slate-300 rounded-lg px-3 py-2 bg-white font-medium min-w-0 max-w-[200px]"
                  >
                    <option value="">+ 새 브랜드 만들기</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  onClick={() => openBrandModal('create')}
                  className="px-3 py-2 border border-indigo-300 bg-indigo-50 text-indigo-800 rounded-lg font-medium hover:bg-indigo-100 text-sm"
                  title="새 브랜드 생성 모드"
                >
                  + 새 브랜드
                </button>
              </div>
              <button
                onClick={() => setBrandModalOpen(false)}
                className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-2xl leading-none flex items-center justify-center shrink-0"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            {/* 탭 네비게이션 — 카운트 pill 뱃지 + 큰 hit target */}
            <div className="border-b px-6 flex gap-1 overflow-x-auto">
              {(
                [
                  { k: 'info', label: '기본 정보', count: null, needsBrand: false },
                  { k: 'docs', label: '문서', count: knowledgeDocs.length, needsBrand: true },
                  { k: 'images', label: '이미지 라이브러리', count: newBrand.assets.length + knowledgeImages.length, needsBrand: true },
                  { k: 'ideas', label: '아이디어', count: ideas.length, needsBrand: true },
                ] as const
              ).map((t) => {
                const disabled = t.needsBrand && !editingBrandId
                const active = brandModalTab === t.k
                return (
                  <button
                    key={t.k}
                    onClick={() => !disabled && setBrandModalTab(t.k)}
                    disabled={disabled}
                    className={`px-4 py-3 border-b-2 -mb-px transition flex items-center gap-2 shrink-0 ${
                      active
                        ? 'border-indigo-600 text-indigo-700 font-semibold'
                        : disabled
                          ? 'border-transparent text-slate-300 cursor-not-allowed'
                          : 'border-transparent text-slate-600 hover:text-slate-900'
                    }`}
                    title={disabled ? '먼저 브랜드를 저장해 주세요' : ''}
                  >
                    <span>{t.label}</span>
                    {t.count !== null && t.count > 0 && (
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                          active ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {t.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* 탭 본문 — 스크롤 가능한 영역 */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* ========== 탭: 기본 정보 ========== */}
                {brandModalTab === 'info' && (
                  <section className="space-y-5">
                    <div className="text-sm text-slate-500">
                      {editingBrandId
                        ? '아래 필드를 수정하고 변경 저장을 누르세요.'
                        : '새 브랜드를 만들면 지식노트·이미지·아이디어 탭이 활성화됩니다.'}
                    </div>

                    {/* 이름 · 톤 · 기본 문구 */}
                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">
                          브랜드 이름 <span className="text-red-500">*</span>
                        </span>
                        <input
                          className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:border-indigo-500"
                          placeholder="예: 유순"
                          value={newBrand.name}
                          onChange={(e) => setNewBrand({ ...newBrand, name: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">톤앤매너</span>
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          LLM 이 카피 작성 시 참조
                        </span>
                        <input
                          className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:border-indigo-500"
                          placeholder="예: 따뜻하고 진솔한 · 시니어·가족을 배려하는 안심감 있는 어조"
                          value={newBrand.tone}
                          onChange={(e) => setNewBrand({ ...newBrand, tone: e.target.value })}
                        />
                      </label>
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">기본 문구</span>
                        <span className="ml-2 text-xs font-normal text-slate-400">
                          cover/cta 카드에 자동 삽입
                        </span>
                        <input
                          className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:border-indigo-500"
                          placeholder="예: 오늘도 평안한 하루"
                          value={newBrand.defaultPhrase}
                          onChange={(e) =>
                            setNewBrand({ ...newBrand, defaultPhrase: e.target.value })
                          }
                        />
                      </label>
                    </div>

                    {/* 색상 팔레트 */}
                    <div>
                      <div className="text-sm font-semibold text-slate-700 mb-2">
                        색상 팔레트
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        {(
                          [
                            { key: 'primaryColor', label: '주색', hint: '강조·CTA' },
                            { key: 'secondaryColor', label: '배경', hint: '카드 배경' },
                            { key: 'textColor', label: '글자', hint: '본문' },
                          ] as const
                        ).map(({ key, label, hint }) => (
                          <label key={key} className="block">
                            <span className="text-xs font-medium text-slate-600">{label}</span>
                            <span className="ml-1 text-[10px] text-slate-400">{hint}</span>
                            <div className="mt-1 flex items-center gap-2 border border-slate-300 rounded-lg p-1.5 bg-white">
                              <input
                                type="color"
                                value={newBrand[key]}
                                onChange={(e) =>
                                  setNewBrand({ ...newBrand, [key]: e.target.value })
                                }
                                className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                              />
                              <code className="text-xs font-mono text-slate-600 flex-1 truncate">
                                {newBrand[key]}
                              </code>
                            </div>
                          </label>
                        ))}
                      </div>
                      {/* 팔레트 라이브 프리뷰 */}
                      <div
                        className="mt-3 rounded-xl p-5 border"
                        style={{
                          background: newBrand.secondaryColor,
                          color: newBrand.textColor,
                          fontFamily: newBrand.fontFamily,
                        }}
                      >
                        <div className="text-xs opacity-70 mb-1">미리보기</div>
                        <div className="text-lg font-bold">{newBrand.name || '브랜드 이름'}</div>
                        <div className="text-sm opacity-80 mt-1">
                          {newBrand.defaultPhrase || '기본 문구가 여기 표시됩니다.'}
                        </div>
                        <div
                          className="inline-block mt-3 px-4 py-2 rounded-lg text-white text-sm font-semibold"
                          style={{ background: newBrand.primaryColor }}
                        >
                          자세히 보기 →
                        </div>
                      </div>
                    </div>

                    {/* 폰트 */}
                    <label className="block">
                      <span className="text-sm font-semibold text-slate-700">폰트</span>
                      <span className="ml-2 text-xs font-normal text-slate-400">
                        CSS font-family 값
                      </span>
                      <input
                        className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 focus:border-indigo-500"
                        placeholder="예: Pretendard, Noto Sans KR, sans-serif"
                        value={newBrand.fontFamily}
                        onChange={(e) =>
                          setNewBrand({ ...newBrand, fontFamily: e.target.value })
                        }
                      />
                    </label>

                    {/* 저장 — 기본 액션 */}
                    <button
                      onClick={saveBrand}
                      disabled={!newBrand.name.trim()}
                      className="w-full bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg py-3 font-bold shadow-sm hover:shadow transition disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {editingBrandId ? '✓ 변경 저장' : '+ 새 브랜드 저장'}
                    </button>

                    {/* Danger zone — 편집 모드일 때만 노출 */}
                    {editingBrandId && (
                      <div className="mt-4 border border-red-200 bg-red-50/50 rounded-xl p-4">
                        <div className="text-sm font-semibold text-red-800 mb-1">
                          ⚠️ 위험 영역
                        </div>
                        <p className="text-xs text-red-700 mb-3 leading-relaxed">
                          브랜드 삭제 시 연결된 지식노트·이미지 라이브러리·아이디어가 모두 함께 삭제됩니다. 되돌릴 수 없습니다.
                        </p>
                        <button
                          onClick={() => deleteBrand(editingBrandId)}
                          className="px-4 py-2 border border-red-300 rounded-lg text-red-700 hover:bg-red-100 font-medium text-sm"
                        >
                          🗑️ 이 브랜드 영구 삭제
                        </button>
                      </div>
                    )}
                  </section>
                )}

                {/* ========== 탭: 문서 ========== */}
                {brandModalTab === 'docs' && editingBrandId && (
                  <section className="space-y-5">
                    {/* 리스트 */}
                    <div className="space-y-2">
                      {knowledgeDocs.length === 0 ? (
                        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                          <div className="text-3xl mb-2">📄</div>
                          <p className="text-sm text-slate-500">
                            아직 등록된 문서가 없습니다.
                          </p>
                          <p className="text-xs text-slate-400 mt-1">
                            제품 설명, FAQ, 보도자료 등을 추가하면 카드 카피가 더 정확해집니다.
                          </p>
                        </div>
                      ) : (
                        knowledgeDocs.map((d) => (
                          <div
                            key={d.id}
                            className="group flex items-start justify-between gap-3 border border-slate-200 rounded-lg px-4 py-3 bg-white hover:border-slate-400 transition"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold truncate">{d.title}</div>
                              <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center gap-1">
                                  📄 {d.sourceType}
                                </span>
                                <span>· 청크 {d.chunkCount}개</span>
                                <span>· {new Date(d.createdAt).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <button
                              onClick={() => deleteKnowledgeDoc(d.id)}
                              className="text-sm px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg hover:border-red-300 hover:text-red-700 hover:bg-red-50 shrink-0"
                            >
                              삭제
                            </button>
                          </div>
                        ))
                      )}
                    </div>

                    {/* 추가 폼 */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                      <div className="text-sm font-semibold text-slate-700">
                        + 새 문서 추가
                      </div>
                      <input
                        value={newDocTitle}
                        onChange={(e) => setNewDocTitle(e.target.value)}
                        placeholder="문서 제목 (예: 유순 브랜드 소개서)"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:border-indigo-500"
                      />
                      <textarea
                        value={newDocText}
                        onChange={(e) => setNewDocText(e.target.value)}
                        rows={6}
                        placeholder="본문 — 제품 설명, FAQ, 보도자료 등&#10;서버에서 자동으로 ~500자 단위 청크로 분할됩니다."
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white resize-y focus:border-indigo-500"
                      />
                      <button
                        onClick={createKnowledgeDoc}
                        disabled={docSaving || !newDocTitle.trim() || !newDocText.trim()}
                        className="px-4 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {docSaving ? '저장 중…' : '+ 문서 추가'}
                      </button>
                    </div>
                  </section>
                )}

                {/* ========== 탭: 이미지 라이브러리 (통합) ========== */}
                {brandModalTab === 'images' && editingBrandId && (
                  <section className="space-y-5">
                    {/* 상단 카운트 요약 */}
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                        기본 에셋 {newBrand.assets.length}
                      </span>
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-50 text-violet-800 border border-violet-200">
                        <span className="w-2 h-2 rounded-full bg-violet-500"></span>
                        라이브러리 {knowledgeImages.length}
                      </span>
                    </div>

                    {/* 썸네일 그리드 */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {knowledgeImages.length === 0 && newBrand.assets.length === 0 && (
                        <div className="col-span-full text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                          <div className="text-3xl mb-2">🖼️</div>
                          <p className="text-sm text-slate-500">등록된 이미지가 없습니다.</p>
                          <p className="text-xs text-slate-400 mt-1">
                            아래에서 제품 컷·로고 등을 업로드해 태그를 달아두면 카드 생성 시 자동 활용됩니다.
                          </p>
                        </div>
                      )}
                      {/* 기본 에셋 — BrandAsset */}
                      {newBrand.assets.map((img, i) => (
                        <div
                          key={`asset-${i}`}
                          className="group relative border border-amber-200 rounded-xl overflow-hidden bg-amber-50/40"
                        >
                          <img src={img.url} alt="" className="w-full aspect-square object-cover" />
                          <div className="absolute top-1.5 left-1.5 bg-amber-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            기본
                          </div>
                          <button
                            onClick={() =>
                              setNewBrand((prev) => ({
                                ...prev,
                                assets: prev.assets.filter((_, j) => j !== i),
                              }))
                            }
                            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 text-slate-700 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition shadow"
                            title="기본 에셋에서 제거 (변경 저장 필요)"
                            aria-label="제거"
                          >
                            ×
                          </button>
                          <div className="p-2 text-xs truncate">{img.caption || '—'}</div>
                        </div>
                      ))}
                      {/* 태그 라이브러리 — BrandImageAsset */}
                      {knowledgeImages.map((img) => (
                        <div
                          key={img.id}
                          className="group relative border border-slate-200 rounded-xl overflow-hidden bg-white hover:border-violet-300 transition"
                        >
                          <img
                            src={img.thumbnailUrl || img.url}
                            alt=""
                            loading="lazy"
                            className="w-full aspect-square object-cover"
                          />
                          <div className="absolute top-1.5 left-1.5 bg-violet-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                            라이브러리
                          </div>
                          <button
                            onClick={() => deleteKnowledgeImage(img.id)}
                            className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-white/90 text-slate-700 hover:bg-red-50 hover:text-red-600 opacity-0 group-hover:opacity-100 transition shadow"
                            title="삭제"
                            aria-label="삭제"
                          >
                            ×
                          </button>
                          <div className="p-2 space-y-0.5">
                            <div className="text-xs font-medium truncate">
                              {img.label || '(라벨 없음)'}
                            </div>
                            {img.tags.length > 0 && (
                              <div className="text-[10px] text-slate-500 truncate">
                                #{img.tags.join(' #')}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 업로드 폼 */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                      <div className="text-sm font-semibold text-slate-700">
                        + 라이브러리에 이미지 추가
                      </div>
                      <input
                        value={newImageLabel}
                        onChange={(e) => setNewImageLabel(e.target.value)}
                        placeholder="라벨 (예: 유순 제품 메인컷)"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:border-indigo-500"
                      />
                      <input
                        value={newImageTags}
                        onChange={(e) => setNewImageTags(e.target.value)}
                        placeholder="태그 (쉼표·공백 구분, 예: 제품, 화이트배경, 패키지)"
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 bg-white focus:border-indigo-500"
                      />
                      <label
                        className={`block border-2 border-dashed border-violet-300 rounded-xl p-5 text-center cursor-pointer bg-white hover:bg-violet-50 transition ${
                          imageUploading ? 'opacity-60 pointer-events-none' : ''
                        }`}
                      >
                        <div className="text-3xl mb-1">{imageUploading ? '⏳' : '📤'}</div>
                        <div className="text-sm font-medium text-violet-800">
                          {imageUploading ? '업로드 중…' : '이미지 파일 선택 · 등록'}
                        </div>
                        <div className="text-xs text-slate-500 mt-1">
                          JPG · PNG · WebP · 최대 15MB
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0]
                            if (f) addKnowledgeImage(f)
                            e.target.value = ''
                          }}
                        />
                      </label>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        업로드 시 본인 저작권/사용권 보유에 동의한 것으로 간주됩니다.
                      </p>
                    </div>
                  </section>
                )}

                {/* ========== 탭: 아이디어 ========== */}
                {brandModalTab === 'ideas' && editingBrandId && (
                  <section className="space-y-5">
                    {/* 헤더 + 액션 */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-sm text-slate-500 flex-1 min-w-0">
                        등록한 지식노트·이미지를 기반으로 <strong>Gemini</strong> 가 카드뉴스 주제를 제안합니다.
                      </div>
                      <div className="flex gap-2">
                        {ideas.length > 0 && (
                          <button
                            onClick={deleteAllIdeas}
                            className="px-3 py-2 border border-slate-300 rounded-lg text-sm hover:bg-slate-50"
                          >
                            전체 삭제
                          </button>
                        )}
                        <button
                          onClick={fetchIdeas}
                          disabled={
                            ideasLoading ||
                            (knowledgeDocs.length === 0 && knowledgeImages.length === 0)
                          }
                          className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white rounded-lg font-semibold text-sm shadow-sm disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          {ideasLoading
                            ? '⏳ 분석 중…'
                            : ideas.length
                              ? '✨ + 5개 더 추천'
                              : '✨ 아이디어 요청'}
                        </button>
                      </div>
                    </div>

                    {knowledgeDocs.length === 0 && knowledgeImages.length === 0 && (
                      <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                        <div className="text-3xl mb-2">💡</div>
                        <p className="text-sm text-slate-500">
                          문서나 이미지를 먼저 1개 이상 등록해 주세요.
                        </p>
                      </div>
                    )}
                    {ideasError && (
                      <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 leading-relaxed">
                        <strong>오류:</strong> {ideasError}
                      </div>
                    )}
                    {ideas.length > 0 && (
                      <div className="space-y-3">
                        {ideas.map((idea) => (
                          <div
                            key={idea.id}
                            className="group border border-slate-200 rounded-xl p-4 bg-white hover:border-violet-400 hover:shadow-sm transition"
                          >
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex-1 min-w-0">
                                <div className="font-bold text-slate-900">{idea.title}</div>
                                <div className="inline-block mt-1 px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 text-xs font-semibold">
                                  {idea.suggestedCount}장
                                </div>
                              </div>
                              <button
                                onClick={() => deleteIdea(idea.id)}
                                className="w-8 h-8 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 text-lg leading-none shrink-0"
                                title="삭제"
                                aria-label="아이디어 삭제"
                              >
                                ×
                              </button>
                            </div>
                            <div className="text-sm text-slate-700 mb-2 leading-relaxed italic border-l-2 border-violet-200 pl-3">
                              "{idea.prompt}"
                            </div>
                            <div className="text-xs text-slate-500 mb-3 leading-relaxed">
                              💬 {idea.reason}
                            </div>
                            {idea.usesImages.length > 0 && (
                              <div className="text-xs text-slate-400 mb-3">
                                활용 이미지:{' '}
                                {idea.usesImages.map((t) => (
                                  <span
                                    key={t}
                                    className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 mr-1"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            <button
                              onClick={() => applyIdea(idea)}
                              className="w-full px-3 py-2.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-sm font-semibold shadow-sm transition"
                            >
                              이 아이디어로 카드 생성하기 →
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 공용 confirm/alert 다이얼로그 — 네이티브 팝업 대체 */}
      {dialog && (() => {
        const variant = dialog.variant ?? 'default'
        const variantStyles: Record<
          DialogVariant,
          { icon: string; accent: string; button: string }
        > = {
          default: {
            icon: '',
            accent: 'bg-indigo-100 text-indigo-700',
            button: 'bg-indigo-700 hover:bg-indigo-800 text-white',
          },
          danger: {
            icon: '⚠️',
            accent: 'bg-red-100 text-red-700',
            button: 'bg-red-600 hover:bg-red-700 text-white',
          },
          warning: {
            icon: '⚠',
            accent: 'bg-amber-100 text-amber-800',
            button: 'bg-amber-600 hover:bg-amber-700 text-white',
          },
          info: {
            icon: 'ℹ️',
            accent: 'bg-sky-100 text-sky-700',
            button: 'bg-sky-700 hover:bg-sky-800 text-white',
          },
          success: {
            icon: '✓',
            accent: 'bg-emerald-100 text-emerald-700',
            button: 'bg-emerald-700 hover:bg-emerald-800 text-white',
          },
        }
        const vs = variantStyles[variant]
        const isConfirm = dialog.type === 'confirm'
        return (
          <div
            className="fixed inset-0 z-[70] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => isConfirm && closeDialog(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
            >
              <div className="p-6">
                <div className="flex items-start gap-3">
                  {vs.icon && (
                    <div
                      className={`shrink-0 w-11 h-11 rounded-full flex items-center justify-center text-xl ${vs.accent}`}
                      aria-hidden
                    >
                      {vs.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-slate-900 leading-tight">
                      {dialog.title}
                    </h3>
                    <p className="mt-1.5 text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">
                      {dialog.message}
                    </p>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 bg-slate-50 border-t flex justify-end gap-2">
                {isConfirm && (
                  <button
                    onClick={() => closeDialog(false)}
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-white"
                    autoFocus={!isConfirm}
                  >
                    {dialog.cancelLabel ?? '취소'}
                  </button>
                )}
                <button
                  onClick={() => closeDialog(true)}
                  className={`px-5 py-2 rounded-lg text-sm font-semibold shadow-sm ${vs.button}`}
                  autoFocus={!isConfirm || variant !== 'danger'}
                >
                  {dialog.confirmLabel ?? (isConfirm ? '확인' : '닫기')}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* AI 이미지 생성 모달 — 촌스러운 window.prompt 대체 */}
      {aiGenDialog && (() => {
        const card = cards.find((c) => c.id === aiGenDialog.cardId)
        const closeDialog = () => {
          if (!aiGenDialog.loading) setAiGenDialog(null)
        }
        return (
          <div
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={closeDialog}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="border-b px-5 py-4 flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                  <span>🎨</span> AI 이미지 생성
                </h2>
                <button
                  onClick={closeDialog}
                  disabled={aiGenDialog.loading}
                  className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-900 text-2xl leading-none flex items-center justify-center disabled:opacity-40"
                  aria-label="닫기"
                >
                  ×
                </button>
              </div>

              <div className="p-5 space-y-4">
                {card?.imageUrl && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
                    <img
                      src={card.imageUrl}
                      alt=""
                      className="w-14 h-14 rounded-md object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs text-slate-500">현재 이미지</div>
                      <div className="text-sm text-slate-700 truncate">
                        {card.title || '(제목 없음)'}
                      </div>
                      <div className="text-xs text-slate-400">
                        새로 생성하면 이 이미지는 교체됩니다
                      </div>
                    </div>
                  </div>
                )}

                <label className="block">
                  <span className="text-sm font-semibold text-slate-700">
                    이미지 설명
                  </span>
                  <span className="ml-2 text-xs font-normal text-slate-400">
                    장면·구도·색감을 구체적으로
                  </span>
                  <textarea
                    rows={5}
                    value={aiGenDialog.prompt}
                    onChange={(e) =>
                      setAiGenDialog((d) => (d ? { ...d, prompt: e.target.value, error: null } : d))
                    }
                    disabled={aiGenDialog.loading}
                    placeholder="예) 따뜻한 베이지 배경에 제품이 중앙, 부드러운 자연광, 여유로운 여백"
                    className="mt-1.5 w-full border border-slate-300 rounded-lg px-3 py-2.5 resize-none focus:border-fuchsia-500 disabled:bg-slate-50"
                    autoFocus
                  />
                </label>

                <div className="text-xs text-slate-500 leading-relaxed space-y-1">
                  <div>
                    💡 브랜드 스타일 레시피 + Mode A 참조 이미지가{' '}
                    <span className="text-slate-700 font-medium">자동 반영</span> 됩니다.
                  </div>
                  <div>
                    ⏱️ 약 5~10초 소요 · 이미지 1회 생성 비용 ≈ 53원
                  </div>
                </div>

                {aiGenDialog.error && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3 leading-relaxed">
                    <strong>오류:</strong> {aiGenDialog.error}
                  </div>
                )}
              </div>

              <div className="border-t px-5 py-3 flex items-center justify-end gap-2 bg-slate-50">
                <button
                  onClick={closeDialog}
                  disabled={aiGenDialog.loading}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium hover:bg-white disabled:opacity-40"
                >
                  취소
                </button>
                <button
                  onClick={submitAiGenerate}
                  disabled={aiGenDialog.loading || !aiGenDialog.prompt.trim()}
                  className="px-5 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-sm font-semibold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {aiGenDialog.loading ? (
                    <>
                      <svg
                        className="animate-spin h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                          opacity="0.25"
                        />
                        <path
                          fill="currentColor"
                          d="M12 2a10 10 0 0 1 10 10h-3a7 7 0 0 0-7-7V2z"
                        />
                      </svg>
                      생성 중…
                    </>
                  ) : (
                    <>🎨 생성하기</>
                  )}
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 푸터 */}
      <footer className="mt-20 pt-6 border-t border-slate-100 text-[13px] text-slate-500 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <div
            className="w-5 h-5 rounded-md flex items-center justify-center text-white font-bold text-[8px]"
            style={{ background: 'linear-gradient(145deg, #4338ca, #312e81)' }}
            aria-hidden
          >
            N2C
          </div>
          <span>© 2026 Note2Card</span>
        </div>
        <div className="flex items-center gap-5">
          <a href="/pricing" className="hover:text-slate-900 transition">
            요금제
          </a>
          <a href="/terms" className="hover:text-slate-900 transition">
            이용약관
          </a>
          <a href="/privacy" className="hover:text-slate-900 transition">
            개인정보처리방침
          </a>
        </div>
      </footer>
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
  onAiEdit,
  onAiGenerate,
  onDownload,
  onMoveUp,
  onMoveDown,
  onDelete,
  onRelayout,
  customSize,
}: {
  card: CardData
  brand?: Brand
  size: SizePreset
  customSize: { w: number; h: number }
  index: number
  total: number
  backgrounds: BackgroundTemplate[]
  selected: boolean
  onSelect: () => void
  onChange: (patch: Partial<CardData>) => void
  onImageFile: (f: File) => void
  onAiEdit: () => Promise<void>
  onAiGenerate: () => void
  onDownload: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
  onRelayout?: () => Promise<void>
}) {
  const [aiEditing, setAiEditing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [styleOpen, setStyleOpen] = useState(false)
  const [styleTab, setStyleTab] = useState<'title' | 'body' | 'subtext' | 'cta'>('title')
  const [relayouting, setRelayouting] = useState(false)
  const d = resolveSizePx(size, customSize)
  const ratio = d.display / d.w
  const height = Math.round(d.h * ratio)
  const primary = brand?.primaryColor ?? '#0f766e'
  const bg = brand?.secondaryColor ?? '#f0fdfa'
  const text = brand?.textColor ?? '#111827'
  const font = brand?.fontFamily ?? 'Pretendard, sans-serif'

  const isCover = card.layout === 'cover'
  const onImage = !!card.imageUrl && isCover

  // 텍스트 스타일 — 카드 레벨 + 요소별 오버라이드.
  const ts = card.textStyle ?? {}
  const cardScale = Math.max(0.6, Math.min(1.6, ts.sizeScale ?? 1.0))
  const cardAlign = ts.align ?? 'left'
  const verticalAlign =
    ts.verticalAlign ?? (isCover ? 'bottom' : card.layout === 'cta' ? 'center' : 'center')

  // 각 요소별 해석 (오버라이드 없으면 카드 레벨로 폴백)
  const elemScale = (el?: { sizeScale?: number }) =>
    Math.max(0.5, Math.min(2.0, el?.sizeScale ?? cardScale))
  const elemAlign = (el?: { align?: 'left' | 'center' | 'right' }) => el?.align ?? cardAlign

  const titleScale = elemScale(ts.title)
  const bodyScale = elemScale(ts.body)
  const subtextScale = elemScale(ts.subtext)
  const ctaScale = elemScale(ts.cta)

  const titleWeight = ts.title?.weight ?? ts.titleWeight ?? 800
  const bodyWeight = ts.body?.weight ?? 400
  const subtextWeight = ts.subtext?.weight ?? 500
  const ctaWeight = ts.cta?.weight ?? 600

  const titleSize = Math.round((isCover ? d.display * 0.08 : d.display * 0.062) * titleScale)
  const bodySize = Math.round(d.display * 0.042 * bodyScale)
  const subtextSize = Math.round(d.display * 0.036 * subtextScale)
  const ctaSize = Math.round(d.display * 0.04 * ctaScale)
  const pad = Math.round(d.display * 0.08)

  const justifyContent =
    verticalAlign === 'top' ? 'flex-start' : verticalAlign === 'bottom' ? 'flex-end' : 'center'

  // 요소별 정렬 (오버라이드 없으면 카드 정렬)
  const titleAlign = elemAlign(ts.title)
  const bodyAlign = elemAlign(ts.body)
  const subtextAlign = elemAlign(ts.subtext)
  const ctaAlign = elemAlign(ts.cta)
  const toAlignSelf = (a: 'left' | 'center' | 'right') =>
    a === 'center' ? 'center' : a === 'right' ? 'flex-end' : 'flex-start'

  // 요소별 컬러 오버라이드 — 미지정 시 기존 브랜드/이미지 감각 유지
  const titleColor = ts.title?.color
  const bodyColor = ts.body?.color
  const subtextColor = ts.subtext?.color
  const ctaColor = ts.cta?.color

  // 렌더 직전 페이지 번호·순번 흔적 제거 — 이미지에 찍히는 것 방지.
  // 백엔드 (schema.ts stripPageNumber) 와 동일 규칙을 프론트에서도 한 번 더 적용.
  const scrubPageNumbers = (s: string | undefined): string => {
    if (!s) return ''
    let out = s
      .replace(/\b\d{1,2}\s*\/\s*\d{1,2}\b/g, '') // 1/5, 10/10
      .replace(/\b\d{1,2}\s+of\s+\d{1,2}\b/gi, '') // 1 of 5
      .replace(/\bpage\s*\d{1,2}\b/gi, '') // page 2
      .replace(/[\(\[【]\s*\d{1,2}\s*\/\s*\d{1,2}\s*[\)\]】]/g, '') // (1/5)
      .replace(/[·\-–—•|]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s,.;:!?/()\[\]【】]+|[\s,.;:!?/()\[\]【】]+$/g, '')
      .trim()
    return out
  }
  const renderedSubtext = scrubPageNumbers(card.subtext)
  const renderedCta = scrubPageNumbers(card.cta)

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      id={`card-item-${card.id}`}
      onClick={onSelect}
      className={`border rounded-xl bg-white p-3 space-y-2 transition cursor-pointer ${
        selected ? 'ring-2 ring-indigo-500 border-indigo-400' : 'hover:border-slate-300'
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
              onDelete()
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
        {/* LayoutDSL 누락 경고 — product-ad/promo 인데 DSL 이 안 생성된 경우 */}
        {(card.template === 'product-ad' || card.template === 'promo') &&
          !card.layoutDsl && (
            <div className="absolute top-2 left-2 z-20 px-2 py-1 rounded bg-amber-500 text-white text-[10px] font-bold shadow">
              ⚠ AI 구도 생성 실패 · 기본 렌더로 폴백
            </div>
          )}
        {(card.template === 'product-ad' || card.template === 'promo') && card.layoutDsl ? (
          <div id={`card-${card.id}`}>
            {/* LayoutDSL 기반 자유 배치.
                card.title/body/subtext/cta 를 override 로 넘겨 인라인 편집 즉시 반영 +
                LLM 이 body 블록 누락해도 card.body 가 있으면 자동 주입. */}
            <LayoutRenderer
              dsl={card.layoutDsl}
              displayWidth={d.display}
              imageUrl={card.imageUrl}
              imageFitOverride={card.imageFitOverride}
              titleOverride={card.title}
              bodyOverride={card.body}
              subtitleOverride={card.subtext}
              ctaOverride={card.cta}
            />
          </div>
        ) : (card.template === 'product-ad' || card.template === 'promo') && card.design ? (
          <div id={`card-${card.id}`}>
            {/* 레거시 DynamicCard — DSL 이 없는 구형 카드용 fallback */}
            <DynamicCard
              design={card.design}
              backgroundImageUrl={card.imageUrl}
              displayWidth={d.display}
              aspectRatio={size === '4:5' ? '4:5' : size === '9:16' ? '9:16' : '1:1'}
              layoutMode={card.layoutMode}
              imageFit={card.imageFit}
              secondaryColor={brand?.secondaryColor}
            />
          </div>
        ) : (
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
              justifyContent,
              gap: Math.round(d.display * 0.018),
            }}
          >
            {renderedSubtext && (
              <div
                style={{
                  fontSize: subtextSize,
                  fontWeight: subtextWeight,
                  letterSpacing: '0.04em',
                  color: subtextColor ?? (onImage ? '#e2e8f0' : primary),
                  textAlign: subtextAlign,
                }}
              >
                {renderedSubtext}
              </div>
            )}
            <div
              style={{
                fontSize: titleSize,
                fontWeight: titleWeight,
                color: titleColor ?? (onImage ? '#ffffff' : text),
                lineHeight: 1.25,
                letterSpacing: '-0.02em',
                textAlign: titleAlign,
              }}
            >
              {card.title || ' '}
            </div>
            {card.body && (
              <div
                style={{
                  fontSize: bodySize,
                  fontWeight: bodyWeight,
                  lineHeight: 1.65,
                  color: bodyColor ?? (onImage ? '#f8fafc' : text),
                  whiteSpace: 'pre-wrap',
                  textAlign: bodyAlign,
                }}
              >
                {card.body}
              </div>
            )}
            {renderedCta && (
              <div
                style={{
                  alignSelf: toAlignSelf(ctaAlign),
                  marginTop: Math.round(d.display * 0.015),
                  fontSize: ctaSize,
                  fontWeight: ctaWeight,
                  color: ctaColor ?? (onImage ? primary : '#ffffff'),
                  background: onImage ? '#ffffff' : primary,
                  padding: `${Math.round(d.display * 0.018)}px ${Math.round(d.display * 0.038)}px`,
                  borderRadius: Math.round(d.display * 0.015),
                }}
              >
                {renderedCta}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {/* 인라인 텍스트 편집 — 입력 즉시 프리뷰 반영.
          product-ad / promo 는 DynamicCard 가 card.design.* 를 렌더하므로
          모든 텍스트 인풋을 design.* 로 바인딩해 즉시 프리뷰에 반영되게 한다. */}
      {card.template === 'product-ad' || card.template === 'promo' ? (
        <>
          {/* DSL 카드는 LayoutRenderer 가 card.title/body/subtext/cta 를 override 로 읽음.
              레거시 design 필드는 더 이상 갱신하지 않음. */}
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
              placeholder="서브타이틀"
            />
            <input
              className="border rounded-md px-2 py-1 text-sm"
              value={card.cta}
              onChange={(e) => onChange({ cta: e.target.value })}
              onClick={stop}
              placeholder="CTA 라벨"
            />
          </div>
        </>
      ) : (
        <>
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
        </>
      )}

      {/* 상품 광고 / 프로모션 전용 필드 인라인 편집 */}
      {(card.template === 'product-ad' || card.template === 'promo') && (
        <div
          onClick={stop}
          className="border border-indigo-100 rounded-md bg-indigo-50/40 p-2.5 space-y-2"
        >
          <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">
            {card.template === 'promo' ? '프로모션 필드' : '상품 광고 필드'}
          </div>
          {/* AI 배치 다시 뽑기 — layoutDsl 있는 카드에만 노출 */}
          {card.layoutDsl && onRelayout && (
            <button
              onClick={async () => {
                if (relayouting) return
                setRelayouting(true)
                try {
                  await onRelayout()
                } finally {
                  setRelayouting(false)
                }
              }}
              disabled={relayouting}
              className="w-full px-3 py-2 rounded-md bg-indigo-600 text-white text-[12px] font-semibold hover:bg-indigo-700 transition disabled:opacity-50"
            >
              {relayouting ? '새 배치 생성 중…' : '🎲 AI 배치 다시 뽑기'}
            </button>
          )}
          {/* 레거시 카드(design only) 용 layoutMode/imageFit 토글 */}
          {!card.layoutDsl && card.design && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="block text-[10px] text-slate-500 mb-1">레이아웃</span>
                <div className="grid grid-cols-3 gap-1">
                  {(
                    [
                      { k: 'split', label: '좌우' },
                      { k: 'hero', label: '전면' },
                      { k: 'top-image', label: '상하' },
                    ] as const
                  ).map((o) => {
                    const active = (card.layoutMode ?? 'split') === o.k
                    return (
                      <button
                        key={o.k}
                        onClick={() => onChange({ layoutMode: o.k })}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 mb-1">이미지 핏</span>
                <div className="grid grid-cols-2 gap-1">
                  {(
                    [
                      { k: 'contain', label: '맞춤' },
                      { k: 'cover', label: '채움' },
                    ] as const
                  ).map((o) => {
                    const active = (card.imageFit ?? 'contain') === o.k
                    return (
                      <button
                        key={o.k}
                        onClick={() => onChange({ imageFit: o.k })}
                        className={`px-2 py-1 rounded text-[11px] font-semibold transition ${
                          active
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          {/* 뱃지 — CTA 라벨은 상단 subtext/cta 자리에서 편집 */}
          <label className="block">
            <span className="block text-[10px] text-slate-500 mb-0.5">뱃지</span>
            <input
              className="w-full border rounded-md px-2 py-1 text-xs"
              value={card.design?.badgeLabel ?? ''}
              onChange={(e) =>
                card.design &&
                onChange({
                  design: { ...card.design, badgeLabel: e.target.value },
                })
              }
              placeholder="BEST SELLER"
              maxLength={20}
            />
          </label>
          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="block text-[10px] text-slate-500 mb-0.5">원가(₩)</span>
              <input
                type="number"
                className="w-full border rounded-md px-2 py-1 text-xs tabular-nums"
                value={card.design?.priceOriginal ?? ''}
                onChange={(e) =>
                  card.design &&
                  onChange({
                    design: {
                      ...card.design,
                      priceOriginal: e.target.value ? Number(e.target.value) : undefined,
                    },
                  })
                }
                placeholder="38000"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] text-slate-500 mb-0.5">판매가(₩)</span>
              <input
                type="number"
                className="w-full border rounded-md px-2 py-1 text-xs tabular-nums"
                value={card.design?.priceSale ?? ''}
                onChange={(e) =>
                  card.design &&
                  onChange({
                    design: {
                      ...card.design,
                      priceSale: e.target.value ? Number(e.target.value) : undefined,
                    },
                  })
                }
                placeholder="30400"
              />
            </label>
            <label className="block">
              <span className="block text-[10px] text-slate-500 mb-0.5">할인율(%)</span>
              <input
                type="number"
                min={1}
                max={99}
                className="w-full border rounded-md px-2 py-1 text-xs tabular-nums"
                value={card.design?.discountPercent ?? ''}
                onChange={(e) => {
                  if (!card.design) return
                  const v = e.target.value ? Number(e.target.value) : undefined
                  const clamped =
                    typeof v === 'number' ? Math.max(1, Math.min(99, v)) : undefined
                  onChange({
                    design: { ...card.design, discountPercent: clamped },
                  })
                }}
                placeholder="20"
              />
            </label>
          </div>
          <label className="block">
            <span className="block text-[10px] text-slate-500 mb-0.5">마감 문구</span>
            <input
              className="w-full border rounded-md px-2 py-1 text-xs"
              value={card.design?.deadlineText ?? ''}
              onChange={(e) =>
                card.design &&
                onChange({
                  design: { ...card.design, deadlineText: e.target.value },
                })
              }
              placeholder="5월 5일까지"
              maxLength={24}
            />
          </label>

          {/* 팔레트 — dominant / accent / 글자색 컬러 피커 */}
          {card.design && (
            <div className="pt-1 border-t border-indigo-100">
              <div className="text-[10px] font-semibold text-indigo-700 uppercase tracking-wider mb-1.5">
                팔레트
              </div>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { k: 'dominant', label: '배경' },
                    { k: 'accent', label: '강조' },
                    { k: 'textOnDominant', label: '글자' },
                  ] as const
                ).map((p) => {
                  const currentColor =
                    card.design?.palette?.[p.k] ??
                    (p.k === 'textOnDominant' ? '#ffffff' : '#1a1a2e')
                  return (
                    <label key={p.k} className="block">
                      <span className="block text-[10px] text-slate-500 mb-0.5">{p.label}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={currentColor}
                          onChange={(e) =>
                            card.design &&
                            onChange({
                              design: {
                                ...card.design,
                                palette: { ...card.design.palette, [p.k]: e.target.value },
                              },
                            })
                          }
                          className="w-8 h-7 p-0 border border-slate-200 rounded cursor-pointer flex-shrink-0"
                          title={p.label}
                        />
                        <input
                          type="text"
                          value={currentColor}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            if (/^#?[0-9a-fA-F]{6}$/.test(v)) {
                              card.design &&
                                onChange({
                                  design: {
                                    ...card.design,
                                    palette: {
                                      ...card.design.palette,
                                      [p.k]: v.startsWith('#') ? v : `#${v}`,
                                    },
                                  },
                                })
                            }
                          }}
                          className="flex-1 min-w-0 text-[10px] px-1.5 py-1 border border-slate-200 rounded font-mono"
                        />
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 텍스트 스타일 편집 — 상품광고·프로모션 템플릿은 고정 디자인이라 표시하지 않음 */}
      {card.template !== 'product-ad' && card.template !== 'promo' && (
      <div className="border rounded-md bg-slate-50/50" onClick={stop}>
        <button
          onClick={(e) => { stop(e); setStyleOpen((v) => !v) }}
          className="w-full px-3 py-1.5 text-xs flex items-center justify-between hover:bg-slate-100 rounded-md"
        >
          <span className="font-semibold text-slate-700">텍스트 스타일</span>
          <span className="text-slate-500">{styleOpen ? '▴' : '▾'}</span>
        </button>
        {styleOpen && (
          <div className="px-3 pb-3 pt-1 space-y-3 border-t">
            {/* 카드 전체 수직 위치 */}
            <div>
              <div className="text-[11px] font-medium text-slate-600 mb-1">수직 위치 (카드 전체)</div>
              <div className="grid grid-cols-3 gap-1">
                {(['top', 'center', 'bottom'] as const).map((v) => {
                  const currentDefault = isCover ? 'bottom' : 'center'
                  const active = (ts.verticalAlign ?? currentDefault) === v
                  const label = v === 'top' ? '위' : v === 'center' ? '가운데' : '아래'
                  return (
                    <button
                      key={v}
                      onClick={(e) => {
                        stop(e)
                        onChange({ textStyle: { ...ts, verticalAlign: v } })
                      }}
                      className={`px-2 py-1.5 text-xs rounded border transition ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white hover:bg-slate-50'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 요소 탭 */}
            <div>
              <div className="flex border-b border-slate-200">
                {(
                  [
                    { k: 'title', label: '제목' },
                    { k: 'body', label: '본문' },
                    { k: 'subtext', label: '보조' },
                    { k: 'cta', label: 'CTA' },
                  ] as const
                ).map((t) => {
                  const active = styleTab === t.k
                  return (
                    <button
                      key={t.k}
                      onClick={(e) => { stop(e); setStyleTab(t.k) }}
                      className={`flex-1 px-2 py-1.5 text-xs font-medium border-b-2 -mb-px transition ${
                        active
                          ? 'border-indigo-600 text-indigo-700'
                          : 'border-transparent text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      {t.label}
                    </button>
                  )
                })}
              </div>

              {(() => {
                const elem = ts[styleTab] ?? {}
                const defaultWeights = { title: 800, body: 400, subtext: 500, cta: 600 }
                const currentWeight = elem.weight ?? (styleTab === 'title' ? (ts.titleWeight ?? 800) : defaultWeights[styleTab])
                const currentSize = elem.sizeScale ?? ts.sizeScale ?? 1
                const currentAlign = elem.align ?? ts.align ?? 'left'
                const update = (patch: {
                  sizeScale?: number
                  weight?: number
                  align?: 'left' | 'center' | 'right'
                  color?: string
                }) => {
                  const nextElem: Record<string, unknown> = { ...elem, ...patch }
                  // undefined 로 지정된 키는 제거 (기본값 복귀)
                  for (const k of Object.keys(patch)) {
                    if ((patch as any)[k] === undefined) delete nextElem[k]
                  }
                  onChange({ textStyle: { ...ts, [styleTab]: nextElem } })
                }

                return (
                  <div className="pt-3 space-y-3">
                    {/* 요소 정렬 */}
                    <div>
                      <div className="text-[11px] font-medium text-slate-600 mb-1">정렬</div>
                      <div className="grid grid-cols-3 gap-1">
                        {(['left', 'center', 'right'] as const).map((a) => {
                          const active = currentAlign === a
                          const label = a === 'left' ? '왼쪽' : a === 'center' ? '중앙' : '오른쪽'
                          return (
                            <button
                              key={a}
                              onClick={(e) => { stop(e); update({ align: a }) }}
                              className={`px-2 py-1.5 text-xs rounded border transition ${
                                active
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* 요소 크기 */}
                    <div>
                      <div className="text-[11px] font-medium text-slate-600 mb-1 flex items-center justify-between">
                        <span>글자 크기</span>
                        <span className="text-slate-400 tabular-nums">{Math.round(currentSize * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        value={currentSize}
                        onChange={(e) => update({ sizeScale: Number(e.target.value) })}
                        className="w-full accent-indigo-600"
                      />
                      <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                        <span>작게</span>
                        <span>기본</span>
                        <span>크게</span>
                      </div>
                    </div>

                    {/* 요소 굵기 */}
                    <div>
                      <div className="text-[11px] font-medium text-slate-600 mb-1">굵기</div>
                      <div className="grid grid-cols-5 gap-1">
                        {([300, 400, 600, 700, 900] as const).map((w) => {
                          const active = currentWeight === w
                          const label = w === 300 ? '얇게' : w === 400 ? '기본' : w === 600 ? '중간' : w === 700 ? '굵게' : '진하게'
                          return (
                            <button
                              key={w}
                              onClick={(e) => { stop(e); update({ weight: w }) }}
                              style={{ fontWeight: w }}
                              className={`px-1 py-1.5 text-[11px] rounded border transition ${
                                active
                                  ? 'bg-slate-900 text-white border-slate-900'
                                  : 'bg-white hover:bg-slate-50'
                              }`}
                            >
                              {label}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    {/* 컬러 */}
                    <div>
                      <div className="text-[11px] font-medium text-slate-600 mb-1 flex items-center justify-between">
                        <span>글자 색상</span>
                        <span className="text-slate-400 tabular-nums">
                          {elem.color ?? '기본'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={elem.color ?? '#111827'}
                          onChange={(e) => update({ color: e.target.value })}
                          onClick={stop}
                          className="w-10 h-8 p-0 border border-slate-200 rounded cursor-pointer"
                          title="컬러 선택"
                        />
                        <input
                          type="text"
                          value={elem.color ?? ''}
                          onChange={(e) => {
                            const v = e.target.value.trim()
                            if (!v) update({ color: undefined })
                            else if (/^#?[0-9a-fA-F]{3,6}$/.test(v)) {
                              update({ color: v.startsWith('#') ? v : `#${v}` })
                            }
                          }}
                          onClick={stop}
                          placeholder="#111827"
                          className="flex-1 text-[11px] px-2 py-1 border border-slate-200 rounded font-mono"
                        />
                        {elem.color && (
                          <button
                            onClick={(e) => {
                              stop(e)
                              update({ color: undefined })
                            }}
                            className="text-[11px] px-2 py-1 border rounded bg-white hover:bg-slate-50 text-slate-500"
                            title="기본값으로"
                          >
                            기본
                          </button>
                        )}
                      </div>
                    </div>

                    {/* 요소 초기화 */}
                    {Object.keys(elem).length > 0 && (
                      <button
                        onClick={(e) => {
                          stop(e)
                          const { [styleTab]: _, ...rest } = ts
                          onChange({ textStyle: Object.keys(rest).length > 0 ? rest : undefined })
                        }}
                        className="w-full text-[11px] py-1 border rounded bg-white hover:bg-slate-50 text-slate-600"
                      >
                        이 요소 초기화
                      </button>
                    )}
                  </div>
                )
              })()}
            </div>

            {/* 전체 초기화 */}
            {Object.keys(ts).length > 0 && (
              <button
                onClick={(e) => {
                  stop(e)
                  onChange({ textStyle: undefined })
                }}
                className="w-full text-[11px] py-1 border rounded bg-white hover:bg-slate-50 text-slate-600"
              >
                전체 스타일 기본값으로 초기화
              </button>
            )}
          </div>
        )}
      </div>
      )}

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
        {card.imageUrl && (
          <button
            disabled={aiEditing}
            onClick={async (e) => {
              stop(e)
              setAiEditing(true)
              setAiError(null)
              try {
                await onAiEdit()
              } catch (err: any) {
                setAiError(err?.message ?? '편집 실패')
              } finally {
                setAiEditing(false)
              }
            }}
            className="text-xs px-2 py-1 border rounded-md bg-violet-600 text-white disabled:opacity-60"
            title="Gemini 2.5 Flash Image 로 브랜드 톤에 맞춰 배경 재편집"
          >
            {aiEditing ? 'AI 편집 중…' : '✨ AI 보정'}
          </button>
        )}
        <button
          disabled={aiEditing}
          onClick={(e) => {
            stop(e)
            onAiGenerate()
          }}
          className="text-xs px-2 py-1 border rounded-md bg-fuchsia-600 text-white disabled:opacity-60"
          title="Gemini 2.5 Flash Image 로 새 이미지 생성 (텍스트 → 이미지)"
        >
          🎨 AI 생성
        </button>
        <button
          onClick={(e) => { stop(e); onDownload() }}
          className="text-xs px-2 py-1 border rounded-md ml-auto bg-slate-900 text-white"
        >
          PNG 다운로드
        </button>
      </div>
      {aiError && (
        <div className="text-[11px] text-red-600 leading-relaxed">AI 편집 오류: {aiError}</div>
      )}

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
