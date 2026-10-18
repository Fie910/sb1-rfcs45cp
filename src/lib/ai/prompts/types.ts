// src/lib/ai/prompts/types.ts
// Struktur universal untuk task prompt dengan few-shot examples.

export interface FewShotExample {
  /** Contoh input user (pertanyaan/instruksi). */
  input: string;
  /** Contoh output yang diharapkan (string JSON kalau jsonMode). */
  output: string;
}

export interface TaskPrompt {
  systemPrompt: string;
  examples: FewShotExample[];
  userPrompt: string;
}