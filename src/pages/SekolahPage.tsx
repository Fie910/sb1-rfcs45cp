import { useEffect, useState } from 'react';
import { MapPin, Save, Loader2, School } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/components/Toast';
import type { PengaturanSekolah } from '@/types/database';

export function SekolahPage() {
  const [config, setConfig] = useState<PengaturanSekolah | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nama_sekolah: '',
    latitude: '',
    longitude: '',
    radius_meter: '',
  });

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('pengaturan_sekolahs')
        .select('*')
        .maybeSingle();
      if (error) {
        showToast('error', 'Gagal memuat data: ' + error.message);
        setLoading(false);
        return;
      }
      if (data) {
        setConfig(data as PengaturanSekolah);
        setForm({
          nama_sekolah: (data as PengaturanSekolah).nama_sekolah,
          latitude: String((data as PengaturanSekolah).latitude),
          longitude: String((data as PengaturanSekolah).longitude),
          radius_meter: String((data as PengaturanSekolah).radius_meter),
        });
      }
      setLoading(false);
    })();
  }, []);

  const handleSave = async () => {
    if (!form.nama_sekolah || !form.latitude || !form.longitude || !form.radius_meter) {
      showToast('error', 'Semua field wajib diisi');
      return;
    }
    setSaving(true);
    const payload = {
      nama_sekolah: form.nama_sekolah,
      latitude: parseFloat(form.latitude),
      longitude: parseFloat(form.longitude),
      radius_meter: parseFloat(form.radius_meter),
    };

    let result;
    if (config) {
      result = await supabase
        .from('pengaturan_sekolahs')
        .update(payload)
        .eq('id', config.id)
        .select('*')
        .maybeSingle();
    } else {
      result = await supabase
        .from('pengaturan_sekolahs')
        .insert(payload)
        .select('*')
        .maybeSingle();
    }

    if (result.error) {
      showToast('error', 'Gagal menyimpan: ' + result.error.message);
    } else {
      setConfig(result.data as PengaturanSekolah);
      showToast('success', 'Pengaturan sekolah berhasil disimpan');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full py-20">
        <Loader2 className="animate-spin text-indigo-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-100">Data Sekolah</h1>
        <p className="text-slate-400 mt-1">
          Pengaturan lokasi dan radius GPS sekolah
        </p>
      </div>

      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-5 shadow-sm">
        {/* Card Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-indigo-500/15 border border-indigo-500/30 rounded-xl flex items-center justify-center">
            <School className="text-indigo-400" size={20} />
          </div>
          <h2 className="text-lg font-semibold text-slate-100">Informasi Sekolah</h2>
        </div>

        {/* Nama Sekolah */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1.5">
            Nama Sekolah
          </label>
          <input
            type="text"
            value={form.nama_sekolah}
            onChange={(e) => setForm({ ...form, nama_sekolah: e.target.value })}
            placeholder="Contoh: SMA Negeri 1"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors"
          />
        </div>

        {/* GPS Box */}
        <div className="bg-indigo-500/10 rounded-xl p-4 border border-indigo-500/20">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="text-indigo-400" size={18} />
            <p className="text-sm font-semibold text-indigo-300">
              Pengaturan GPS (Geofencing)
            </p>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Koordinat ini digunakan untuk memvalidasi posisi guru saat input agenda.
            Pastikan menggunakan koordinat yang akurat.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Latitude
              </label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                placeholder="Contoh: -6.200000"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1.5">
                Longitude
              </label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                placeholder="Contoh: 106.816666"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors font-mono"
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-300 mb-1.5">
              Radius (meter)
            </label>
            <input
              type="number"
              value={form.radius_meter}
              onChange={(e) => setForm({ ...form, radius_meter: e.target.value })}
              placeholder="Contoh: 200"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-colors font-mono"
            />
            <p className="text-xs text-slate-500 mt-1">
              Radius toleransi dari lokasi sekolah untuk validasi presensi guru
            </p>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-2 border-t border-slate-800">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2.5 rounded-xl transition-colors disabled:opacity-60 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
}