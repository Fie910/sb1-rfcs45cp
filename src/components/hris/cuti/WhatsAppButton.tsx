// src/components/hris/cuti/WhatsAppButton.tsx
// Tombol reusable kirim WhatsApp via link wa.me (gratis, tanpa API).

import { MessageCircle } from 'lucide-react';

type Props = {
  /** Nomor HP tujuan. Bisa format 0812..., +62812..., 62812... — auto-normalize. */
  nomor: string | null | undefined;
  /** Isi pesan yang akan pre-fill di WhatsApp */
  pesan: string;
  /** Label tombol (default: "Kirim WhatsApp") */
  label?: string;
  /** Style tombol */
  variant?: 'solid' | 'outline' | 'ghost';
  /** Ukuran tombol */
  size?: 'sm' | 'md';
  /** Class tambahan */
  className?: string;
};

function normalizePhone(input: string): string {
  // Bersihkan semua non-digit
  let digits = input.replace(/\D/g, '');

  // Kalau diawali 0, ganti jadi 62
  if (digits.startsWith('0')) {
    digits = '62' + digits.slice(1);
  }
  // Kalau diawali 8, tambahkan 62
  else if (digits.startsWith('8')) {
    digits = '62' + digits;
  }
  // Kalau sudah 62, biarkan

  return digits;
}

export function WhatsAppButton({
  nomor,
  pesan,
  label = 'Kirim WhatsApp',
  variant = 'solid',
  size = 'md',
  className = '',
}: Props) {
  const cleanNumber = nomor ? normalizePhone(nomor) : '';
  const disabled = !cleanNumber;

  const url = disabled
    ? '#'
    : `https://wa.me/${cleanNumber}?text=${encodeURIComponent(pesan)}`;

  // Style varian
  const variantClass =
    variant === 'solid'
      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
      : variant === 'outline'
      ? 'bg-transparent border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10'
      : 'bg-transparent text-emerald-400 hover:bg-emerald-500/10';

  const sizeClass =
    size === 'sm'
      ? 'px-3 py-1.5 text-[11px] gap-1.5'
      : 'px-4 py-2.5 text-xs gap-2';

  if (disabled) {
    return (
      <button
        disabled
        title="Nomor HP tidak tersedia"
        className={`inline-flex items-center justify-center rounded-xl font-bold opacity-50 cursor-not-allowed ${variantClass} ${sizeClass} ${className}`}
      >
        <MessageCircle size={size === 'sm' ? 12 : 14} />
        {label}
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={`inline-flex items-center justify-center rounded-xl font-bold transition cursor-pointer active:scale-95 ${variantClass} ${sizeClass} ${className}`}
    >
      <MessageCircle size={size === 'sm' ? 12 : 14} />
      {label}
    </a>
  );
}