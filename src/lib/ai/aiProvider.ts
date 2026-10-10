// src/lib/ai/aiProvider.ts
// Multi-provider AI wrapper dengan failover otomatis.
// Order text:   Groq → Cerebras → Gemini → OpenRouter
// Order vision: OpenRouter → Gemini

export type AIProviderId = 'groq' | 'cerebras' | 'gemini' | 'openrouter';

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
// CONFIG
// ============================================================================
const ENV = import.meta.env;

const GROQ_KEY = ENV.VITE_GROQ_API_KEY as string | undefined;
const CEREBRAS_KEY = ENV.VITE_CEREBRAS_API_KEY as string | undefined;
const GEMINI_KEY = ENV.VITE_GEMINI_API_KEY as string | undefined;
const OPENROUTER_KEY = ENV.VITE_OPENROUTER_API_KEY as string | undefined;

// Groq — model stabil (Llama 3.3 70B sangat konsisten)
const GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

// Cerebras — cepat & stabil
const CEREBRAS_MODELS = ['llama-3.3-70b', 'llama3.1-8b'];

// Gemini — pakai nama model yang sudah Anda pakai
const GEMINI_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];

// OpenRouter — model gratis
const OPENROUTER_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
];

// Vision models (untuk scan surat)
const OPENROUTER_VISION_MODELS = ['google/gemini-2.0-flash-exp:free'];
const GEMINI_VISION_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash'];

// ============================================================================
// RETRY CONFIG
// ============================================================================
const MAX_RETRY_PER_MODEL = 1; // total 2 attempts per model
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

// ============================================================================
// PROVIDER: GROQ (OpenAI-compatible)
// ============================================================================
async function callGroq(req: AITextRequest, model: string): Promise<string> {
  if (!GROQ_KEY) throw new Error('Groq API key tidak diset');

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
    const err = await res.text().catch(() => '');
    throw new Error(`Groq ${model} HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Groq ${model} tidak mengembalikan teks`);
  return text;
}

// ============================================================================
// PROVIDER: CEREBRAS (OpenAI-compatible)
// ============================================================================
async function callCerebras(req: AITextRequest, model: string): Promise<string> {
  if (!CEREBRAS_KEY) throw new Error('Cerebras API key tidak diset');

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
    'https://api.cerebras.ai/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CEREBRAS_KEY}`,
      },
      body: JSON.stringify(body),
    },
    model
  );

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Cerebras ${model} HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`Cerebras ${model} tidak mengembalikan teks`);
  return text;
}

// ============================================================================
// PROVIDER: OPENROUTER (OpenAI-compatible)
// ============================================================================
async function callOpenRouter(req: AITextRequest, model: string): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error('OpenRouter API key tidak diset');

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
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'SISFO SMK',
      },
      body: JSON.stringify(body),
    },
    model
  );

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`OpenRouter ${model} HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenRouter ${model} tidak mengembalikan teks`);
  return text;
}

// ============================================================================
// PROVIDER: GEMINI (native)
// ============================================================================
async function callGemini(req: AITextRequest, model: string): Promise<string> {
  if (!GEMINI_KEY) throw new Error('Gemini API key tidak diset');

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
    const err = await res.text().catch(() => '');
    throw new Error(`Gemini ${model} HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini ${model} tidak mengembalikan teks`);
  return text;
}

// ============================================================================
// VISION PROVIDERS
// ============================================================================
async function callGeminiVision(req: AIVisionRequest, model: string): Promise<string> {
  if (!GEMINI_KEY) throw new Error('Gemini API key tidak diset');

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
    const err = await res.text().catch(() => '');
    throw new Error(`Gemini Vision ${model} HTTP ${res.status}: ${err.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error(`Gemini Vision ${model} tidak mengembalikan teks`);
  return text;
}

async function callOpenRouterVision(
  req: AIVisionRequest,
  model: string
): Promise<string> {
  if (!OPENROUTER_KEY) throw new Error('OpenRouter API key tidak diset');

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
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'SISFO SMK',
      },
      body: JSON.stringify(body),
    },
    model
  );

  if (!res.ok) {
    const err = await res.text().catch(() => '');
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
// PUBLIC API
// ============================================================================
export async function generateText(req: AITextRequest): Promise<AIResult> {
  const attempts: string[] = [];

  // 1. Groq
  if (GROQ_KEY) {
    for (const model of GROQ_MODELS) {
      try {
        const text = await callGroq(req, model);
        console.info(`[ai] ✅ ${model} (groq)`);
        return { text, provider: 'groq', model };
      } catch (e: any) {
        attempts.push(`groq:${model}:${e.message}`);
      }
    }
  }

  // 2. Cerebras
  if (CEREBRAS_KEY) {
    for (const model of CEREBRAS_MODELS) {
      try {
        const text = await callCerebras(req, model);
        console.info(`[ai] ✅ ${model} (cerebras)`);
        return { text, provider: 'cerebras', model };
      } catch (e: any) {
        attempts.push(`cerebras:${model}:${e.message}`);
      }
    }
  }

  // 3. Gemini
  if (GEMINI_KEY) {
    for (const model of GEMINI_MODELS) {
      try {
        const text = await callGemini(req, model);
        console.info(`[ai] ✅ ${model} (gemini)`);
        return { text, provider: 'gemini', model };
      } catch (e: any) {
        attempts.push(`gemini:${model}:${e.message}`);
      }
    }
  }

  // 4. OpenRouter
  if (OPENROUTER_KEY) {
    for (const model of OPENROUTER_MODELS) {
      try {
        const text = await callOpenRouter(req, model);
        console.info(`[ai] ✅ ${model} (openrouter)`);
        return { text, provider: 'openrouter', model };
      } catch (e: any) {
        attempts.push(`openrouter:${model}:${e.message}`);
      }
    }
  }

  console.error('[ai] semua provider gagal:', attempts);
  throw new Error('Semua provider AI gagal merespons. Cek koneksi atau hubungi admin.');
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

export async function generateVision(req: AIVisionRequest): Promise<AIResult> {
  const attempts: string[] = [];

  // Vision: OpenRouter dulu (gratis), lalu Gemini
  if (OPENROUTER_KEY) {
    for (const model of OPENROUTER_VISION_MODELS) {
      try {
        const text = await callOpenRouterVision(req, model);
        console.info(`[ai] ✅ ${model} (openrouter vision)`);
        return { text, provider: 'openrouter', model };
      } catch (e: any) {
        attempts.push(`openrouter:${model}:${e.message}`);
      }
    }
  }

  if (GEMINI_KEY) {
    for (const model of GEMINI_VISION_MODELS) {
      try {
        const text = await callGeminiVision(req, model);
        console.info(`[ai] ✅ ${model} (gemini vision)`);
        return { text, provider: 'gemini', model };
      } catch (e: any) {
        attempts.push(`gemini:${model}:${e.message}`);
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
    console.error('[ai] parse JSON vision gagal dari', provider, ':', cleaned.slice(0, 300));
    throw new Error('AI vision mengembalikan format tidak valid. Coba lagi.');
  }
}

// ============================================================================
// HEALTH CHECK
// ============================================================================
export function hasAnyProvider(): boolean {
  return Boolean(GROQ_KEY || CEREBRAS_KEY || GEMINI_KEY || OPENROUTER_KEY);
}

export function getAvailableProviders(): AIProviderId[] {
  const list: AIProviderId[] = [];
  if (GROQ_KEY) list.push('groq');
  if (CEREBRAS_KEY) list.push('cerebras');
  if (GEMINI_KEY) list.push('gemini');
  if (OPENROUTER_KEY) list.push('openrouter');
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