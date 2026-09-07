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
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Data Sekolah</h1>
        <p className="text-slate-500 mt-1">Pengaturan lokasi dan radius GPS sekolah</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <School className="text-blue-600" size={20} />
          </div>
          <h2 className="text-lg font-semibold text-slate-800">Informasi Sekolah</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-600 mb-1.5">Nama Sekolah</label>
          <input
            type="text"
            value={form.nama_sekolah}
            onChange={(e) => setForm({ ...form, nama_sekolah: e.target.value })}
            placeholder="Contoh: SMA Negeri 1"
            className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="text-blue-600" size={18} />
            <p className="text-sm font-semibold text-blue-800">Pengaturan GPS (Geofencing)</p>
          </div>
          <p className="text-xs text-blue-600 mb-4">
            Koordinat ini digunakan untuk memvalidasi posisi guru saat input agenda. Pastikan menggunakan koordinat yang akurat.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Latitude</label>
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm({ ...form, latitude: e.target.value })}
                placeholder="Contoh: -6.200000"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Longitude</label>
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm({ ...form, longitude: e.target.value })}
                placeholder="Contoh: 106.816666"
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-600 mb-1.5">Radius (meter)</label>
            <input
              type="number"
              value={form.radius_meter}
              onChange={(e) => setForm({ ...form, radius_meter: e.target.value })}
              placeholder="Contoh: 200"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-slate-400 mt-1">Radius toleransi dari lokasi sekolah untuk validasi presensi guru</p>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Simpan Pengaturan
          </button>
        </div>
      </div>
    </div>
  );
}
