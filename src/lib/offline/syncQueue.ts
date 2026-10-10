// src/lib/offline/syncQueue.ts
import { getDB, type PendingOp } from './db';
import { supabase } from '../supabase';

const MAX_RETRIES = 10;
const listeners = new Set<() => void>();

export function subscribeSync(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
function emit() {
  listeners.forEach((fn) => fn());
}

export async function enqueue(
  op: Omit<PendingOp, 'op_id' | 'createdAt' | 'retries'>
): Promise<PendingOp> {
  const db = await getDB();
  const full: PendingOp = {
    ...op,
    op_id: crypto.randomUUID(),
    createdAt: Date.now(),
    retries: 0,
  };
  await db.put('pending_ops', full);
  emit();
  flushQueue();
  return full;
}

export async function getPendingOps(): Promise<PendingOp[]> {
  const db = await getDB();
  return db.getAllFromIndex('pending_ops', 'by-createdAt');
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return db.count('pending_ops');
}

export async function clearPending(): Promise<void> {
  const db = await getDB();
  await db.clear('pending_ops');
  emit();
}

let flushing = false;
export async function flushQueue(): Promise<{
  ok: number;
  fail: number;
  offline: boolean;
}> {
  if (flushing) return { ok: 0, fail: 0, offline: !navigator.onLine };
  if (!navigator.onLine) return { ok: 0, fail: 0, offline: true };

  flushing = true;
  let ok = 0;
  let fail = 0;
  try {
    const db = await getDB();
    const ops = await db.getAllFromIndex('pending_ops', 'by-createdAt');

    for (const op of ops) {
      try {
        await sendToSupabase(op);
        await db.delete('pending_ops', op.op_id);
        ok++;
      } catch (err: any) {
        const msg = String(err?.message ?? err);
        const isNetwork =
          err?.name === 'TypeError' ||
          /fetch|network|failed to fetch|load failed/i.test(msg);
        const isDuplicate =
          err?.code === '23505' ||
          /duplicate key|already exists|unique constraint/i.test(msg);

        // Duplikat = idempotent, anggap sukses
        if (isDuplicate) {
          await db.delete('pending_ops', op.op_id);
          ok++;
          continue;
        }

        op.retries++;
        op.lastError = msg;
        await db.put('pending_ops', op);

        if (isNetwork) {
          fail++;
          break; // stop, tunggu online kembali
        }
        if (op.retries >= MAX_RETRIES) {
          await db.delete('pending_ops', op.op_id);
          console.error('[offline] op dropped after max retries:', op);
        }
        fail++;
      }
    }
    emit();
    return { ok, fail, offline: false };
  } finally {
    flushing = false;
  }
}

async function sendToSupabase(op: PendingOp) {
  let q: any = supabase.from(op.table);

  if (op.action === 'insert') {
    // ✅ Insert replay pakai upsert+ignoreDuplicates bila ada conflictTarget
    // → idempotent, aman dikirim ulang berkali-kali
    if (op.conflictTarget) {
      const { error } = await q.upsert(op.payload, {
        onConflict: op.conflictTarget,
        ignoreDuplicates: true,
      });
      if (error) throw error;
    } else {
      const { error } = await q.insert(op.payload);
      if (error) throw error;
    }
  } else if (op.action === 'upsert') {
    const { error } = await q.upsert(
      op.payload,
      op.conflictTarget ? { onConflict: op.conflictTarget } : undefined
    );
    if (error) throw error;
  } else if (op.action === 'update') {
    let u = q.update(op.payload);
    const match = op.match ?? {};
    for (const [k, v] of Object.entries(match)) u = u.eq(k, v);
    const { error } = await u;
    if (error) throw error;
  } else if (op.action === 'delete') {
    let d = q.delete();
    const match = op.match ?? {};
    for (const [k, v] of Object.entries(match)) d = d.eq(k, v);
    const { error } = await d;
    if (error) throw error;
  }
}

// ============================================================================
// AUTO TRIGGERS
// ============================================================================
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushQueue();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') flushQueue();
  });
  setInterval(() => {
    flushQueue();
  }, 30_000);
}