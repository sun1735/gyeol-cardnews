// Gemini 2.5 Flash 텍스트 래퍼 — JSON 스키마 모드 + 타임아웃.
// 프로젝트 전역의 카피 생성은 이 파일 한 곳에서만 외부 API 를 친다.
// 모델 교체 시 callGeminiJson() 시그니처만 유지하면 됨.

import { Logger } from '@nestjs/common'

const GEMINI_MODEL = 'gemini-2.5-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

export interface GeminiJsonCall {
  systemInstruction?: string
  userText: string
  // JSON 스키마 (OpenAI json_schema.schema 와 유사한 드래프트). Gemini 는 Schema 오브젝트를 기대한다.
  schema: unknown
  timeoutMs?: number
  temperature?: number
}

// 성공 시 파싱된 JSON 을 그대로 반환. 실패 시 Error throw.
export async function callGeminiJson<T = unknown>(call: GeminiJsonCall): Promise<T> {
  const logger = new Logger('GeminiJson')
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY 미설정')

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), call.timeoutMs ?? 25_000)
  try {
    const body: Record<string, unknown> = {
      contents: [{ role: 'user', parts: [{ text: call.userText }] }],
      generationConfig: {
        temperature: call.temperature ?? 0.7,
        responseMimeType: 'application/json',
        responseSchema: call.schema,
      },
    }
    if (call.systemInstruction) {
      body.systemInstruction = { parts: [{ text: call.systemInstruction }] }
    }

    const res = await fetch(`${GEMINI_ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Gemini HTTP ${res.status}: ${text.slice(0, 300)}`)
    }
    const j: any = await res.json()
    const parts: any[] = j?.candidates?.[0]?.content?.parts ?? []
    const textPart = parts.find((p) => typeof p?.text === 'string')
    if (!textPart) {
      logger.warn(`Gemini 응답에 text 파트 없음: ${JSON.stringify(j).slice(0, 200)}`)
      throw new Error('Gemini 응답 형식 비정상')
    }
    // responseSchema 가 있어도 Gemini 는 text 안에 JSON 문자열로 반환 — 파싱 필요.
    return JSON.parse(textPart.text) as T
  } finally {
    clearTimeout(timeoutId)
  }
}

// 카드 배열 JSON 스키마 — generate/schema.ts 의 OPENAI_RESPONSE_FORMAT 을 Gemini 형식으로 미러링.
// Gemini Schema 는 OpenAPI 3.0 서브셋 — additionalProperties 금지, type 은 대문자(STRING/OBJECT/ARRAY)가 아닌 소문자도 수용하지만 명시적으로 적어둔다.
export function cardArraySchema(maxCount: number) {
  return {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        maxItems: maxCount,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            body: { type: 'string' },
            subtext: { type: 'string' },
            cta: { type: 'string' },
            layout: { type: 'string', enum: ['cover', 'content', 'cta'] },
          },
          required: ['title', 'body', 'subtext', 'cta', 'layout'],
        },
      },
    },
    required: ['cards'],
  }
}

// LayoutDSL — LLM 이 "어떤 블록을 어디에 어떤 스타일로" 자유롭게 배치하게 하는 스키마.
// rect 는 [x, y, w, h] 0~100 퍼센트. 매번 새로운 레이아웃이 나오도록 설계.
export function layoutDslSchema(maxCount: number) {
  const blockItem = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      type: {
        type: 'string',
        enum: ['image', 'title', 'subtitle', 'body', 'badge', 'price', 'features', 'cta', 'swatch', 'decor'],
      },
      rect: {
        type: 'array',
        items: { type: 'number' },
        maxItems: 4,
      },
      pos: {
        type: 'string',
        enum: [
          'top-left', 'top-center', 'top-right',
          'middle-left', 'center', 'middle-right',
          'bottom-left', 'bottom-center', 'bottom-right',
        ],
      },
      align: { type: 'string', enum: ['left', 'center', 'right'] },
      text: { type: 'string' },
      url: { type: 'string' },
      color: { type: 'string' },
      background: { type: 'string' },
      size: { type: 'number' },
      weight: { type: 'number' },
      fit: { type: 'string', enum: ['cover', 'contain'] },
      style: {
        type: 'string',
        enum: [
          'pill', 'circle', 'underline', 'ribbon', 'blur', 'solid', 'glass',
          'mask-gradient', 'mask-solid', 'corner-accent',
        ],
      },
      rotate: { type: 'number' },
      zIndex: { type: 'number' },
      priceOriginal: { type: 'number' },
      priceSale: { type: 'number' },
      discountPercent: { type: 'number' },
      features: {
        type: 'array',
        maxItems: 4,
        items: {
          type: 'object',
          properties: {
            icon: { type: 'string' },
            label: { type: 'string' },
          },
          required: ['icon', 'label'],
        },
      },
      swatches: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 6,
      },
      big: { type: 'string' },
    },
    required: ['id', 'type'],
  }

  return {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        maxItems: maxCount,
        items: {
          type: 'object',
          properties: {
            rationale: { type: 'string' },
            canvas: {
              type: 'object',
              properties: {
                w: { type: 'number' },
                h: { type: 'number' },
                bg: { type: 'string' },
                gradient: { type: 'string' },
              },
              required: ['w', 'h', 'bg'],
            },
            blocks: {
              type: 'array',
              maxItems: 12,
              items: blockItem,
            },
            cardLayout: { type: 'string', enum: ['cover', 'content', 'cta'] },
          },
          required: ['canvas', 'blocks', 'cardLayout'],
        },
      },
    },
    required: ['cards'],
  }
}

