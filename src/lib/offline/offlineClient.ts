//src/lib/offline/offlineClient.ts

import { supabase } from '../supabase';
import { enqueue } from './syncQueue';

function isNetworkError(err: any): boolean {
  const msg = String(err?.message ?? err);
  return (
    err?.name === 'TypeError' ||
    /fetch|network|failed to fetch|load failed|timeout/i.test(msg)
  );
}

/**
 * INSERT (single atau array) — idempotent.
 * Default pakai `client_op_id` UNIQUE. Untuk tabel dengan PK uuid
 * (mis. tahfidz_setoran), kirim `conflictTarget: 'id'`.
 */
export async function offlineInsert(
  table: string,
  rows: Record<string, any> | Record<string, any>[],
  opts: {
    userId: string;
    label?: string;
    conflictTarget?: string; // default 'client_op_id'
  } = { userId: '' }
): Promise<{ ok: boolean; queued: boolean; data?: any }> {
  const arr = Array.isArray(rows) ? rows : [rows];
  const conflictTarget = opts.conflictTarget ?? 'client_op_id';
  const payloads = arr.map((p) => ({
    ...p,
    client_op_id: p.client_op_id ?? crypto.randomUUID(),
  }));

  if (navigator.onLine) {
    try {
      const { data, error } = await supabase
        .from(table)
        .upsert(payloads, { onConflict: conflictTarget, ignoreDuplicates: true })
        .select();
      if (error) throw error;
      return { ok: true, queued: false, data };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  await enqueue({
    table,
    action: 'insert',
    payload: payloads,
    conflictTarget,
    userId: opts.userId,
    label: opts.label,
  });
  return { ok: true, queued: true };
}

export async function offlineUpsert(
  table: string,
  row: Record<string, any>,
  conflictTarget: string,
  opts: { userId: string; label?: string } = { userId: '' }
): Promise<{ ok: boolean; queued: boolean }> {
  const payload = { ...row, client_op_id: row.client_op_id ?? crypto.randomUUID() };

  if (navigator.onLine) {
    try {
      const { error } = await supabase
        .from(table)
        .upsert(payload, { onConflict: conflictTarget });
      if (error) throw error;
      return { ok: true, queued: false };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  await enqueue({
    table,
    action: 'upsert',
    payload,
    conflictTarget,
    userId: opts.userId,
    label: opts.label,
  });
  return { ok: true, queued: true };
}

export async function offlineUpdate(
  table: string,
  match: Record<string, any>,
  patch: Record<string, any>,
  opts: { userId: string; label?: string } = { userId: '' }
): Promise<{ ok: boolean; queued: boolean }> {
  if (navigator.onLine) {
    try {
      let q: any = supabase.from(table).update(patch);
      for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
      const { error } = await q;
      if (error) throw error;
      return { ok: true, queued: false };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  await enqueue({
    table,
    action: 'update',
    payload: patch,
    match,
    userId: opts.userId,
    label: opts.label,
  });
  return { ok: true, queued: true };
}