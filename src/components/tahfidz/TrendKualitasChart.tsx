// src/components/tahfidz/TrendKualitasChart.tsx
// Chart trend kualitas ayat per bulan — Lancar / Cukup / Perlu Ulang.
// Data dari tahfidz_setoran_ayat, 6 bulan terakhir.

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, Loader2, RefreshCw, BarChart3,
} from 'lucide-react';
import {
  ResponsiveContainer, Tooltip, Legend, CartesianGrid,
  LineChart, Line, XAxis, YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';

// =============================================================================
// TYPES
// =============================================================================
type MonthlyStat = {
  bulan: string;         // 'YYYY-MM'
  label: string;         // 'Okt 26'
  Lancar: number;
  Cukup: number;
  'Perlu Ulang': number;
  total: number;
};

// =============================================================================
// HELPER
// =============================================================================
function getLast6Months(): { key: string; label: string }[] {
  const result: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('id-ID', {
      month: 'short',
      year: '2-digit',
    });
    result.push({ key, label });
  }
  return result;
}

// =============================================================================
// COMPONENT
// =============================================================================
export function TrendKualitasChart() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyData, setMonthlyData] = useState<MonthlyStat[]>([]);

  // ===========================================================================
  // FETCH
  // ===========================================================================
  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const months = getLast6Months();
      const firstMonth = months[0].key; // YYYY-MM
      const startDate = `${firstMonth}-01`;

      // 1. Ambil setoran 6 bulan terakhir
      const { data: setoranList, error: setoranErr } = await supabase
        .from('tahfidz_setoran')
        .select('id, tanggal')
        .gte('tanggal', startDate);

      if (setoranErr) throw setoranErr;
      if (!setoranList || setoranList.length === 0) {
        setMonthlyData(months.map((m) => ({
          bulan: m.key,
          label: m.label,
          Lancar: 0,
          Cukup: 0,
          'Perlu Ulang': 0,
          total: 0,
        })));
        return;
      }

      const setoranIds = setoranList.map((s) => s.id);

      // Map setoran_id → bulan (YYYY-MM)
      const setoranBulanMap = new Map<string, string>();
      setoranList.forEach((s) => {
        setoranBulanMap.set(s.id, s.tanggal.slice(0, 7));
      });

      // 2. Ambil ayat dinilai
      const { data: ayatData, error: ayatErr } = await supabase
        .from('tahfidz_setoran_ayat')
        .select('setoran_id, kualitas')
        .in('setoran_id', setoranIds);

      if (ayatErr) throw ayatErr;

      // 3. Aggregate per bulan
      const aggregate = new Map<string, { lancar: number; cukup: number; perlu: number }>();
      months.forEach((m) => {
        aggregate.set(m.key, { lancar: 0, cukup: 0, perlu: 0 });
      });

      (ayatData ?? []).forEach((a: any) => {
        const bulan = setoranBulanMap.get(a.setoran_id);
        if (!bulan) return;
        const e = aggregate.get(bulan);
        if (!e) return;

        if (a.kualitas === 'Lancar') e.lancar += 1;
        else if (a.kualitas === 'Cukup') e.cukup += 1;
        else if (a.kualitas === 'Perlu Ulang') e.perlu += 1;
      });

      // 4. Convert ke array
      const result: MonthlyStat[] = months.map((m) => {
        const e = aggregate.get(m.key)!;
        return {
          bulan: m.key,
          label: m.label,
          Lancar: e.lancar,
          Cukup: e.cukup,
          'Perlu Ulang': e.perlu,
          total: e.lancar + e.cukup + e.perlu,
        };
      });

      setMonthlyData(result);
    } catch (err: any) {
      console.warn('[TrendKualitas] Error:', err);
      setMonthlyData([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData(false);
  }, [fetchData]);

  // ===========================================================================
  // STATS
  // ===========================================================================
  const stats = useMemo(() => {
    const totalLancar = monthlyData.reduce((s, m) => s + m.Lancar, 0);
    const totalCukup = monthlyData.reduce((s, m) => s + m.Cukup, 0);
    const totalPerlu = monthlyData.reduce((s, m) => s + m['Perlu Ulang'], 0);
    const total = totalLancar + totalCukup + totalPerlu;
    const persenLancar = total > 0 ? (totalLancar / total) * 100 : 0;
    return { totalLancar, totalCukup, totalPerlu, total, persenLancar };
  }, [monthlyData]);

  // ===========================================================================
  // RENDER
  // ===========================================================================
  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={16} className="text-indigo-400" />
          <h3 className="text-sm font-bold text-slate-100">Trend Kualitas Per Bulan</h3>
        </div>
        <div className="text-center py-12">
          <Loader2 size={24} className="animate-spin text-indigo-400 mx-auto" />
        </div>
      </div>
    );
  }

  const isEmpty = stats.total === 0;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center">
            <TrendingUp size={14} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-100">
              Trend Kualitas Per Bulan
            </h3>
            <p className="text-[10px] text-slate-500">
              Jumlah ayat dinilai per kategori · 6 bulan terakhir
            </p>
          </div>
        </div>
        <button
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 transition cursor-pointer disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Stats Summary */}
      {!isEmpty && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
            <p className="text-lg font-extrabold text-emerald-400">
              {stats.totalLancar}
            </p>
            <p className="text-[9px] uppercase font-bold text-emerald-400/70">
              Lancar
            </p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
            <p className="text-lg font-extrabold text-amber-400">
              {stats.totalCukup}
            </p>
            <p className="text-[9px] uppercase font-bold text-amber-400/70">
              Cukup
            </p>
          </div>
          <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-center">
            <p className="text-lg font-extrabold text-rose-400">
              {stats.totalPerlu}
            </p>
            <p className="text-[9px] uppercase font-bold text-rose-400/70">
              Perlu Ulang
            </p>
          </div>
        </div>
      )}

      {/* Chart */}
      {isEmpty ? (
        <div className="h-[280px] flex flex-col items-center justify-center text-slate-500">
          <BarChart3 size={32} className="mb-2 opacity-40" />
          <p className="text-xs">Belum ada ayat dinilai dalam 6 bulan terakhir</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={monthlyData}
            margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                background: '#0f172a',
                border: '1px solid #1e293b',
                borderRadius: 12,
                fontSize: 12,
              }}
              formatter={(value: any) => [`${value} ayat`, '']}
              labelFormatter={(label, payload) => {
                if (payload && payload[0]) {
                  const item = payload[0].payload as MonthlyStat;
                  return `${label} · Total: ${item.total} ayat`;
                }
                return label;
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
              iconSize={8}
            />
            <Line
              type="monotone"
              dataKey="Lancar"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="Cukup"
              stroke="#f59e0b"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
            <Line
              type="monotone"
              dataKey="Perlu Ulang"
              stroke="#f43f5e"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      )}

      {/* Footer insight */}
      {!isEmpty && (
        <div className="mt-3 pt-3 border-t border-slate-800/60 text-[10px] text-slate-500 text-center">
          📊 Dari <strong className="text-slate-300">{stats.total}</strong> ayat
          dinilai, <strong className="text-emerald-400">{stats.persenLancar.toFixed(1)}%</strong>{' '}
          masuk kategori <strong className="text-emerald-400">Lancar</strong>
        </div>
      )}
    </div>
  );
}