import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { spawn } from 'child_process'
import { mkdir, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { randomUUID } from 'crypto'
// ffmpeg-static — FFmpeg 6.x 번들. xfade 등 최신 필터 사용 가능.
// 기존 @ffmpeg-installer/ffmpeg 은 4.2 버전이라 xfade 미지원 (2020+ 추가됨).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const ffmpegPath: string = require('ffmpeg-static') as string
import { reelFilename } from '../shared/filename'
import { GenerateReelDto } from './dto/generate-reel.dto'

type Transition = 'fade' | 'slide' | 'zoom'
type FrameFormat = 'png' | 'jpg' | 'webp'

// xfade 필터 매핑 — zoom 은 zoomin(xfade built-in)
const XFADE_NAME: Record<Transition, string> = {
  fade: 'fade',
  slide: 'slideleft',
  zoom: 'zoomin',
}

const TRANSITION_SECONDS = 0.5 // 전환 구간 길이
const OUTPUT_W = 1080
const OUTPUT_H = 1920 // 9:16 릴스 고정

@Injectable()
export class ReelsService implements OnModuleInit {
  private readonly logger = new Logger(ReelsService.name)
  private readonly reelsDir = join(process.cwd(), 'public', 'uploads', 'reels')

  async onModuleInit() {
    await mkdir(this.reelsDir, { recursive: true })
    this.logger.log(`ffmpeg binary: ${ffmpegPath}`)
    this.logger.log(`reels output dir: ${this.reelsDir}`)
  }

  async generate(dto: GenerateReelDto): Promise<{
    url: string
    filename: string
    duration: number
    width: number
    height: number
  }> {
    const { frames, transition, durationPerCard, brandName } = dto
    const n = frames.length
    const tmpDir = join(tmpdir(), 'gyeol-reels', randomUUID())
    await mkdir(tmpDir, { recursive: true })

    try {
      // 1) 각 프레임을 PNG로 저장
      const framePaths: string[] = []
      let totalBytes = 0
      for (let i = 0; i < n; i++) {
        const parsed = parseBase64Image(frames[i])
        totalBytes += parsed.bytes.length
        const ext = parsed.format
        const p = join(tmpDir, `f${i}.${ext}`)
        await writeFile(p, parsed.bytes)
        framePaths.push(p)
      }
      this.logger.log(
        `릴스 프레임 수신: ${n}장 · 총 ${(totalBytes / (1024 * 1024)).toFixed(1)}MB`,
      )

      // 2) 출력 파일 경로
      const filename = reelFilename(brandName)
      const outputPath = join(this.reelsDir, filename)

      // 3) ffmpeg 실행
      const args = buildFfmpegArgs(framePaths, outputPath, transition, durationPerCard)
      this.logger.log(`ffmpeg 시작 — frames=${n} transition=${transition} dur=${durationPerCard}s`)
      try {
        await this.runFfmpeg(args, transition)
      } catch (e: any) {
        // 일부 런타임에서 xfade 전환(특히 zoom/slide) 지원 이슈가 있어 fade 로 1회 폴백.
        if (transition !== 'fade') {
          this.logger.warn(
            `전환 "${transition}" 렌더 실패 → fade 폴백 재시도: ${e?.message ?? e}`,
          )
          const fallbackArgs = buildFfmpegArgs(framePaths, outputPath, 'fade', durationPerCard)
          await this.runFfmpeg(fallbackArgs, 'fade(fallback)')
        } else {
          throw e
        }
      }

      const duration =
        Math.round((n * durationPerCard - (n - 1) * TRANSITION_SECONDS) * 10) / 10

      this.logger.log(`릴스 생성 완료 → ${filename} (${duration}s)`)

      return {
        url: `/uploads/reels/${filename}`,
        filename,
        duration,
        width: OUTPUT_W,
        height: OUTPUT_H,
      }
    } finally {
      await rm(tmpDir, { recursive: true, force: true }).catch(() => {})
    }
  }

  private runFfmpeg(args: string[], transitionLabel: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'pipe'] })
      let stderrTail = ''
      proc.stderr?.on('data', (d: Buffer) => {
        const chunk = d.toString()
        stderrTail = (stderrTail + chunk).slice(-2000)
      })
      proc.on('error', (err) => reject(new Error(`ffmpeg 실행 실패: ${err.message}`)))
      proc.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`ffmpeg(${transitionLabel}) exit ${code}\n${stderrTail.slice(-1500)}`))
      })
    })
  }
}

// ───────────────────────────────────────────────
// ffmpeg xfade 명령 빌드
// 입력: PNG 각각을 loop + duration 동영상 스트림으로 받아
// 9:16 크기로 scale+pad 후 xfade 로 체인.
// ───────────────────────────────────────────────
function buildFfmpegArgs(
  framePaths: string[],
  output: string,
  transition: Transition,
  durationPerCard: number,
): string[] {
  const n = framePaths.length
  const T = TRANSITION_SECONDS
  const name = XFADE_NAME[transition]
  const args: string[] = []

  // 입력
  for (const p of framePaths) {
    args.push('-loop', '1', '-t', String(durationPerCard), '-i', p)
  }

  // 필터: scale+pad 로 9:16 고정 → setsar=1 → 각 입력별 [s{i}]
  const filterParts: string[] = []
  for (let i = 0; i < n; i++) {
    filterParts.push(
      `[${i}]scale=${OUTPUT_W}:${OUTPUT_H}:force_original_aspect_ratio=decrease,` +
        `pad=${OUTPUT_W}:${OUTPUT_H}:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[s${i}]`,
    )
  }

  // xfade 체인 — offset 누적
  if (n === 2) {
    filterParts.push(
      `[s0][s1]xfade=transition=${name}:duration=${T}:offset=${durationPerCard - T}[vout]`,
    )
  } else {
    for (let i = 0; i < n - 1; i++) {
      const left = i === 0 ? '[s0]' : `[v${i}]`
      const right = `[s${i + 1}]`
      const offset = (i + 1) * durationPerCard - (i + 1) * T
      const out = i === n - 2 ? '[vout]' : `[v${i + 1}]`
      filterParts.push(
        `${left}${right}xfade=transition=${name}:duration=${T}:offset=${offset}${out}`,
      )
    }
  }

  args.push(
    '-filter_complex',
    filterParts.join(';'),
    '-map',
    '[vout]',
    '-c:v',
    'libx264',
    '-crf',
    '21',
    '-preset',
    'veryfast',
    '-profile:v',
    'high',
    '-level',
    '4.1',
    '-pix_fmt',
    'yuv420p',
    '-r',
    '30',
    '-movflags',
    '+faststart',
    '-y',
    output,
  )

  return args
}

function parseBase64Image(raw: string): { bytes: Buffer; format: FrameFormat } {
  const input = String(raw || '').trim()
  if (!input) throw new Error('빈 프레임 데이터')

  const m = input.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/)
  const mime = m?.[1]?.toLowerCase() ?? null
  const b64 = (m?.[2] ?? input).trim()
  const bytes = Buffer.from(b64, 'base64')
  if (!bytes.length) throw new Error('프레임 base64 디코딩 실패')

  const format: FrameFormat =
    mime === 'jpeg' || mime === 'jpg'
      ? 'jpg'
      : mime === 'webp'
        ? 'webp'
        : 'png'
  return { bytes, format }
}
