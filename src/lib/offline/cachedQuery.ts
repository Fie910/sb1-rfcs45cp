// src/lib/offline/cachedQuery.ts
// Cache-aside untuk SELECT query Supabase.
// Online: fetch → simpan → return
// Offline: baca cache (kalau ada), atau fallback.

import { getDB } from './db';

export interface CachedResult<T> {
  data: T;
  fromCache: boolean;
  updatedAt: number | null;
}

/**
 * Fetch dari server (kalau online) → simpan ke cache → return.
 * Kalau offline / fetch gagal → baca cache.
 * Kalau cache kosong & offline → return fallback.
 */
export async function cachedQuerySafe<T>(
  key: string,
  fetcher: () => Promise<T>,
  fallback: T
): Promise<CachedResult<T>> {
  const db = await getDB();
  const cacheKey = `q:${key}`;

  // Kalau ada koneksi, coba fetch server dulu
  if (navigator.onLine) {
    try {
      const data = await fetcher();
      await db.put('cache', {
        key: cacheKey,
        data,
        updatedAt: Date.now(),
      });
      return { data, fromCache: false, updatedAt: Date.now() };
    } catch (err) {
      console.warn(`[cachedQuery] fetch "${key}" gagal, coba cache:`, err);
    }
  }

  // Fallback: cache
  const cached = await db.get('cache', cacheKey);
  if (cached) {
    return {
      data: cached.data as T,
      fromCache: true,
      updatedAt: cached.updatedAt,
    };
  }

  // Tidak ada cache — pakai fallback
  return { data: fallback, fromCache: true, updatedAt: null };
}

/** Versi yang melempar error kalau tidak ada cache & offline. */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>
): Promise<CachedResult<T>> {
  const db = await getDB();
  const cacheKey = `q:${key}`;

  if (navigator.onLine) {
    try {
      const data = await fetcher();
      await db.put('cache', {
        key: cacheKey,
        data,
        updatedAt: Date.now(),
      });
      return { data, fromCache: false, updatedAt: Date.now() };
    } catch (err) {
      console.warn(`[cachedQuery] fetch "${key}" gagal, coba cache:`, err);
    }
  }

  const cached = await db.get('cache', cacheKey);
  if (cached) {
    return {
      data: cached.data as T,
      fromCache: true,
      updatedAt: cached.updatedAt,
    };
  }

  throw new Error(`Offline & no cache for: ${key}`);
}

/** Invalidate (hapus cache) untuk key tertentu. */
export async function invalidateQuery(key: string) {
  const db = await getDB();
  await db.delete('cache', `q:${key}`);
}

/** Hapus semua cache — biasanya dipanggil saat logout. */
export async function clearAllQueryCache() {
  const db = await getDB();
  await db.clear('cache');
}