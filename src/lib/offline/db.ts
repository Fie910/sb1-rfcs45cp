//src/lib/offline/db.ts
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

export interface PendingOp {
  op_id: string;                       // uuid client (juga dikirim sebagai client_op_id)
  table: string;
  action: 'insert' | 'upsert' | 'update' | 'delete';
  payload: any;
  match?: Record<string, any>;         // untuk update/delete (compound match)
  conflictTarget?: string;             // untuk upsert
  createdAt: number;
  retries: number;
  lastError?: string;
  userId: string;
  label?: string;                      // label UI: "Presensi mengajar"
}

interface OfflineDB extends DBSchema {
  pending_ops: {
    key: string;
    value: PendingOp;
    indexes: { 'by-createdAt': number; 'by-userId': string };
  };
  cache: {
    key: string;
    value: { key: string; data: any; updatedAt: number };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDB>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<OfflineDB>('smk-offline', 1, {
      upgrade(db) {
        const ops = db.createObjectStore('pending_ops', { keyPath: 'op_id' });
        ops.createIndex('by-createdAt', 'createdAt');
        ops.createIndex('by-userId', 'userId');
        db.createObjectStore('cache', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}