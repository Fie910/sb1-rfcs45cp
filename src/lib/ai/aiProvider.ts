// src/lib/ai/aiProvider.ts
// Multi-provider AI wrapper dengan failover otomatis.
//
// Urutan Text:   Groq → OpenRouter → Gemini
// Urutan Vision: Groq → OpenRouter → Gemini
//
// Groq model disesuaikan dengan akun Anda:
//   - Text:   openai/gpt-oss-120b, openai/gpt-oss-20b
//   - Vision: qwen/qwen3.8-27b
//
// Cara test manual Groq:
//   curl https://api.groq.com/openai/v1/models -H "Authorization: Bearer gsk_xxx"

export type AIProviderId = 'groq' | 'openrouter' | 'gemini';

export interface AITextRequest {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AIVisionRequest {
  prompt: string;
  systemPrompt?: string;
  imageBase64: string;
  imageMimeType: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AIResult {
  text: string;
  provider: AIProviderId;
  model: string;
}

// ============================================================================
// CONFIG — API KEYS
// ============================================================================
const ENV = import.meta.env;

const GROQ_KEY = ENV.VITE_GROQ_API_KEY as string | undefined;
const OPENROUTER_KEY = ENV.VITE_OPENROUTER_API_KEY as string | undefined;
const GEMINI_KEY = ENV.VITE_GEMINI_API_KEY as string | undefined;

// Validasi format key (hindari request sia-sia kalau key salah)
const hasGroq = Boolean(GROQ_KEY && GROQ_KEY.startsWith('gsk_'));
const hasOpenRouter = Boolean(OPENROUTER_KEY && OPENROUTER_KEY.startsWith('sk-or-'));
const hasGemini = Boolean(GEMINI_KEY && GEMINI_KEY.length > 10);

// ============================================================================
// CONFIG — MODEL LIST
// ============================================================================
// Groq text — sesuai account Anda
const GROQ_MODELS = [
  'openai/gpt-oss-120b',
  'openai/gpt-oss-20b',
];

// Groq vision — Qwen3.8 27B (input_modalities: text, image)
const GROQ_VISION_MODELS = [
  'qwen/qwen3.8-27b',
];

// OpenRouter text — model gratis
const OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'deepseek/deepseek-chat-v3.1:free',
];

// OpenRouter vision
const OPENROUTER_VISION_MODELS = [
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.2-11b-vision-instruct:free',
];

// Gemini text
const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
];

// Gemini vision
const GEMINI_VISION_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash'];

// ============================================================================
// RETRY CONFIG
// ============================================================================
const MAX_RETRY_PER_MODEL = 1;
const RETRY_DELAY_MS = 1500;
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  model: string
): Promise<Response> {
  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= MAX_RETRY_PER_MODEL + 1; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok) return res;
      if (!RETRYABLE_STATUS.includes(res.status)) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e: any) {
      lastErr = e;
    }
    if (attempt <= MAX_RETRY_PER_MODEL) {
      console.warn(`[ai] ${model} attempt ${attempt} gagal, retry...`);
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  throw lastErr ?? new Error('fetchWithRetry exhausted');
}

// Baca error body untuk log detail
async function readErrorBody(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json?.error?.message || json?.message || text;
    } catch {
      return text;
    }
  } catch {
    return '';
  }
}

// ============================================================================
// PROVIDER: GROQ — TEXT
// ============================================================================
async function callGroq(req: AITextRequest, model: string): Promise<string> {
  if (!hasGroq) throw new Error('Groq API key tidak valid / tidak diset');

  const messages: any[] = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
  messages.push({ role: 'user', content: req.prompt });

  const body: any = {
    model,
    messages,
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens ?? 4096,
  };
  if (req.jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetchWithRetry(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify(body),
    },
    model
  );

  if (!res.ok) {
    const err = await readErrorBody(res);
    console.error(`[ai] Groq ${model} HTTP ${res.status}:`, err);
    throw new Error(`Groq ${model} HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq ${model} tidak mengembalikan teks`);
  return text;
}

// ============================================================================
// PROVIDER: GROQ — VISION (Qwen3.8 27B)
// ============================================================================
async function callGroqVision(
  req: AIVisionRequest,
  model: string
): Promise<string> {
  if (!hasGroq) throw new Error('Groq API key tidak valid');

  const userContent: any[] = [
    { type: 'text', text: req.prompt },
    {
      type: 'image_url',
      image_url: { url: `data:${req.imageMimeType};base64,${req.imageBase64}` },
    },
  ];

  const messages: any[] = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
  messages.push({ role: 'user', content: userContent });

  const body: any = {
    model,
    messages,
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens ?? 4096,
  };

  const res = await fetchWithRetry(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify(body),
    },
    model
  );

  if (!res.ok) {
    const err = await readErrorBody(res);
    console.error(`[ai] Groq Vision ${model} HTTP ${res.status}:`, err);
    throw new Error(
      `Groq Vision ${model} HTTP ${res.status}: ${err.slice(0, 200)}`
    );
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq Vision ${model} tidak mengembalikan teks`);
  return text;
}

// ============================================================================
// PROVIDER: OPENROUTER — TEXT
// ============================================================================
async function callOpenRouter(req: AITextRequest, model: string): Promise<string> {
  if (!hasOpenRouter) throw new Error('OpenRouter API key tidak valid / tidak diset');

  const messages: any[] = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
  messages.push({ role: 'user', content: req.prompt });

  const body: any = {
    model,
    messages,
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens ?? 4096,
  };
  if (req.jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetchWithRetry(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer':
          typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'SISFO SMK',
      },
      body: JSON.stringify(body),
    },
    model
  );

  if (!res.ok) {
    const err = await readErrorBody(res);
    console.error(`[ai] OpenRouter ${model} HTTP ${res.status}:`, err);
    throw new Error(
      `OpenRouter ${model} HTTP ${res.status}: ${err.slice(0, 200)}`
    );
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenRouter ${model} tidak mengembalikan teks`);
  return text;
}

