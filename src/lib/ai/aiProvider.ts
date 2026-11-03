// src/lib/ai/aiProvider.ts
export type AIProviderId = 'groq' | 'gemini' | 'deepseek';

export interface AITextRequest {
  prompt: string;
  systemPrompt?: string;
  examples?: { input: string; output: string }[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export interface AIVisionRequest {
  prompt: string;
  systemPrompt?: string;
  examples?: { input: string; output: string }[];
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
const GEMINI_KEY = ENV.VITE_GEMINI_API_KEY as string | undefined;
const DEEPSEEK_KEY = ENV.VITE_DEEPSEEK_API_KEY as string | undefined;

const hasGroq = Boolean(GROQ_KEY && GROQ_KEY.startsWith('gsk_'));
const hasGemini = Boolean(GEMINI_KEY && GEMINI_KEY.length > 10);
const hasDeepSeek = Boolean(DEEPSEEK_KEY);

// ============================================================================
// CONFIG — MODEL LIST
// ============================================================================
const GROQ_MODELS = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'];
const GROQ_VISION_MODELS = ['qwen/qwen3.8-27b'];

const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
  'gemini-3.1-flash-lite',
];
const GEMINI_VISION_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-pro-preview',
];

const DEEPSEEK_MODELS = ['deepseek-chat', 'deepseek-reasoner'];
const DEEPSEEK_VISION_MODELS = ['deepseek-v4-flash-vision-exp'];

// ============================================================================
// RETRY & UTILS
// ============================================================================
const MAX_RETRY_PER_MODEL = 1;
const RETRY_DELAY_MS = 1500;
const RETRYABLE_STATUS = [429, 500, 502, 503, 504];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url: string, init: RequestInit, model: string): Promise<Response> {
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
// GROQ — TEXT & VISION
// ============================================================================
async function callGroq(req: AITextRequest, model: string): Promise<string> {
  if (!hasGroq) throw new Error('Groq API key tidak valid');
  const messages: any[] = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
  messages.push({ role: 'user', content: req.prompt });

  const body: any = { model, messages, temperature: req.temperature ?? 0.3, max_tokens: req.maxTokens ?? 4096 };
  if (req.jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` }, body: JSON.stringify(body),
  }, model);

  if (!res.ok) throw new Error(`Groq HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callGroqVision(req: AIVisionRequest, model: string): Promise<string> {
  if (!hasGroq) throw new Error('Groq API key tidak valid');
  const userContent: any[] = [
    { type: 'text', text: req.prompt },
    { type: 'image_url', image_url: { url: `data:${req.imageMimeType};base64,${req.imageBase64}` } }
  ];
  const messages: any[] = [{ role: 'user', content: userContent }];
  const body: any = { model, messages, temperature: req.temperature ?? 0.3, max_tokens: req.maxTokens ?? 4096 };

  const res = await fetchWithRetry('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` }, body: JSON.stringify(body),
  }, model);

  if (!res.ok) throw new Error(`Groq Vision HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================================
// GEMINI — TEXT & VISION
// ============================================================================
async function callGemini(req: AITextRequest, model: string): Promise<string> {
  if (!hasGemini) throw new Error('Gemini API key tidak valid');
  const contents: any[] = [{ role: 'user', parts: [{ text: req.prompt }] }];

  const payload: any = { contents, generationConfig: { temperature: req.temperature ?? 0.3, maxOutputTokens: req.maxTokens ?? 4096 } };
  if (req.systemPrompt) payload.systemInstruction = { parts: [{ text: req.systemPrompt }] };
  if (req.jsonMode) payload.generationConfig.responseMimeType = 'application/json';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, model);

  if (!res.ok) throw new Error(`Gemini ${model} HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callGeminiVision(req: AIVisionRequest, model: string): Promise<string> {
  if (!hasGemini) throw new Error('Gemini API key tidak valid');

  const contents: any[] = [{
    role: 'user',
    parts: [
      { text: req.prompt },
      { inlineData: { mimeType: req.imageMimeType, data: req.imageBase64 } }
    ]
  }];

  const payload: any = { contents, generationConfig: { temperature: req.temperature ?? 0.3, maxOutputTokens: req.maxTokens ?? 4096 } };
  if (req.systemPrompt) payload.systemInstruction = { parts: [{ text: req.systemPrompt }] };
  if (req.jsonMode) payload.generationConfig.responseMimeType = 'application/json';

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
  const res = await fetchWithRetry(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, model);

  if (!res.ok) throw new Error(`Gemini Vision ${model} HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ============================================================================
// DEEPSEEK — TEXT & VISION
// ============================================================================
async function callDeepSeek(req: AITextRequest, model: string): Promise<string> {
  if (!hasDeepSeek) throw new Error('DeepSeek API key tidak valid');
  const messages: any[] = [];
  if (req.systemPrompt) messages.push({ role: 'system', content: req.systemPrompt });
  messages.push({ role: 'user', content: req.prompt });

  const body: any = { model, messages, temperature: req.temperature ?? 0.3, max_tokens: req.maxTokens ?? 4096 };
  if (req.jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetchWithRetry('https://api.deepseek.com/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` }, body: JSON.stringify(body),
  }, model);

  if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function callDeepSeekVision(req: AIVisionRequest, model: string): Promise<string> {
  if (!hasDeepSeek) throw new Error('DeepSeek API key tidak valid');
  const userContent: any[] = [
    { type: 'text', text: req.prompt },
    { type: 'image_url', image_url: { url: `data:${req.imageMimeType};base64,${req.imageBase64}` } }
  ];
  const messages: any[] = [{ role: 'user', content: userContent }];
  const body: any = { model, messages, temperature: req.temperature ?? 0.3, max_tokens: req.maxTokens ?? 4096 };

  const res = await fetchWithRetry('https://api.deepseek.com/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${DEEPSEEK_KEY}` }, body: JSON.stringify(body),
  }, model);

  if (!res.ok) throw new Error(`DeepSeek Vision HTTP ${res.status}: ${await readErrorBody(res)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// ============================================================================
// PUBLIC API — FAILOVER LOGIC
// ============================================================================
export async function generateText(req: AITextRequest): Promise<AIResult> {
  const attempts: string[] = [];

  if (hasGroq) {
    for (const model of GROQ_MODELS) {
      try { return { text: await callGroq(req, model), provider: 'groq', model }; }
      catch (e: any) { attempts.push(e.message); }
    }
  }

  if (hasGemini) {
    for (const model of GEMINI_MODELS) {
      try { return { text: await callGemini(req, model), provider: 'gemini', model }; }
      catch (e: any) { attempts.push(e.message); }
    }
  }

  if (hasDeepSeek) {
    for (const model of DEEPSEEK_MODELS) {
      try { return { text: await callDeepSeek(req, model), provider: 'deepseek', model }; }
      catch (e: any) { attempts.push(e.message); }
    }
  }

  throw new Error(`Semua provider teks gagal: \n${attempts.join('\n')}`);
}

export async function generateJSON<T>(req: AITextRequest): Promise<{ data: T; provider: AIProviderId; model: string }> {
  const { text, provider, model } = await generateText({ ...req, jsonMode: true });
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return { data: JSON.parse(cleaned) as T, provider, model };
}

export async function generateVision(req: AIVisionRequest): Promise<AIResult> {
  const attempts: string[] = [];
  const isPdf = req.imageMimeType === 'application/pdf';

  if (hasGemini) {
    for (const model of GEMINI_VISION_MODELS) {
      try { return { text: await callGeminiVision(req, model), provider: 'gemini', model }; }
      catch (e: any) { attempts.push(e.message); }
    }
  }

  if (hasDeepSeek) {
    for (const model of DEEPSEEK_VISION_MODELS) {
      try { return { text: await callDeepSeekVision(req, model), provider: 'deepseek', model }; }
      catch (e: any) { attempts.push(e.message); }
    }
  }

  if (hasGroq && !isPdf) {
    for (const model of GROQ_VISION_MODELS) {
      try { return { text: await callGroqVision(req, model), provider: 'groq', model }; }
      catch (e: any) { attempts.push(e.message); }
    }
  }

  throw new Error(`Semua provider vision gagal: \n${attempts.join('\n')}`);
}

export async function generateJSONVision<T>(req: AIVisionRequest): Promise<{ data: T; provider: AIProviderId; model: string }> {
  const { text, provider, model } = await generateVision({ ...req, jsonMode: true });
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  return { data: JSON.parse(cleaned) as T, provider, model };
}

export function hasAnyProvider(): boolean {
  return hasGroq || hasGemini || hasDeepSeek;
}

export function getAvailableProviders(): AIProviderId[] {
  const list: AIProviderId[] = [];
  if (hasGroq) list.push('groq');
  if (hasGemini) list.push('gemini');
  if (hasDeepSeek) list.push('deepseek');
  return list;
}

export async function checkAiAvailable(): Promise<boolean> {
  try {
    await generateText({ prompt: 'Reply OK', maxTokens: 5, temperature: 0 });
    return true;
  } catch {
    return false;
  }
}