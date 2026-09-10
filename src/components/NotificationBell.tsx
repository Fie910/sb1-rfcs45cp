import { useEffect, useState, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, BellRing, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { requestNotificationPermission } from '@/lib/pushNotification';
import type { Notifikasi } from '@/types/database';

interface NotificationBellProps {
  guruId: string;
}

export function NotificationBell({ guruId }: NotificationBellProps) {
  const [notifications, setNotifications] = useState<Notifikasi[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Cek status izin notifikasi browser
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setPushEnabled(true);
    }
  }, []);

  // Fetch notifikasi awal & listener Supabase Realtime
  useEffect(() => {
    if (!guruId) return;

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifikasi')
        .select('*')
        .eq('guru_id', guruId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n) => !n.is_read).length);
      }
    };

    fetchNotifications();

    // Langganan pembaruan langsung
    const channel = supabase
      .channel(`notifikasi:${guruId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifikasi',
          filter: `guru_id=eq.${guruId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notifikasi;
          setNotifications((prev) => [newNotif, ...prev]);
          setUnreadCount((prev) => prev + 1);

          // Bunyikan push jika aplikasi sedang dibuka
          if (Notification.permission === 'granted') {
            new Notification(newNotif.judul, {
              body: newNotif.pesan,
              icon: '/icon-192.png',
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guruId]);

  // Tutup dropdown jika klik di luar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const markAsRead = async (id: string) => {
    const { error } = await supabase.from('notifikasi').update({ is_read: true }).eq('id', id);
    if (!error) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    }
  };

  const markAllAsRead = async () => {
    const { error } = await supabase
      .from('notifikasi')
      .update({ is_read: true })
      .eq('guru_id', guruId)
      .eq('is_read', false);

    if (!error) {
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    }
  };

  const handleEnablePush = async () => {
    const success = await requestNotificationPermission(guruId);
    if (success) {
      setPushEnabled(true);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Tombol Lonceng */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-2xl bg-slate-900/60 hover:bg-slate-800/80 text-slate-300 border border-slate-800/80 backdrop-blur-md transition-all cursor-pointer"
        aria-label="Notifikasi"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white ring-2 ring-slate-950 animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Popover Dropdown Notifikasi */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-3xl bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 shadow-2xl z-50 overflow-hidden">
          {/* Header Popover */}
          <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">Notifikasi</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {unreadCount} baru
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium transition-colors"
              >
                <CheckCheck size={14} /> Tandai dibaca
              </button>
            )}
          </div>

          {/* Banner Pendaftaran Push Notification */}
          {!pushEnabled && (
            <div className="p-3 bg-indigo-950/40 border-b border-indigo-800/30 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-indigo-200">
                <BellRing size={16} className="text-indigo-400 shrink-0" />
                <span>Aktifkan push notifikasi di HP/Browser?</span>
              </div>
              <button
                onClick={handleEnablePush}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[11px] font-medium transition-all shrink-0"
              >
                Aktifkan
              </button>
            </div>
          )}

          {/* Daftar Notifikasi */}
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-800/50 custom-scrollbar">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Bell size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-xs font-medium">Belum ada notifikasi</p>
              </div>
            ) : (
              notifications.map((item) => (
                <div
                  key={item.id}
                  className={`p-3.5 transition-colors flex gap-3 ${
                    item.is_read ? 'bg-transparent opacity-70' : 'bg-indigo-500/5'
                  }`}
                >
                  <div className="mt-0.5 p-2 rounded-xl bg-slate-950/60 border border-slate-800 text-indigo-400 shrink-0 h-fit">
                    <Sparkles size={14} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-200 truncate">
                        {item.judul}
                      </p>
                      <span className="text-[10px] text-slate-500 shrink-0">
                        {new Date(item.created_at).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed line-clamp-2">
                      {item.pesan}
                    </p>
                  </div>
                  {!item.is_read && (
                    <button
                      onClick={() => markAsRead(item.id)}
                      className="text-slate-500 hover:text-indigo-400 p-1 shrink-0 self-center"
                      title="Tandai dibaca"
                    >
                      <Check size={14} />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}