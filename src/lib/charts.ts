// src/lib/charts.ts
// Konfigurasi tema chart Recharts yang konsisten untuk seluruh aplikasi.
//
// Semua chart di aplikasi (Dashboard Kepsek, Monev Divisi, dan lain-lain)
// WAJIB mengimpor konstanta dari file ini, bukan hardcode warna.

// =============================================================================
// COLOR PALETTE
// =============================================================================

export const CHART_COLORS = {
  indigo: '#6366f1',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e',
  blue: '#3b82f6',
  purple: '#a855f7',
  teal: '#14b8a6',
  orange: '#f97316',
} as const;

// Warna utama untuk gradient fill chart (indigo)


// =============================================================================
// STYLE KONSISTEN — untuk seluruh chart
// =============================================================================

// Style untuk X dan Y axis
export const AXIS_STYLE = {
  stroke: '#64748b',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

// Style untuk CartesianGrid
export const GRID_STYLE = {
  stroke: '#1e293b',
  strokeDasharray: '3 3',
  vertical: false,
} as const;

// Style untuk Tooltip — tema dark konsisten
export const TOOLTIP_STYLE = {
  contentStyle: {
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '12px',
    color: '#e2e8f0',
    fontSize: '12px',
    padding: '8px 12px',
    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.4)',
  },
  labelStyle: {
    color: '#94a3b8',
    fontSize: '11px',
    fontWeight: 600,
    marginBottom: '6px',
  },
  itemStyle: {
    color: '#e2e8f0',
  },
} as const;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Format tanggal YYYY-MM-DD → "12 Sep" untuk sumbu X.
 */
export function formatShortDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format tanggal YYYY-MM-DD → "Sen" (nama hari singkat).
 */
export function formatShortDay(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00+07:00`);
  return date.toLocaleDateString('id-ID', {
    weekday: 'short',
  });
}

/**
 * Format angka menjadi persentase.
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

// =============================================================================
// TEMA KOMPONEN RECHARTS SIAP PAKAI
// =============================================================================

/**
 * Konfigurasi default untuk komponen Line / Area / Bar.
 * Pakai spread operator:
 *   <Line {...LINE_DEFAULTS} dataKey="hadir" />
 */
export const LINE_DEFAULTS = {
  type: 'monotone' as const,
  strokeWidth: 2.5,
  dot: { r: 3, strokeWidth: 2 },
  activeDot: { r: 5, strokeWidth: 2 },
};

/**
 * Margin default untuk ResponsiveContainer.
 */
export const CHART_MARGIN = {
  top: 10,
  right: 10,
  left: -15,
  bottom: 0,
};

/**
 * Tinggi default chart (px).
 */
export const CHART_HEIGHT = 240;