// AI 가 구도·컬러·장식까지 결정하는 DynamicDesign 스키마. (레거시 — LayoutDSL 로 대체 예정)
// product-ad / promo 에서 공통 사용. 매 생성마다 다른 layout/palette 가 나오도록 설계.
export function dynamicDesignArraySchema(maxCount: number) {
  return {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        maxItems: maxCount,
        items: {
          type: 'object',
          properties: {
            layout: {
              type: 'string',
              enum: ['split-dark-left', 'image-top-card-bottom', 'fullbleed-center-glass'],
            },
            palette: {
              type: 'object',
              properties: {
                dominant: { type: 'string' }, // #1a1a2e 처럼 HEX
                accent: { type: 'string' },
                textOnDominant: { type: 'string' },
              },
              required: ['dominant', 'accent', 'textOnDominant'],
            },
            title: { type: 'string' },
            subtitle: { type: 'string' },
            body: { type: 'string' },
            badgeLabel: { type: 'string' },
            ctaLabel: { type: 'string' },
            features: {
              type: 'array',
              maxItems: 4,
              items: {
                type: 'object',
                properties: {
                  icon: { type: 'string' },
                  label: { type: 'string' },
                },
                required: ['icon', 'label'],
              },
            },
            priceOriginal: { type: 'number' },
            priceSale: { type: 'number' },
            discountPercent: { type: 'number' },
            deadlineText: { type: 'string' },
            decorations: {
              type: 'array',
              maxItems: 4,
              items: { type: 'string' }, // 'discount-circle' | 'corner-accent' | 'big-number'
            },
            cardLayout: { type: 'string', enum: ['cover', 'content', 'cta'] },
          },
          required: [
            'layout',
            'palette',
            'title',
            'subtitle',
            'body',
            'badgeLabel',
            'ctaLabel',
            'features',
            'deadlineText',
            'decorations',
            'cardLayout',
          ],
        },
      },
    },
    required: ['cards'],
  }
}

// product-ad 템플릿 전용 스키마 — 구조화된 광고 필드를 강제.
// features 는 정확히 4개 권장(UI 아이콘 자리), colors 는 HEX 배열(스와치).
export function productAdArraySchema(maxCount: number) {
  return {
    type: 'object',
    properties: {
      cards: {
        type: 'array',
        maxItems: maxCount,
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            subtitle: { type: 'string' },
            body: { type: 'string' },
            badgeLabel: { type: 'string' },
            features: {
              type: 'array',
              // Gemini responseSchema 는 minItems 를 일부 거절한 사례가 있어 maxItems 만 유지.
              maxItems: 4,
              items: {
                type: 'object',
                properties: {
                  icon: { type: 'string' }, // 이모지 1자 권장
                  label: { type: 'string' },
                },
                required: ['icon', 'label'],
              },
            },
            colors: {
              type: 'array',
              maxItems: 6,
              items: { type: 'string' }, // HEX
            },
            priceOriginal: { type: 'number' },
            priceSale: { type: 'number' },
            discountPercent: { type: 'number' },
            deadlineText: { type: 'string' },
            ctaLabel: { type: 'string' },
            layout: { type: 'string', enum: ['cover', 'content', 'cta'] },
          },
          required: [
            'title',
            'subtitle',
            'body',
            'features',
            'priceSale',
            'ctaLabel',
            'layout',
          ],
        },
      },
    },
    required: ['cards'],
  }
}
