// src/components/ErrorBoundary.tsx
import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, Home, RotateCcw } from 'lucide-react';

type Props = {
  children: ReactNode;
  /** Custom fallback opsional — kalau tidak ada, pakai default */
  fallback?: (error: Error, reset: () => void) => ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

/**
 * Error Boundary — mencegah "layar putih total" saat ada error render.
 *
 * HANYA menangkap error di fase render React.
 * Error di event handler (onClick) / async (useEffect) harus ditangani
 * dengan try/catch di kode masing-masing — dan itu sudah dilakukan.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log ke console untuk developer
    console.error('[ErrorBoundary]', error, info.componentStack);

    // Nanti kalau ada analytics, bisa dikirim ke sini:
    // sendErrorToServer({ message: error.message, stack: error.stack, componentStack: info.componentStack });
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const error = this.state.error ?? new Error('Unknown error');

    if (this.props.fallback) {
      return this.props.fallback(error, this.reset);
    }

    return <DefaultErrorFallback error={error} onReset={this.reset} />;
  }
}

// =============================================================================
// DEFAULT FALLBACK UI
// =============================================================================
function DefaultErrorFallback({
  error,
  onReset,
}: {
  error: Error;
  onReset: () => void;
}) {
  const handleReload = () => {
    window.location.reload();
  };

  const handleHome = () => {
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full bg-slate-900/85 backdrop-blur-2xl border border-slate-800/80 rounded-3xl p-8 text-center shadow-2xl shadow-slate-950/60">
        {/* Icon */}
        <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mb-6 shadow-lg shadow-rose-500/10">
          <AlertTriangle size={32} />
        </div>

        {/* Heading */}
        <h1 className="text-xl font-extrabold text-slate-100 tracking-tight mb-2">
          Ada yang salah
        </h1>
        <p className="text-sm text-slate-400 mb-6 leading-relaxed">
          Aplikasi mengalami gangguan. Data Anda aman. Silakan coba lagi, atau
          kembali ke beranda.
        </p>

        {/* Detail error — hanya di dev mode */}
        {import.meta.env.DEV && (
          <details className="mb-6 text-left">
            <summary className="text-xs font-medium text-slate-500 cursor-pointer hover:text-slate-400 mb-2 select-none">
              Detail error (mode development)
            </summary>
            <pre className="text-[10px] text-rose-400 bg-slate-950 border border-slate-800 p-3 rounded-lg overflow-auto max-h-40 font-mono whitespace-pre-wrap break-all">
              {error.message}
              {error.stack && (
                <>
                  {'\n\n'}
                  {error.stack.split('\n').slice(0, 5).join('\n')}
                </>
              )}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleReload}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-colors cursor-pointer"
          >
            <RotateCcw size={14} />
            Muat Ulang
          </button>
          <button
            onClick={handleHome}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs transition-colors cursor-pointer"
          >
            <Home size={14} />
            Ke Beranda
          </button>
        </div>

        {/* Reset state (opsional — untuk developer memicu ulang render) */}
        {import.meta.env.DEV && (
          <button
            onClick={onReset}
            className="mt-3 text-[10px] text-slate-600 hover:text-slate-400 transition-colors cursor-pointer"
          >
            Coba render ulang tanpa reload
          </button>
        )}
      </div>
    </div>
  );
}