// ============================================================================
// PROVIDER: OPENROUTER — VISION
// ============================================================================
async function callOpenRouterVision(
  req: AIVisionRequest,
  model: string
): Promise<string> {
  if (!hasOpenRouter) throw new Error('OpenRouter API key tidak valid');

  const userContent: any[] = [
    { type: 'text', text: req.prompt },
    {
      type: 'image_url',
      image_url: { url: `data:${req.imageMimeType};base64,${req.imageBase64}` },
    },
  ];

  const messages: any[] = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
  messages.push({ role: 'user', content: userContent });

  const body: any = {
    model,
    messages,
    temperature: req.temperature ?? 0.3,
    max_tokens: req.maxTokens ?? 4096,
  };

  const res = await fetchWithRetry(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        'HTTP-Referer':
          typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'SISFO SMK',
      },
      body: JSON.stringify(body),
    },
    model
  );

  if (!res.ok) {
    const err = await readErrorBody(res);
    console.error(`[ai] OpenRouter Vision ${model} HTTP ${res.status}:`, err);
    throw new Error(
      `OpenRouter Vision ${model} HTTP ${res.status}: ${err.slice(0, 200)}`
    );
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenRouter Vision ${model} tidak mengembalikan teks`);
  return text;
}

// ============================================================================
// PROVIDER: GEMINI — TEXT
// ============================================================================
async function callGemini(req: AITextRequest, model: string): Promise<string> {
  if (!hasGemini) throw new Error('Gemini API key tidak valid / tidak diset');

  const payload: any = {
    contents: [{ parts: [{ text: req.prompt }] }],
    generationConfig: {
      temperature: req.temperature ?? 0.3,
      maxOutputTokens: req.maxTokens ?? 4096,
    },
  };
  if (req.systemPrompt) {
    payload.systemInstruction = { parts: [{ text: req.systemPrompt }] };
  }
  if (req.jsonMode) {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    model
  );

  if (!res.ok) {
    const err = await readErrorBody(res);
    console.error(`[ai] Gemini ${model} HTTP ${res.status}:`, err);
    throw new Error(`Gemini ${model} HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini ${model} tidak mengembalikan teks`);
  return text;
}

// ============================================================================
// PROVIDER: GEMINI — VISION
// ============================================================================
async function callGeminiVision(
  req: AIVisionRequest,
  model: string
): Promise<string> {
  if (!hasGemini) throw new Error('Gemini API key tidak valid');

  const payload: any = {
    contents: [
      {
        parts: [
          { text: req.prompt },
          { inlineData: { mimeType: req.imageMimeType, data: req.imageBase64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: req.temperature ?? 0.3,
      maxOutputTokens: req.maxTokens ?? 4096,
    },
  };
  if (req.systemPrompt) {
    payload.systemInstruction = { parts: [{ text: req.systemPrompt }] };
  }
  if (req.jsonMode) {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    model
  );

  if (!res.ok) {
    const err = await readErrorBody(res);
    throw new Error(
      `Gemini Vision ${model} HTTP ${res.status}: ${err.slice(0, 200)}`
    );
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini Vision ${model} tidak mengembalikan teks`);
  return text;
}

