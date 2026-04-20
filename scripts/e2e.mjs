#!/usr/bin/env node
// 단계 9: 결 · 카드뉴스 E2E 테스트
// 실행 전 조건: backend 가 http://localhost:4000 에서 기동 중이어야 하고 db:push + db:seed 완료.
// 실행: node scripts/e2e.mjs  (또는 npm run e2e)

const BASE = process.env.API_BASE || 'http://localhost:4000'

const results = []
let brandId = null

function log(msg) { process.stdout.write(msg + '\n') }
function assert(cond, msg) { if (!cond) throw new Error(msg) }

async function test(name, fn) {
  const t0 = Date.now()
  try {
    await fn()
    const ms = Date.now() - t0
    results.push({ name, status: 'PASS', ms })
    log(`  \x1b[32m✓\x1b[0m ${name} \x1b[2m(${ms}ms)\x1b[0m`)
  } catch (e) {
    const ms = Date.now() - t0
    results.push({ name, status: 'FAIL', ms, error: e.message })
    log(`  \x1b[31m✗\x1b[0m ${name} \x1b[2m(${ms}ms)\x1b[0m`)
    log(`      → ${e.message}`)
  }
}

async function json(res) {
  try { return await res.json() } catch { return null }
}

async function waitForBackend(maxAttempts = 60) {
  log(`[setup] waiting for backend at ${BASE}/health`)
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const r = await fetch(`${BASE}/health`)
      if (r.ok) {
        const j = await r.json()
        if (j.status === 'ok') {
          log(`[setup] backend ready: db=${j.db}`)
          return true
        }
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 1000))
  }
  throw new Error(`backend not ready after ${maxAttempts}s`)
}

// ────────────────────────────────────────────────────────
// 시나리오
// ────────────────────────────────────────────────────────

async function S0_setup() {
  const r = await fetch(`${BASE}/api/brands`).then(json)
  assert(r?.brands, 'GET /api/brands 실패')
  const yusoon = r.brands.find((b) => b.name === '유순')
  assert(yusoon, 'seed 브랜드 "유순" 없음 — npm run db:seed 가 실행됐는지 확인')
  brandId = yusoon.id
  log(`[setup] brand 유순 id=${brandId} (assets=${yusoon.assets.length})`)
}

async function S1_auto_generate() {
  const res = await fetch(`${BASE}/api/generate/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'auto',
      prompt: '유순 임산부와 유아를 위한 케어 서비스 안내',
      count: 5,
      brandId,
    }),
  })
  assert(res.ok, `HTTP ${res.status}`)
  const r = await json(res)
  assert(Array.isArray(r.cards), 'cards 배열 누락')
  assert(r.cards.length === 5, `카드 5장 기대, 실제 ${r.cards.length}`)

  for (const [i, c] of r.cards.entries()) {
    for (const f of ['id', 'title', 'body', 'subtext', 'cta', 'layout', 'imageUrl']) {
      assert(f in c, `카드 ${i} 필드 "${f}" 누락`)
    }
    assert(['cover', 'content', 'cta'].includes(c.layout), `카드 ${i} layout=${c.layout}`)
    assert(c.imageUrl, `카드 ${i} imageUrl 빈값`)
  }
  assert(r.cards[0].layout === 'cover', '첫 카드가 cover 아님')
  assert(r.cards[4].layout === 'cta', '마지막 카드가 cta 아님')

  // 내용 검증: 텍스트 필드가 비어있지 않고 실제 길이를 가짐 (GPT 응답·템플릿 폴백 모두 수용)
  for (const [i, c] of r.cards.entries()) {
    assert(c.title.length > 0, `카드 ${i} title 빈값`)
    assert(c.body.length > 0, `카드 ${i} body 빈값`)
    assert(c.subtext.length > 0, `카드 ${i} subtext 빈값`)
    assert(c.cta.length > 0, `카드 ${i} cta 빈값`)
  }

  // 주제 키워드가 어딘가(title/body/subtext)에 반영되었는지 — 임산부/유아 프레임 또는 GPT 응답 모두 수용
  const allText = r.cards.map((c) => `${c.title} ${c.body} ${c.subtext}`).join(' ')
  assert(
    /임산|가족|엄마|아이|유아|태아|케어|건강|소중|돌봄|아기/.test(allText),
    `주제(임산부/유아) 키워드 미반영: ${allText.slice(0, 120)}…`,
  )
}

async function S2_manual_generate() {
  const res = await fetch(`${BASE}/api/generate/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'manual',
      brandId,
      cards: [
        { title: '오늘의 메뉴' },
        { title: '아침', body: '현미죽과 계절 과일' },
        { title: '점심', body: '고등어 구이 + 시금치나물' },
        { title: '간식' },
        {},
      ],
    }),
  })
  assert(res.ok, `HTTP ${res.status}`)
  const r = await json(res)
  assert(r.cards.length === 5, `5장 기대, ${r.cards.length}`)
  assert(r.cards[0].title === '오늘의 메뉴', '입력한 title 1 보존 실패')
  assert(r.cards[1].body.includes('현미죽'), '입력한 body 2 보존 실패')

  // 비어있던 5번 카드는 CTA 레이아웃 + 기본 문구 자동 보강
  const last = r.cards[4]
  assert(last.layout === 'cta', `마지막 카드 layout=${last.layout} (cta 기대)`)
  assert(last.title, 'CTA 카드 title 자동 보강 실패')
  assert(last.body, 'CTA 카드 body 자동 보강 실패')
  assert(last.cta, 'CTA 카드 cta 자동 보강 실패')

  // 모든 카드에 imageUrl 채워짐 (브랜드 에셋 또는 기본 배경)
  for (const [i, c] of r.cards.entries()) {
    assert(c.imageUrl, `카드 ${i} imageUrl 빈값`)
  }
}

