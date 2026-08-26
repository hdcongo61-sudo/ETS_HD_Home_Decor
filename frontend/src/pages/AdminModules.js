import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Blocks, Check, X, SlidersHorizontal, Save } from 'lucide-react';
import { PageHeader, Workspace, LoadingSkeleton } from '../components/business';

/**
 * AdminModules — administration dynamique (Phase 7.4).
 *
 * Consomme le catalogue de modules serveur (GET /api/v2/modules) : droits de
 * plan, activation par organisation (PUT /api/v2/modules/:key/settings) et
 * permissions de l'utilisateur — plus l'éditeur de paramètres hiérarchisés
 * (GET/PUT /api/v2/settings). L'autorisation backend reste décisionnaire.
 */
const AdminModules = () => {
  const [modules, setModules] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [modulesRes, settingsRes] = await Promise.all([
        api.get('/v2/modules'),
        api.get('/v2/settings'),
      ]);
      setModules(Array.isArray(modulesRes.data?.modules) ? modulesRes.data.modules : []);
      setSettings(settingsRes.data?.settings || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Impossible de charger les modules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleToggle = async (module) => {
    try {
      setToggling(module.key);
      await api.put(`/v2/modules/${module.key}/settings`, { enabled: !module.enabled });
      setModules((prev) => prev.map((m) => (m.key === module.key ? { ...m, enabled: !m.enabled } : m)));
      toast.success(`${module.label} ${module.enabled ? 'désactivé' : 'activé'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Impossible de modifier ce module');
    } finally {
      setToggling(null);
    }
  };

  const updateSetting = (key, value) => {
    setSettings((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const handleSaveSettings = async () => {
    try {
      setSavingSettings(true);
      await api.put('/v2/settings', { values: settings });
      toast.success('Paramètres enregistrés');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur lors de l\'enregistrement');
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) return <Workspace><LoadingSkeleton /></Workspace>;

  const sections = {};
  for (const module of modules) {
    const section = module.nav?.section || 'autres';
    if (!sections[section]) sections[section] = [];
    sections[section].push(module);
  }

  return (
    <Workspace className="space-y-5">
      <PageHeader
        eyebrow="Administration"
        title="Modules et paramètres"
        description="Activez ou désactivez les modules de votre organisation et ajustez les paramètres par boutique."
      />

      {/* Catalogue de modules (serveur) */}
      <section className="fluent-card-filled p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
            <Blocks className="h-5 w-5" />
          </span>
          <div>
            <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Catalogue de modules</h2>
            <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Géré par le serveur — les droits de plan et les permissions backend restent décisionnaires.
            </p>
          </div>
        </div>

        {Object.entries(sections).map(([section, sectionModules]) => (
          <div key={section} className="mb-5 last:mb-0">
            <h3 className="fui-caption1-strong mb-2 uppercase" style={{ color: 'var(--colorNeutralForeground3)' }}>
              {section}
            </h3>
            <div className="space-y-2">
              {sectionModules.map((module) => (
                <div
                  key={module.key}
                  className="flex items-center justify-between gap-4 rounded-[var(--radiusLarge)] p-3"
                  style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{module.label}</p>
                      <span className="fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>{module.key}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {module.entitled ? (
                        <span className="inline-flex items-center gap-1 fui-caption2" style={{ color: 'var(--colorPaletteGreenForeground1)' }}>
                          <Check className="h-3 w-3" /> Plan éligible
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 fui-caption2" style={{ color: 'var(--colorPaletteRedForeground1)' }}>
                          <X className="h-3 w-3" /> Non inclus au plan
                        </span>
                      )}
                      {module.allowed ? (
                        <span className="inline-flex items-center gap-1 fui-caption2" style={{ color: 'var(--colorPaletteGreenForeground1)' }}>
                          <Check className="h-3 w-3" /> Autorisé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 fui-caption2" style={{ color: 'var(--colorNeutralForeground3)' }}>
                          <X className="h-3 w-3" /> Sans permission
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleToggle(module)}
                    disabled={!module.entitled || toggling === module.key}
                    className="relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40"
                    style={{
                      background: module.enabled ? 'var(--colorBrandBackground)' : 'var(--colorNeutralStroke2)',
                    }}
                    aria-label={`${module.enabled ? 'Désactiver' : 'Activer'} ${module.label}`}
                  >
                    <span
                      className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
                      style={{ left: 2, transform: module.enabled ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Paramètres hiérarchisés (boutique courante) */}
      <section className="fluent-card-filled p-4 sm:p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
            <SlidersHorizontal className="h-5 w-5" />
          </span>
          <div>
            <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Paramètres</h2>
            <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Défaut plateforme → organisation → boutique. Les remplacements de la boutique courante sont enregistrés ici.
            </p>
          </div>
        </div>

        {settings && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>Devise</span>
              <input
                type="text"
                value={settings.currency || ''}
                onChange={(e) => updateSetting('currency', e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-[var(--radiusMedium)] border px-3 py-2 fui-body1"
                style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground1)', color: 'var(--colorNeutralForeground1)' }}
              />
            </label>
            <label className="block">
              <span className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>Locale</span>
              <input
                type="text"
                value={settings.locale || ''}
                onChange={(e) => updateSetting('locale', e.target.value)}
                className="mt-1 w-full rounded-[var(--radiusMedium)] border px-3 py-2 fui-body1"
                style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground1)', color: 'var(--colorNeutralForeground1)' }}
              />
            </label>
            <label className="block">
              <span className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>Fuseau horaire</span>
              <input
                type="text"
                value={settings.timezone || ''}
                onChange={(e) => updateSetting('timezone', e.target.value)}
                className="mt-1 w-full rounded-[var(--radiusMedium)] border px-3 py-2 fui-body1"
                style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground1)', color: 'var(--colorNeutralForeground1)' }}
              />
            </label>
            <label className="block">
              <span className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>Fenêtre de retour (jours)</span>
              <input
                type="number"
                min="0"
                value={settings['returns.maxReturnDays'] ?? 30}
                onChange={(e) => updateSetting('returns.maxReturnDays', Number(e.target.value))}
                className="mt-1 w-full rounded-[var(--radiusMedium)] border px-3 py-2 fui-body1"
                style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground1)', color: 'var(--colorNeutralForeground1)' }}
              />
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(settings['payments.allowCredit'])}
                onChange={(e) => updateSetting('payments.allowCredit', e.target.checked)}
              />
              <span className="fui-body1" style={{ color: 'var(--colorNeutralForeground1)' }}>Autoriser le prépaiement client (crédit)</span>
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                checked={Boolean(settings['approvals.poSeparation'])}
                onChange={(e) => updateSetting('approvals.poSeparation', e.target.checked)}
              />
              <span className="fui-body1" style={{ color: 'var(--colorNeutralForeground1)' }}>Séparation demandeur/approbateur sur les commandes</span>
            </label>
          </div>
        )}

        <button
          type="button"
          onClick={handleSaveSettings}
          disabled={savingSettings}
          className="mt-5 inline-flex items-center gap-2 rounded-[var(--radiusMedium)] px-4 py-2 fui-body1-strong text-white"
          style={{ background: 'var(--colorBrandBackground)' }}
        >
          <Save className="h-4 w-4" />
          {savingSettings ? 'Enregistrement…' : 'Enregistrer les paramètres'}
        </button>
      </section>
    </Workspace>
  );
};

export default AdminModules;