// ============================================================================
// PUBLIC API — TEXT
// ============================================================================
export async function generateText(req: AITextRequest): Promise<AIResult> {
  const attempts: string[] = [];

  // 1. Groq
  if (hasGroq) {
    for (const model of GROQ_MODELS) {
      try {
        const text = await callGroq(req, model);
        console.info(`[ai] ✅ ${model} (groq)`);
        return { text, provider: 'groq', model };
      } catch (e: any) {
        attempts.push(`groq:${model}:${e.message.slice(0, 80)}`);
      }
    }
  } else if (GROQ_KEY) {
    console.warn('[ai] Groq key ada tapi format tidak valid (harus gsk_...)');
  }

  // 2. OpenRouter
  if (hasOpenRouter) {
    for (const model of OPENROUTER_MODELS) {
      try {
        const text = await callOpenRouter(req, model);
        console.info(`[ai] ✅ ${model} (openrouter)`);
        return { text, provider: 'openrouter', model };
      } catch (e: any) {
        attempts.push(`openrouter:${model}:${e.message.slice(0, 80)}`);
      }
    }
  } else if (OPENROUTER_KEY) {
    console.warn('[ai] OpenRouter key ada tapi format tidak valid (harus sk-or-...)');
  }

  // 3. Gemini
  if (hasGemini) {
    for (const model of GEMINI_MODELS) {
      try {
        const text = await callGemini(req, model);
        console.info(`[ai] ✅ ${model} (gemini)`);
        return { text, provider: 'gemini', model };
      } catch (e: any) {
        attempts.push(`gemini:${model}:${e.message.slice(0, 80)}`);
      }
    }
  }

  console.error('[ai] semua provider gagal:', attempts);
  throw new Error(
    'Semua provider AI gagal merespons. Cek konfigurasi API key atau hubungi admin.'
  );
}

export async function generateJSON<T>(
  req: AITextRequest
): Promise<{ data: T; provider: AIProviderId; model: string }> {
  const { text, provider, model } = await generateText({ ...req, jsonMode: true });

  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const data = JSON.parse(cleaned) as T;
    return { data, provider, model };
  } catch (e) {
    console.error('[ai] parse JSON gagal dari', provider, ':', cleaned.slice(0, 300));
    throw new Error('AI mengembalikan format tidak valid. Coba generate ulang.');
  }
}

// ============================================================================
// PUBLIC API — VISION
// ============================================================================
export async function generateVision(req: AIVisionRequest): Promise<AIResult> {
  const attempts: string[] = [];

  // 1. Groq Vision (Qwen3.8 27B)
  if (hasGroq) {
    for (const model of GROQ_VISION_MODELS) {
      try {
        const text = await callGroqVision(req, model);
        console.info(`[ai] ✅ ${model} (groq vision)`);
        return { text, provider: 'groq', model };
      } catch (e: any) {
        attempts.push(`groq:${model}:${e.message.slice(0, 80)}`);
      }
    }
  }

  // 2. OpenRouter Vision
  if (hasOpenRouter) {
    for (const model of OPENROUTER_VISION_MODELS) {
      try {
        const text = await callOpenRouterVision(req, model);
        console.info(`[ai] ✅ ${model} (openrouter vision)`);
        return { text, provider: 'openrouter', model };
      } catch (e: any) {
        attempts.push(`openrouter:${model}:${e.message.slice(0, 80)}`);
      }
    }
  }

  // 3. Gemini Vision
  if (hasGemini) {
    for (const model of GEMINI_VISION_MODELS) {
      try {
        const text = await callGeminiVision(req, model);
        console.info(`[ai] ✅ ${model} (gemini vision)`);
        return { text, provider: 'gemini', model };
      } catch (e: any) {
        attempts.push(`gemini:${model}:${e.message.slice(0, 80)}`);
      }
    }
  }

  console.error('[ai] semua provider vision gagal:', attempts);
  throw new Error('Semua provider AI vision gagal. Coba lagi nanti.');
}

export async function generateJSONVision<T>(
  req: AIVisionRequest
): Promise<{ data: T; provider: AIProviderId; model: string }> {
  const { text, provider, model } = await generateVision({ ...req, jsonMode: true });

  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const data = JSON.parse(cleaned) as T;
    return { data, provider, model };
  } catch (e) {
    console.error(
      '[ai] parse JSON vision gagal dari',
      provider,
      ':',
      cleaned.slice(0, 300)
    );
    throw new Error('AI vision mengembalikan format tidak valid. Coba lagi.');
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================
export function hasAnyProvider(): boolean {
  return hasGroq || hasOpenRouter || hasGemini;
}

export function getAvailableProviders(): AIProviderId[] {
  const list: AIProviderId[] = [];
  if (hasGroq) list.push('groq');
  if (hasOpenRouter) list.push('openrouter');
  if (hasGemini) list.push('gemini');
  return list;
}

export async function checkAiAvailable(): Promise<boolean> {
  try {
    await generateText({
      prompt: 'Reply with the single word: OK',
      maxTokens: 5,
      temperature: 0,
    });
    return true;
  } catch {
    return false;
  }
}