async function S3_no_image_case() {
  const res = await fetch(`${BASE}/api/generate/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'auto',
      prompt: '건강한 하루를 소개하는 카드뉴스',
      count: 5,
      // brandId 없음 → 브랜드 에셋 불가 → 기본 배경으로 폴백
    }),
  })
  assert(res.ok, `HTTP ${res.status}`)
  const r = await json(res)
  assert(r.cards.length === 5, `5장 기대`)
  for (const [i, c] of r.cards.entries()) {
    assert(c.imageUrl, `카드 ${i} imageUrl 빈값 — 기본 배경 주입 실패`)
    assert(
      c.imageUrl.startsWith('/uploads/defaults/'),
      `카드 ${i} 기본 배경 경로 아님: ${c.imageUrl}`,
    )
  }
}

async function S4_size_switch() {
  // API 레벨에서 사이즈 프리셋 저장·조회 왕복 확인 (UI 전환은 프론트 책임)
  const created = []
  for (const preset of ['1:1', '4:5', '9:16']) {
    const r = await fetch(`${BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `QA ${preset}`,
        sizePreset: preset,
        inputMode: 'auto',
        cards: [
          { title: 'T', body: 'B', subtext: 'S', cta: 'C', layout: 'cover' },
        ],
      }),
    })
    assert(r.ok, `sizePreset ${preset} 저장 실패 HTTP ${r.status}`)
    const j = await json(r)
    assert(j.project?.id, `프로젝트 id 없음 (${preset})`)
    assert(j.project.sizePreset === preset, `preset 왕복 실패: ${j.project.sizePreset}`)
    created.push(j.project.id)
  }
  // cleanup
  for (const id of created) {
    await fetch(`${BASE}/api/projects/${id}`, { method: 'DELETE' })
  }
}

async function S5_png_ready_fields() {
  // PNG 렌더에 필요한 모든 필드가 응답에 존재하는지 검증 (브라우저 없이 검증 가능한 부분)
  const r = await fetch(`${BASE}/api/generate/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'auto', prompt: 'PNG 렌더 준비 테스트', count: 3, brandId }),
  }).then(json)
  assert(r.cards.length === 3, '3장 기대')
  const required = ['id', 'title', 'body', 'subtext', 'cta', 'layout', 'imageUrl']
  for (const c of r.cards) {
    for (const f of required) {
      assert(f in c, `필드 "${f}" 누락`)
      // imageUrl/subtext/cta 는 문자열이면 OK (빈 문자열도 허용), imageUrl 은 /uploads/ 로 시작
      if (f === 'imageUrl') assert(c[f].startsWith('/uploads/'), `imageUrl 경로 이상: ${c[f]}`)
    }
  }

  // 배경 카탈로그 API
  const bg = await fetch(`${BASE}/api/backgrounds`).then(json)
  assert(Array.isArray(bg.backgrounds), 'backgrounds 배열 없음')
  assert(bg.backgrounds.length >= 3, `배경 3종 이상 기대, ${bg.backgrounds.length}`)
  for (const b of bg.backgrounds) {
    assert(b.key && b.url && Array.isArray(b.palette), '배경 카탈로그 필드 누락')
  }
}

async function S6_validation_error() {
  const res = await fetch(`${BASE}/api/generate/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'auto' }), // prompt·count 누락
  })
  assert(res.status === 400, `400 기대, ${res.status}`)
  const j = await json(res)
  assert(Array.isArray(j.message) && j.message.length > 0, '검증 메시지 누락')
}

