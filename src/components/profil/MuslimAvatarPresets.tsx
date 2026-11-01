// src/components/profil/MuslimAvatarPresets.tsx
// Preset avatar illustrated — support SVG inline ATAU PNG dari Midjourney.
// Kalau `imageUrl` diisi, render PNG. Kalau tidak, fallback ke SVG.

type HeadwearType =
  | 'peci-hitam'
  | 'peci-putih'
  | 'none'
  | 'hijab-hitam'
  | 'hijab-abu'
  | 'hijab-pink'
  | 'hijab-navy';

export type AvatarConfig = {
  id: string;
  label: string;
  gender: 'male' | 'female';
  skinTone: string;
  clothingColor: string;
  headwear: HeadwearType;
  bg: [string, string];
  hairColor?: string;
  /** URL PNG hasil Midjourney. Kalau ada, render PNG. Kalau kosong, render SVG. */
  imageUrl?: string;
};

// =============================================================================
// GANTI URL DI BAWAH DENGAN URL DARI SUPABASE STORAGE BAPAK/IBU
// =============================================================================
const SUPABASE_STORAGE_BASE =
  'https://rovqmqflcstgydpsmzvp.supabase.co/storage/v1/object/public/avatars/presets';

export const PRESETS: AvatarConfig[] = [
  // ===== PRIA =====
  {
    id: 'm-peci-hitam-putih',
    label: 'Peci Hitam',
    gender: 'male',
    skinTone: '#d4a574',
    clothingColor: '#ffffff',
    headwear: 'peci-hitam',
    bg: ['#3b82f6', '#6366f1'],
    hairColor: '#1f2937',
    imageUrl: `${SUPABASE_STORAGE_BASE}/m-peci-hitam-putih.png`, // ← uncomment setelah upload
  },
  {
    id: 'm-peci-hitam-navy',
    label: 'Peci Hitam',
    gender: 'male',
    skinTone: '#f5d0a9',
    clothingColor: '#1e3a8a',
    headwear: 'peci-hitam',
    bg: ['#8b5cf6', '#6366f1'],
    hairColor: '#0f172a',
    imageUrl: `${SUPABASE_STORAGE_BASE}/m-peci-hitam-navy.png`,
  },
  {
    id: 'm-peci-putih-hijau',
    label: 'Peci Putih',
    gender: 'male',
    skinTone: '#8b6f47',
    clothingColor: '#10b981',
    headwear: 'peci-putih',
    bg: ['#10b981', '#059669'],
    hairColor: '#000000',
    imageUrl: `${SUPABASE_STORAGE_BASE}/m-peci-putih-hijau.png`,
  },
  {
    id: 'm-hair-biru',
    label: 'Kemeja Biru',
    gender: 'male',
    skinTone: '#d4a574',
    clothingColor: '#3b82f6',
    headwear: 'none',
    bg: ['#f59e0b', '#ea580c'],
    hairColor: '#1f2937',
    imageUrl: `${SUPABASE_STORAGE_BASE}/m-hair-biru.png`,
  },
  // ===== WANITA =====
  {
    id: 'f-hijab-hitam',
    label: 'Hijab Hitam',
    gender: 'female',
    skinTone: '#d4a574',
    clothingColor: '#ffffff',
    headwear: 'hijab-hitam',
    bg: ['#6366f1', '#8b5cf6'],
    imageUrl: `${SUPABASE_STORAGE_BASE}/f-hijab-hitam.png`,
  },
  {
    id: 'f-hijab-abu',
    label: 'Hijab Abu',
    gender: 'female',
    skinTone: '#f5d0a9',
    clothingColor: '#6b7280',
    headwear: 'hijab-abu',
    bg: ['#ec4899', '#f43f5e'],
    imageUrl: `${SUPABASE_STORAGE_BASE}/f-hijab-abu.png`,
  },
  {
    id: 'f-hijab-pink',
    label: 'Hijab Pink',
    gender: 'female',
    skinTone: '#f5d0a9',
    clothingColor: '#ec4899',
    headwear: 'hijab-pink',
    bg: ['#a855f7', '#7c3aed'],
    imageUrl: `${SUPABASE_STORAGE_BASE}/f-hijab-pink.png`,
  },
  {
    id: 'f-hijab-navy',
    label: 'Hijab Navy',
    gender: 'female',
    skinTone: '#8b6f47',
    clothingColor: '#1e3a8a',
    headwear: 'hijab-navy',
    bg: ['#0ea5e9', '#0284c7'],
    imageUrl: `${SUPABASE_STORAGE_BASE}/f-hijab-navy.png`,
  },
];

// =============================================================================
// SVG COLOR MAPS (dipakai kalau imageUrl kosong)
// =============================================================================
const HIJAB_COLORS: Record<string, string> = {
  'hijab-hitam': '#0f172a',
  'hijab-abu': '#6b7280',
  'hijab-pink': '#f472b6',
  'hijab-navy': '#1e3a8a',
};

const PECI_COLORS: Record<string, string> = {
  'peci-hitam': '#0f172a',
  'peci-putih': '#f8fafc',
};

