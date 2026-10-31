import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, Bell, Check, Info, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { platformApi } from '../features/platform/api';

const ANNOUNCEMENT_STYLES = {
  info: { icon: Info, label: 'Information', color: 'var(--colorBrandForeground1)' },
  warning: { icon: AlertTriangle, label: 'À noter', color: 'var(--colorStatusWarningForeground1)' },
  success: { icon: Check, label: 'Bonne nouvelle', color: 'var(--colorStatusSuccessForeground1)' },
  urgent: { icon: AlertTriangle, label: 'Important', color: 'var(--colorStatusDangerForeground1)' },
  release: { icon: Sparkles, label: 'Nouveautés', color: 'var(--colorBrandForeground1)' },
};

const PlatformAnnouncements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const loadAnnouncements = useCallback(async () => {
    try {
      const { data } = await platformApi.tenantAnnouncements();
      setAnnouncements(Array.isArray(data) ? data.filter((item) => !item.read) : []);
    } catch (error) {
      console.error('Erreur de chargement des annonces plateforme:', error);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();
    const intervalId = window.setInterval(loadAnnouncements, 60000);
    return () => window.clearInterval(intervalId);
  }, [loadAnnouncements]);

  const markRead = async (id) => {
    try {
      setBusyId(id);
      await platformApi.markAnnouncementRead(id);
      setAnnouncements((items) => items.filter((item) => item._id !== id));
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de marquer cette annonce comme lue.');
    } finally {
      setBusyId(null);
    }
  };

  if (!announcements.length) return null;

  return (
    <aside
      aria-label="Annonces de la plateforme"
      aria-live="polite"
      className="fixed right-3 top-16 z-40 flex max-h-[70vh] w-[min(26rem,calc(100vw-1.5rem))] flex-col gap-2 overflow-y-auto sm:right-5"
    >
      {announcements.slice(0, 5).map((announcement) => {
        const style = ANNOUNCEMENT_STYLES[announcement.type] || ANNOUNCEMENT_STYLES.info;
        const Icon = style.icon;
        return (
          <section
            key={announcement._id}
            className="fluent-card-filled p-4 shadow-lg"
            style={{ borderLeft: `4px solid ${style.color}` }}
          >
            <div className="flex items-start gap-3">
              <Icon size={18} aria-hidden="true" style={{ color: style.color, marginTop: 2, flexShrink: 0 }} />
              <div className="min-w-0 flex-1">
                <p className="fui-caption1 font-semibold" style={{ color: style.color }}>{style.label}</p>
                <h2 className="fui-subtitle2 mt-0.5" style={{ color: 'var(--colorNeutralForeground1)' }}>{announcement.title}</h2>
                <p className="fui-body1 mt-1 whitespace-pre-wrap" style={{ color: 'var(--colorNeutralForeground2)' }}>{announcement.message}</p>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <time className="fui-caption2" dateTime={announcement.publishedAt} style={{ color: 'var(--colorNeutralForeground3)' }}>
                    {new Date(announcement.publishedAt).toLocaleDateString('fr-FR')}
                  </time>
                  <button
                    type="button"
                    onClick={() => markRead(announcement._id)}
                    disabled={busyId === announcement._id}
                    className="ms-button ms-button-secondary ms-button-sm min-h-[44px]"
                  >
                    {busyId === announcement._id ? 'Enregistrement…' : 'Marquer comme lu'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        );
      })}
      {announcements.length > 5 && (
        <p className="rounded-md bg-white px-3 py-2 text-center fui-caption1 shadow" style={{ color: 'var(--colorNeutralForeground2)' }}>
          {announcements.length - 5} autre(s) annonce(s) non lue(s)
        </p>
      )}
      <span className="sr-only"><Bell aria-hidden="true" /> Vous avez {announcements.length} annonce(s) non lue(s).</span>
    </aside>
  );
};

export default PlatformAnnouncements;