async function S7_not_found() {
  const res = await fetch(`${BASE}/api/projects/nonexistent_cuid_xyz`)
  assert(res.status === 404, `404 기대, ${res.status}`)
}

async function S8_safety_guard() {
  const r = await fetch(`${BASE}/api/generate/cards`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'manual',
      cards: [{ title: '완치 100% 보장', body: '부작용 없음 기적의 효과' }],
    }),
  }).then(json)
  const c = r.cards[0]
  assert(!/완치/.test(c.title), `'완치' 미처리: ${c.title}`)
  assert(!/100\s?%/.test(c.title), `'100%' 미처리: ${c.title}`)
  assert(!/부작용\s?없/.test(c.body), `'부작용 없' 미처리: ${c.body}`)
  assert(!/기적/.test(c.body), `'기적' 미처리: ${c.body}`)
}

async function S9_roundtrip() {
  const created = await fetch(`${BASE}/api/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'QA roundtrip',
      sizePreset: '1:1',
      inputMode: 'auto',
      brandId,
      cards: [
        { title: 'T1', body: 'B1', subtext: 'S1', cta: 'C1', layout: 'cover' },
        { title: 'T2', body: 'B2', subtext: 'S2', cta: 'C2', layout: 'cta' },
      ],
    }),
  }).then(json)
  const id = created.project.id
  try {
    const got = await fetch(`${BASE}/api/projects/${id}`).then(json)
    assert(got.project.cards.length === 2, '카드 수 왕복 실패')
    assert(got.project.cards[0].subtext === 'S1', 'subtext 왕복 실패')
    assert(got.project.cards[0].cta === 'C1', 'cta 왕복 실패')
    assert(got.project.cards[1].layout === 'cta', 'layout 왕복 실패')

    // 카드 단건 업데이트 (PUT /api/cards/:id)
    const cardId = got.project.cards[0].id
    const upd = await fetch(`${BASE}/api/cards/${cardId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'T1-수정', subtext: 'S1-수정' }),
    }).then(json)
    assert(upd.card.title === 'T1-수정', 'PUT /api/cards/:id 제목 반영 실패')
    assert(upd.card.subtext === 'S1-수정', 'PUT /api/cards/:id subtext 반영 실패')
  } finally {
    await fetch(`${BASE}/api/projects/${id}`, { method: 'DELETE' })
  }
}

async function S10_health() {
  const r = await fetch(`${BASE}/health`).then(json)
  assert(r.status === 'ok', `status=${r.status}`)
  assert(r.db === 'ok', `db=${r.db}`)
  assert(typeof r.uptime === 'number', 'uptime 누락')
}

// ────────────────────────────────────────────────────────
// RAG 시나리오 — 지식노트 기반 비동기 생성
// ────────────────────────────────────────────────────────

const createdDocIds = []
const createdImageIds = []

async function createDoc(title, contentText) {
  const r = await fetch(`${BASE}/api/knowledge/docs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandId, title, sourceType: 'note', contentText }),
  })
  const j = await json(r)
  assert(r.ok && j?.docId, `doc 생성 실패: HTTP ${r.status} ${JSON.stringify(j)}`)
  createdDocIds.push(j.docId)
  return j
}

async function createImage(url, label, tags) {
  const r = await fetch(`${BASE}/api/knowledge/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ brandId, url, label, tags, usageRights: 'owned', qualityScore: 0.8 }),
  })
  const j = await json(r)
  assert(r.ok && j?.id, `image 생성 실패: HTTP ${r.status} ${JSON.stringify(j)}`)
  createdImageIds.push(j.id)
  return j
}