// =============================================================================
// COMPONENT — auto-detect PNG vs SVG
// =============================================================================
export function PresetAvatar({
  config,
  className = '',
}: {
  config: AvatarConfig;
  className?: string;
}) {
  // ✅ Kalau ada imageUrl → render PNG, dan SVG di bawah TIDAK dijalankan
  if (config.imageUrl) {
    return (
      <img
        src={config.imageUrl}
        alt={config.label}
        className={className}
        loading="lazy"
        onError={(e) => {
          // Kalau PNG gagal load (misal URL salah), sembunyikan img
          // biar fallback SVG yang render (tidak ada — perlu return null)
          e.currentTarget.style.display = 'none';
        }}
      />
    );
  }

  // Fallback: render SVG illustrated
  return <SvgAvatar config={config} className={className} />;
}

// =============================================================================
// SVG AVATAR (fallback)
// =============================================================================
function SvgAvatar({
  config,
  className = '',
}: {
  config: AvatarConfig;
  className?: string;
}) {
  const gradId = `grad-${config.id}`;
  const faceShadowId = `face-${config.id}`;
  const isHijab = config.headwear.startsWith('hijab');
  const isPeci =
    config.headwear === 'peci-hitam' || config.headwear === 'peci-putih';

  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      aria-label={`Avatar ${config.label}`}
    >
      <defs>
        <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={config.bg[0]} />
          <stop offset="100%" stopColor={config.bg[1]} />
        </linearGradient>
        <radialGradient id={faceShadowId} cx="50%" cy="40%" r="65%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
        </radialGradient>
      </defs>

      <circle cx="50" cy="50" r="50" fill={`url(#${gradId})`} />
      <path d="M 18 100 Q 50 55 82 100 Z" fill={config.clothingColor} />
      <path
        d="M 42 68 L 50 76 L 58 68 L 55 66 L 50 70 L 45 66 Z"
        fill={config.clothingColor}
        stroke="#000"
        strokeOpacity="0.15"
        strokeWidth="0.6"
      />
      <rect x="44" y="58" width="12" height="12" rx="2" fill={config.skinTone} />

      {!isHijab && (
        <>
          <ellipse cx="50" cy="45" rx="15" ry="17" fill={config.skinTone} />
          <ellipse
            cx="50"
            cy="45"
            rx="15"
            ry="17"
            fill={`url(#${faceShadowId})`}
          />
        </>
      )}

      {config.headwear === 'none' && config.hairColor && (
        <>
          <path
            d="M 35 42 Q 35 26 50 26 Q 65 26 65 42 Q 60 32 50 32 Q 40 32 35 42 Z"
            fill={config.hairColor}
          />
          <path
            d="M 35 42 Q 34 46 36 50 L 39 50 Q 37 46 38 42 Z"
            fill={config.hairColor}
          />
          <path
            d="M 65 42 Q 66 46 64 50 L 61 50 Q 63 46 62 42 Z"
            fill={config.hairColor}
          />
        </>
      )}

      {isPeci && (
        <>
          <path
            d="M 33 43 Q 33 22 50 22 Q 67 22 67 43 L 67 45 Q 60 39 50 39 Q 40 39 33 45 Z"
            fill={PECI_COLORS[config.headwear]}
            stroke="#000"
            strokeOpacity="0.25"
            strokeWidth="0.6"
          />
          <path
            d="M 38 36 Q 45 29 55 29 Q 61 29 63 33 L 63 39 Q 56 33 46 33 Q 40 33 38 36 Z"
            fill="#fff"
            fillOpacity="0.18"
          />
          {config.hairColor && (
            <>
              <path
                d="M 34 43 Q 33 47 35 50 L 38 50 Q 36 47 37 43 Z"
                fill={config.hairColor}
              />
              <path
                d="M 66 43 Q 67 47 65 50 L 62 50 Q 64 47 63 43 Z"
                fill={config.hairColor}
              />
            </>
          )}
        </>
      )}

      {isHijab && (
        <>
          <path
            d="M 28 72 Q 26 42 50 22 Q 74 42 72 72 Q 65 78 50 78 Q 35 78 28 72 Z"
            fill={HIJAB_COLORS[config.headwear]}
          />
          <ellipse cx="50" cy="47" rx="13" ry="15" fill={config.skinTone} />
          <ellipse
            cx="50"
            cy="47"
            rx="13"
            ry="15"
            fill={`url(#${faceShadowId})`}
          />
          <path
            d="M 36 42 Q 38 30 50 25 Q 62 30 64 42 Q 59 34 50 32 Q 41 34 36 42 Z"
            fill="#fff"
            fillOpacity="0.15"
          />
        </>
      )}

      <circle cx="44.5" cy="45" r="1.9" fill="#1f2937" />
      <circle cx="55.5" cy="45" r="1.9" fill="#1f2937" />
      <circle cx="45" cy="44.5" r="0.6" fill="#fff" />
      <circle cx="56" cy="44.5" r="0.6" fill="#fff" />
      <path
        d="M 41 41 Q 44 39.5 47.5 41"
        stroke="#1f2937"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 52.5 41 Q 56 39.5 59 41"
        stroke="#1f2937"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 45.5 53 Q 50 57 54.5 53"
        stroke="#7f1d1d"
        strokeWidth="0.9"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="40" cy="51" r="2.2" fill="#ef4444" fillOpacity="0.22" />
      <circle cx="60" cy="51" r="2.2" fill="#ef4444" fillOpacity="0.22" />
    </svg>
  );
}

/** Helper untuk render dari preset id */
export function PresetAvatarById({
  presetId,
  className = '',
}: {
  presetId: string;
  className?: string;
}) {
  const config = PRESETS.find((p) => p.id === presetId);
  if (!config) return null;
  return <PresetAvatar config={config} className={className} />;
}