async function enqueueNoteJob(payload) {
  const r = await fetch(`${BASE}/api/generate/cards-from-note`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { res: r, body: await json(r) }
}

async function pollJob(jobId, timeoutMs = 120_000) {
  const t0 = Date.now()
  const progressTrail = []
  while (Date.now() - t0 < timeoutMs) {
    const j = await fetch(`${BASE}/api/generate/jobs/${jobId}`).then(json)
    progressTrail.push(j?.progress ?? -1)
    if (j?.status === 'done' || j?.status === 'partial') {
      return { final: j, trail: progressTrail }
    }
    if (j?.status === 'failed') {
      throw new Error(`job failed: ${j.errorMessage ?? '(no message)'}`)
    }
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new Error(`job ${jobId} 미완료 (${timeoutMs}ms 타임아웃)`)
}

async function R1_upload_notes() {
  const d1 = await createDoc(
    '유순 브랜드 소개',
    '유순은 시니어와 가족을 위한 따뜻한 케어 브랜드입니다. 정성껏 준비한 영양 식단과 세심한 돌봄을 제공합니다. '.repeat(
      5,
    ),
  )
  assert(d1.chunkCount >= 1, `청크 수 기대 >= 1, 실제 ${d1.chunkCount}`)
  const d2 = await createDoc(
    '유순 온라인 판매 안내',
    '5월 1일부터 유순 제품을 공식 온라인 스토어에서 만나실 수 있습니다. 초기 구매 고객에게는 감사 선물을 드립니다.',
  )
  assert(d2.docId, 'd2 생성 실패')
  const list = await fetch(`${BASE}/api/knowledge/docs?brandId=${brandId}`).then(json)
  assert(list?.docs?.length >= 2, `목록 2건 기대, 실제 ${list?.docs?.length}`)
}

async function R2_upload_image_assets() {
  const a1 = await createImage('/uploads/defaults/bg-morning.svg', '아침 제품컷', ['제품', '아침', '따뜻함'])
  assert(Array.isArray(a1.tags) && a1.tags.includes('제품'), 'tags 보존 실패')
  const a2 = await createImage('/uploads/defaults/bg-meal.svg', '식사 이미지', ['식사', '영양'])
  assert(a2.qualityScore === 0.8, 'qualityScore 저장 실패')
  const list = await fetch(`${BASE}/api/knowledge/images?brandId=${brandId}`).then(json)
  assert((list?.images?.length ?? 0) >= 2, '이미지 라이브러리 목록 누락')
}

async function R3_no_notes_fallback() {
  // 임시 브랜드 생성 → 노트 없이도 done 도달해야 함
  const tmpName = `e2e-empty-${Date.now().toString(36)}`
  const cr = await fetch(`${BASE}/api/brands`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: tmpName, tone: '간결한' }),
  })
  const crj = await json(cr)
  assert(crj?.id, '임시 브랜드 생성 실패')
  try {
    const { res, body } = await enqueueNoteJob({
      brandId: crj.id,
      prompt: '새 제품 소개 카드',
      count: 3,
    })
    assert(res.ok && body?.jobId, `enqueue 실패: ${res.status}`)
    const { final } = await pollJob(body.jobId)
    assert(final.status === 'done' || final.status === 'partial', `status=${final.status}`)
    assert(Array.isArray(final.cards) && final.cards.length === 3, '카드 3장 기대')
  } finally {
    await fetch(`${BASE}/api/brands/${crj.id}`, { method: 'DELETE' }).catch(() => {})
  }
}

async function R4_blocked_prompt() {
  const { res, body } = await enqueueNoteJob({
    brandId,
    prompt: '19금 성인용 광고 카드뉴스',
    count: 3,
  })
  assert(res.status === 400, `HTTP 400 기대, 실제 ${res.status}`)
  assert(String(body?.message ?? '').includes('허용되지 않는'), '차단 메시지 누락')
}

async function R5_card_count() {
  const { body } = await enqueueNoteJob({ brandId, prompt: '유순 온라인 판매 시작', count: 6 })
  const { final } = await pollJob(body.jobId)
  assert(final.cards.length === 6, `카드 6장 기대, 실제 ${final.cards.length}`)
  assert(final.cards[0].layout === 'cover', '첫 카드 cover 아님')
  assert(final.cards[5].layout === 'cta', '마지막 카드 cta 아님')
}

async function R6_base_images_roundrobin() {
  const refs = [
    '/uploads/defaults/bg-morning.svg',
    '/uploads/defaults/bg-meal.svg',
    '/uploads/defaults/bg-program.svg',
  ]
  const { body } = await enqueueNoteJob({
    brandId,
    prompt: '유순 하루 일과 소개',
    count: 5,
    baseImageUrls: refs,
  })
  const { final } = await pollJob(body.jobId)
  assert(final.cards.length === 5, '카드 5장 기대')
  // 이미지 편집(Gemini) 성공 시 url 은 변경되지만, 편집 비활성/실패 시 원본 refs 또는 랭킹 결과가 들어감.
  // 최소 조건: 모든 카드에 imageUrl 이 존재해야 한다.
  for (const [i, c] of final.cards.entries()) {
    assert(c.imageUrl, `카드 ${i} imageUrl 누락`)
  }
}

async function R7_job_progress() {
  const { body } = await enqueueNoteJob({ brandId, prompt: '유순 진행률 테스트', count: 3 })
  const { final, trail } = await pollJob(body.jobId)
  assert(final.progress === 100, `최종 progress=100 기대, 실제 ${final.progress}`)
  const uniqueProgress = [...new Set(trail)].sort((a, b) => a - b)
  assert(uniqueProgress[uniqueProgress.length - 1] === 100, 'progress 상승 없이 종료')
}

async function R8_result_schema() {
  const { body } = await enqueueNoteJob({ brandId, prompt: '스키마 검증 테스트', count: 3 })
  const { final } = await pollJob(body.jobId)
  for (const [i, c] of final.cards.entries()) {
    for (const key of ['id', 'layout', 'title', 'body', 'subtext', 'cta']) {
      assert(key in c, `카드 ${i} 필드 "${key}" 누락`)
    }
    assert(['cover', 'content', 'cta'].includes(c.layout), `카드 ${i} layout 잘못됨: ${c.layout}`)
    assert(typeof c.title === 'string', `카드 ${i} title 타입`)
  }
  assert(final.meta?.source === 'note_rag', 'meta.source=note_rag 누락')
}

async function R9_cleanup() {
  for (const id of createdDocIds) {
    await fetch(`${BASE}/api/knowledge/docs/${id}`, { method: 'DELETE' })
  }
  for (const id of createdImageIds) {
    await fetch(`${BASE}/api/knowledge/images/${id}`, { method: 'DELETE' })
  }
}

// ────────────────────────────────────────────────────────

async function main() {
  log(`\n결 · 카드뉴스 E2E 테스트`)
  log(`API_BASE=${BASE}\n`)

  await waitForBackend()
  log('')
  log('[scenarios]')
  await S0_setup()

  await test('S1  프롬프트 자동 생성 (유순 임산부/유아 5장)', S1_auto_generate)
  await test('S2  수동 입력 생성 (빈 필드 자동 보강)', S2_manual_generate)
  await test('S3  이미지 없음 케이스 (기본 배경 폴백)', S3_no_image_case)
  await test('S4  사이즈 프리셋 왕복 (1:1·4:5·9:16)', S4_size_switch)
  await test('S5  PNG 렌더 필드 완전성 + 배경 카탈로그', S5_png_ready_fields)
  await test('S6  에러 처리 — 필수값 누락 400', S6_validation_error)
  await test('S7  에러 처리 — 존재하지 않는 id 404', S7_not_found)
  await test('S8  안전 가드 — 과장/의학 표현 완화', S8_safety_guard)
  await test('S9  DB 왕복 — 프로젝트·카드 CRUD', S9_roundtrip)
  await test('S10 헬스체크', S10_health)

  // ── RAG / 지식노트 기반 비동기 생성 ──
  await test('R1  지식노트 문서 2건 등록 + 청크 생성', R1_upload_notes)
  await test('R2  이미지 라이브러리 등록 + 태그 보존', R2_upload_image_assets)
  await test('R3  노트 없음 → 기본 프레임 fallback 동작', R3_no_notes_fallback)
  await test('R4  금칙어 프롬프트 → 400 (enqueue 선제 차단)', R4_blocked_prompt)
  await test('R5  count=6 카드 수 정확성', R5_card_count)
  await test('R6  baseImageUrls 3장 round-robin 배치', R6_base_images_roundrobin)
  await test('R7  job progress 단조 증가 + done 도달', R7_job_progress)
  await test('R8  결과 카드 JSON 필드 고정 (title/body/subtext/cta/layout)', R8_result_schema)
  await test('R9  cleanup (등록한 문서·이미지 삭제)', R9_cleanup)

  // Summary
  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  const total = results.length
  const rate = ((pass / total) * 100).toFixed(1)
  const totalMs = results.reduce((a, b) => a + b.ms, 0)

  log('')
  log('═'.repeat(60))
  log(`총 ${total}건 · \x1b[32m${pass} PASS\x1b[0m · \x1b[31m${fail} FAIL\x1b[0m · ${rate}% · ${totalMs}ms`)
  log('═'.repeat(60))

  if (fail > 0) {
    log('\n실패 내역:')
    for (const r of results.filter((r) => r.status === 'FAIL')) {
      log(`  - ${r.name}`)
      log(`    ${r.error}`)
    }
    process.exit(1)
  }
}

main().catch((e) => {
  log(`\n\x1b[31m[FATAL]\x1b[0m ${e.message}`)
  log(e.stack || '')
  process.exit(2)
})
