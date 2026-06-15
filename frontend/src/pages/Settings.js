import { confirmDialog } from '../components/ConfirmProvider';
import { useState, useEffect, useCallback, useContext } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, Check, X, RotateCcw, Save,
  Tag, Receipt, Boxes, Warehouse, Truck, Palette, Sparkles, CalendarClock, FileDown, CreditCard, ArrowUpRight,
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { mixHexColors, resolveAppLogo } from '../utils/appBranding';
import { PageHeader, Workspace, EmptyState, LoadingSkeleton } from '../components/business';

const TABS = [
  { key: 'categories', label: 'Catégories produits', endpoint: '/lookups/categories', icon: Tag },
  { key: 'expenseCategories', label: 'Catégories dépenses', endpoint: '/lookups/expense-categories', icon: Receipt },
  { key: 'containers', label: 'Conteneurs', endpoint: '/lookups/containers', icon: Boxes },
  { key: 'warehouses', label: 'Entrepôts', endpoint: '/lookups/warehouses', icon: Warehouse },
  { key: 'suppliers', label: 'Fournisseurs', endpoint: '/lookups/suppliers', icon: Truck },
];

const sortByName = (items) =>
  [...items].sort((a, b) => (a?.name || '').localeCompare(b?.name || '', 'fr', { sensitivity: 'base' }));

const buildBrandingForm = (branding = {}) => ({
  appName: branding.appName || '',
  shortName: branding.shortName || '',
  tagline: branding.tagline || '',
  logoUrl: branding.logoUrl || '',
  primaryColor: branding.primaryColor || '#2563EB',
  loginTitle: branding.loginTitle || '',
  loginSubtitle: branding.loginSubtitle || '',
  footerText: branding.footerText || '',
  supportPhone: branding.supportPhone || '',
  supportEmail: branding.supportEmail || '',
  address: branding.address || '',
  removeLogo: false,
});

const settingInputClass = 'form-control';

// Plan mis en avant comme « Recommandé ».
const RECOMMENDED_PLAN = 'pro';

// Avantages mis en avant par plan (les fonctions ne sont pas bridées : la
// différence porte surtout sur la capacité et le niveau de support).
const PLAN_BENEFITS = {
  trial: {
    tagline: 'Pour tester l’application',
    bullets: ['Accès complet pendant la période d’essai', 'Aucune carte requise', 'Vos données sont conservées si vous passez à un plan payant'],
  },
  basic: {
    tagline: 'Pour démarrer sereinement',
    bullets: ['Toutes les fonctions de gestion incluses', 'Ventes, stock, clients, caisse et dépenses', 'Factures et bulletins PDF', 'Support standard'],
  },
  pro: {
    tagline: 'Pour une boutique qui grandit',
    bullets: ['Tout le plan Basique', 'Plus d’utilisateurs et de produits', 'Analyses de bénéfices et suggestions stock lent', 'Support prioritaire'],
  },
  enterprise: {
    tagline: 'Pour les grandes boutiques',
    bullets: ['Tout le plan Pro', 'Capacité étendue (utilisateurs & produits)', 'Plusieurs points de vente', 'Support dédié'],
  },
};

const Settings = () => {
  const { auth, setAuth } = useContext(AuthContext);
  const { appSettings, setAppSettings } = useAppSettings();
  const [activeTab, setActiveTab] = useState('categories');
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const [brandingSettings, setBrandingSettings] = useState(() => buildBrandingForm(appSettings?.branding));
  const [brandingLogoFile, setBrandingLogoFile] = useState(null);
  const [brandingLogoPreview, setBrandingLogoPreview] = useState('');
  const [savingBrandingSettings, setSavingBrandingSettings] = useState(false);
  const [dateSettings, setDateSettings] = useState({
    manualSaleDateEnabled: false,
    manualExpenseDateEnabled: false,
    manualPaymentDateEnabled: false,
  });
  const [savingDateSettings, setSavingDateSettings] = useState(false);

  // ── Abonnement / plan ──
  const [myTenant, setMyTenant] = useState(null);
  const [planCatalog, setPlanCatalog] = useState({});
  const [reqPlan, setReqPlan] = useState('');
  const [reqNote, setReqNote] = useState('');
  const [reqSubmitting, setReqSubmitting] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/tenants/me').then(({ data }) => setMyTenant(data)).catch(() => setMyTenant(null));
    api.get('/tenants/plan-catalog').then(({ data }) => setPlanCatalog(data.plans || {})).catch(() => setPlanCatalog({}));
  }, [isAdmin]);

  // Si on arrive via le bandeau d'essai (#abonnement), défiler jusqu'à la section.
  useEffect(() => {
    if (window.location.hash !== '#abonnement') return;
    const id = setTimeout(() => {
      document.getElementById('abonnement')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
    return () => clearTimeout(id);
  }, [myTenant]);

  const submitPlanRequest = async () => {
    if (!reqPlan) { toast.error('Choisissez un plan.'); return; }
    try {
      setReqSubmitting(true);
      await api.post('/tenants/plan-request', { requestedPlan: reqPlan, note: reqNote.trim() });
      const { data } = await api.get('/tenants/me');
      setMyTenant(data);
      setReqNote('');
      setReqPlan('');
      toast.success('Demande envoyée. Le support va la traiter.');
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'envoi de la demande");
    } finally {
      setReqSubmitting(false);
    }
  };

  useEffect(() => {
    setDateSettings({
      manualSaleDateEnabled: Boolean(auth?.user?.adminPreferences?.manualSaleDateEnabled),
      manualExpenseDateEnabled: Boolean(auth?.user?.adminPreferences?.manualExpenseDateEnabled),
      manualPaymentDateEnabled: Boolean(auth?.user?.adminPreferences?.manualPaymentDateEnabled),
    });
  }, [auth?.user?.adminPreferences?.manualExpenseDateEnabled, auth?.user?.adminPreferences?.manualPaymentDateEnabled, auth?.user?.adminPreferences?.manualSaleDateEnabled]);

  useEffect(() => {
    setBrandingSettings(buildBrandingForm(appSettings?.branding));
    setBrandingLogoFile(null);
    setBrandingLogoPreview('');
  }, [appSettings]);

  useEffect(() => () => {
    if (brandingLogoPreview) {
      URL.revokeObjectURL(brandingLogoPreview);
    }
  }, [brandingLogoPreview]);

  const handleBrandingFieldChange = (key, value) => {
    setBrandingSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleBrandingLogoChange = (event) => {
    const nextFile = event.target.files?.[0] || null;

    if (brandingLogoPreview) {
      URL.revokeObjectURL(brandingLogoPreview);
    }

    setBrandingLogoFile(nextFile);
    setBrandingLogoPreview(nextFile ? URL.createObjectURL(nextFile) : '');
    setBrandingSettings((prev) => ({
      ...prev,
      removeLogo: false,
    }));
  };

  const handleResetBrandingSettings = () => {
    if (brandingLogoPreview) {
      URL.revokeObjectURL(brandingLogoPreview);
    }

    setBrandingSettings(buildBrandingForm(appSettings?.branding));
    setBrandingLogoFile(null);
    setBrandingLogoPreview('');
  };

  const handleSaveBrandingSettings = async (event) => {
    event.preventDefault();
    if (!isAdmin) return;

    try {
      setSavingBrandingSettings(true);

      const payload = new FormData();
      payload.append('appName', brandingSettings.appName.trim());
      payload.append('shortName', brandingSettings.shortName.trim());
      payload.append('tagline', brandingSettings.tagline.trim());
      payload.append('logoUrl', brandingSettings.logoUrl.trim());
      payload.append('primaryColor', brandingSettings.primaryColor.trim());
      payload.append('loginTitle', brandingSettings.loginTitle.trim());
      payload.append('loginSubtitle', brandingSettings.loginSubtitle.trim());
      payload.append('footerText', brandingSettings.footerText.trim());
      payload.append('supportPhone', brandingSettings.supportPhone.trim());
      payload.append('supportEmail', brandingSettings.supportEmail.trim());
      payload.append('address', brandingSettings.address.trim());
      payload.append('removeLogo', String(Boolean(brandingSettings.removeLogo)));

      if (brandingLogoFile) {
        payload.append('logoFile', brandingLogoFile);
      }

      const { data } = await api.put('/app-settings', payload);
      setAppSettings(data);
      toast.success('Personnalisation enregistrée');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur de sauvegarde');
    } finally {
      setSavingBrandingSettings(false);
    }
  };

  const handleDownloadBrochure = async () => {
    try {
      const res = await api.get('/export/brochure', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Brochure_${(brandingSettings.shortName || brandingSettings.appName || 'boutique').replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Impossible de générer la brochure. Enregistrez d\'abord la personnalisation.');
    }
  };

  const previewLogo = brandingLogoPreview || resolveAppLogo(brandingSettings.removeLogo ? '' : brandingSettings.logoUrl);
  const previewColor = brandingSettings.primaryColor || '#2563EB';
  const previewSurface = mixHexColors(previewColor, 0.9);

  const handleDateSettingToggle = async (key, value) => {
    if (!auth?.user?._id || !isAdmin) return;

    const nextDateSettings = {
      ...dateSettings,
      [key]: value,
    };

    try {
      setSavingDateSettings(true);
      setDateSettings(nextDateSettings);

      const currentAdminPreferences = auth?.user?.adminPreferences || {};
      const { data } = await api.put(`/users/${auth.user._id}`, {
        adminPreferences: {
          ...currentAdminPreferences,
          ...nextDateSettings,
        },
      });

      setAuth((prev) => ({
        ...prev,
        user: data,
        isAdmin: Boolean(data?.isAdmin),
      }));
      toast.success('Préférence enregistrée');
    } catch (err) {
      setDateSettings({
        manualSaleDateEnabled: Boolean(auth?.user?.adminPreferences?.manualSaleDateEnabled),
        manualExpenseDateEnabled: Boolean(auth?.user?.adminPreferences?.manualExpenseDateEnabled),
        manualPaymentDateEnabled: Boolean(auth?.user?.adminPreferences?.manualPaymentDateEnabled),
      });
      toast.error(err.response?.data?.message || 'Erreur de sauvegarde');
    } finally {
      setSavingDateSettings(false);
    }
  };

  const activeTabConfig = TABS.find((t) => t.key === activeTab);

  return (
    <Workspace className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Paramètres"
        description="Personnalisez l'identité de la boutique et gérez vos listes de référence."
      />

      {isAdmin && myTenant && (() => {
        const cur = planCatalog[myTenant.plan] || {};
        const pending = myTenant.planRequest && myTenant.planRequest.status === 'pending' ? myTenant.planRequest : null;
        const cfa = (n) => `${Number(n || 0).toLocaleString('fr-FR')} CFA`;
        const statusLabel = { active: 'Actif', trial: 'Essai', suspended: 'Suspendu', expired: 'Expiré' }[myTenant.status] || myTenant.status;
        const statusTone = myTenant.status === 'active' ? 'ms-status-success' : myTenant.status === 'trial' ? 'ms-status-warning' : 'ms-status-danger';
        return (
          <section id="abonnement" className="fluent-card-filled scroll-mt-24 p-4 sm:p-6">
            <div className="mb-4 flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Mon abonnement</h2>
                <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Votre plan actuel et demande de changement (validée par le support).
                </p>
              </div>
            </div>

            {/* Plan actuel */}
            <div className="flex flex-wrap items-center gap-3 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
              <div className="min-w-0 flex-1">
                <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Plan actuel</p>
                <p className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>
                  {cur.label || myTenant.plan} {cur.price ? `· ${cfa(cur.price)}/mois` : ''}
                </p>
                <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Jusqu'à {myTenant.maxUsers} utilisateur(s) · {myTenant.maxProducts} produit(s)
                </p>
              </div>
              <span className={`ms-status-badge ${statusTone}`}>{statusLabel}</span>
            </div>

            {pending ? (
              <div className="mt-3 rounded-[var(--radiusLarge)] p-3.5" style={{ background: 'var(--colorStatusWarningBackground1)', border: '1px solid var(--colorStatusWarningStroke1)' }}>
                <p className="fui-body1-strong" style={{ color: 'var(--colorStatusWarningForeground1)' }}>
                  Demande en cours : passage au plan {(planCatalog[pending.requestedPlan]?.label) || pending.requestedPlan}
                </p>
                <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground2)' }}>
                  En attente de validation par le support. Vous serez notifié une fois traitée.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="form-label mb-1 block">Demander un changement de plan</label>
                    <select value={reqPlan} onChange={(e) => setReqPlan(e.target.value)} className="form-control">
                      <option value="">Choisir un plan…</option>
                      {['basic', 'pro', 'enterprise']
                        .filter((k) => k !== myTenant.plan)
                        .map((k) => {
                          const p = planCatalog[k] || {};
                          return <option key={k} value={k}>{(p.label || k)}{p.price ? ` — ${cfa(p.price)}/mois` : ''}{k === RECOMMENDED_PLAN ? ' (Recommandé)' : ''}</option>;
                        })}
                    </select>
                  </div>
                  <div>
                    <label className="form-label mb-1 block">Note (optionnel)</label>
                    <input type="text" value={reqNote} onChange={(e) => setReqNote(e.target.value)} className="form-control" placeholder="Précisez votre besoin…" />
                  </div>
                </div>
                <button type="button" onClick={submitPlanRequest} disabled={reqSubmitting || !reqPlan} className="ms-button ms-button-primary ms-button-md w-full justify-center disabled:opacity-60 sm:w-auto">
                  <ArrowUpRight className="h-4 w-4" />
                  {reqSubmitting ? 'Envoi…' : 'Envoyer la demande'}
                </button>
              </div>
            )}

            {/* Détails et avantages du plan sélectionné */}
            {!pending && reqPlan && (() => {
              const p = planCatalog[reqPlan] || {};
              const b = PLAN_BENEFITS[reqPlan] || { tagline: '', bullets: [] };
              return (
                <div className="mt-4 rounded-[var(--radiusLarge)] p-4" style={{ background: 'var(--ms-blue-soft)', border: reqPlan === RECOMMENDED_PLAN ? '1.5px solid var(--colorBrandForeground1)' : '1px solid var(--colorNeutralStroke2)' }}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="fui-subtitle2 flex items-center gap-2" style={{ color: 'var(--colorNeutralForeground1)' }}>
                      Plan {p.label || reqPlan}
                      {reqPlan === RECOMMENDED_PLAN && (
                        <span className="ms-status-badge ms-status-success inline-flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Recommandé
                        </span>
                      )}
                    </h3>
                    {p.price ? (
                      <span className="fui-subtitle1" style={{ color: 'var(--colorBrandForeground1)' }}>{cfa(p.price)}<span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>/mois</span></span>
                    ) : null}
                  </div>
                  {b.tagline && (
                    <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground2)' }}>{b.tagline}</p>
                  )}
                  <p className="fui-body1-strong mt-2" style={{ color: 'var(--colorNeutralForeground1)' }}>
                    Jusqu'à {p.maxUsers ?? '—'} utilisateur(s) · {p.maxProducts ?? '—'} produit(s)
                  </p>
                  <ul className="mt-2 space-y-1.5">
                    {b.bullets.map((t, i) => (
                      <li key={i} className="fui-caption1 flex items-start gap-2" style={{ color: 'var(--colorNeutralForeground2)' }}>
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: 'var(--colorStatusSuccessForeground1)' }} />
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })()}
          </section>
        );
      })()}

      {isAdmin && (
        <section className="fluent-card-filled p-4 sm:p-6">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                <Sparkles className="h-5 w-5" />
              </span>
              <div>
                <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Identité de l'application</h2>
                <p className="fui-caption1 mt-0.5 max-w-xl" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Personnalisez le nom, le logo, la couleur principale et les textes clés pour rendre l'application plus professionnelle.
                </p>
              </div>
            </div>
            <span className="fui-caption1 max-w-xs rounded-[var(--radiusMedium)] px-3 py-2 leading-relaxed" style={{ background: 'var(--colorNeutralBackground2)', color: 'var(--colorNeutralForeground3)' }}>
              Visible dans la navigation, la page de connexion, le footer et le titre du navigateur.
            </span>
          </div>

          <form onSubmit={handleSaveBrandingSettings} className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_320px]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <BrandingField label="Nom de l'application" description="Le nom principal visible dans la barre du haut et le titre du navigateur.">
                  <input type="text" value={brandingSettings.appName} onChange={(e) => handleBrandingFieldChange('appName', e.target.value)} className={settingInputClass} placeholder="Ex: HD Gestion Pro" required />
                </BrandingField>
                <BrandingField label="Nom court" description="Utilisé pour les versions compactes et les invites d'installation.">
                  <input type="text" value={brandingSettings.shortName} onChange={(e) => handleBrandingFieldChange('shortName', e.target.value)} className={settingInputClass} placeholder="Ex: HD Pro" required />
                </BrandingField>
              </div>

              <BrandingField label="Signature" description="Une courte phrase pour donner du contexte et renforcer l'image professionnelle.">
                <input type="text" value={brandingSettings.tagline} onChange={(e) => handleBrandingFieldChange('tagline', e.target.value)} className={settingInputClass} placeholder="Ex: Ventes, stock et encaissements en un seul endroit" required />
              </BrandingField>

              <div className="grid gap-4 sm:grid-cols-2">
                <BrandingField label="Logo" description="Importez un logo carré propre pour l'en-tête et l'écran de connexion.">
                  <div className="space-y-3 rounded-[var(--radiusLarge)] border border-dashed p-3 sm:p-4" style={{ borderColor: 'var(--ms-border-strong)', background: 'var(--colorNeutralBackground2)' }}>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBrandingLogoChange}
                      className="block w-full text-sm text-[var(--colorNeutralForeground2)] file:mb-2 file:block file:min-h-[42px] file:w-full file:rounded-[var(--radiusMedium)] file:border file:border-[var(--ms-border)] file:bg-[var(--ms-white)] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-[var(--colorNeutralForeground1)] sm:file:mb-0 sm:file:inline-block sm:file:w-auto sm:file:mr-3"
                    />
                    <input type="url" value={brandingSettings.logoUrl} onChange={(e) => handleBrandingFieldChange('logoUrl', e.target.value)} className={settingInputClass} placeholder="Ou collez l'URL d'un logo" />
                    <label className="flex min-h-[44px] items-start gap-3 rounded-[var(--radiusMedium)] bg-[var(--ms-white)] px-3 py-2.5 fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                      <input type="checkbox" checked={brandingSettings.removeLogo} onChange={(e) => handleBrandingFieldChange('removeLogo', e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded border-[var(--ms-border)] text-[var(--ms-blue)] focus:ring-[var(--ms-blue)]" />
                      Retirer le logo personnalisé et revenir au logo par défaut
                    </label>
                  </div>
                </BrandingField>

                <BrandingField label="Couleur principale" description="Une seule couleur forte suffit pour personnaliser les points de contact clés.">
                  <div className="flex min-h-[48px] items-center gap-3 rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2">
                    <Palette className="h-4 w-4 shrink-0" style={{ color: 'var(--colorNeutralForeground3)' }} />
                    <input type="color" value={brandingSettings.primaryColor} onChange={(e) => handleBrandingFieldChange('primaryColor', e.target.value)} className="h-9 w-12 shrink-0 cursor-pointer rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-white" />
                    <input type="text" value={brandingSettings.primaryColor} onChange={(e) => handleBrandingFieldChange('primaryColor', e.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-[15px] font-medium text-[var(--colorNeutralForeground1)] focus:outline-none focus:ring-0" placeholder="#2563EB" />
                  </div>
                </BrandingField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <BrandingField label="Titre de connexion" description="Le grand titre affiché sur la page de connexion.">
                  <input type="text" value={brandingSettings.loginTitle} onChange={(e) => handleBrandingFieldChange('loginTitle', e.target.value)} className={settingInputClass} placeholder="Connexion" required />
                </BrandingField>
                <BrandingField label="Sous-titre de connexion" description="Le message d'accueil juste sous le titre.">
                  <input type="text" value={brandingSettings.loginSubtitle} onChange={(e) => handleBrandingFieldChange('loginSubtitle', e.target.value)} className={settingInputClass} placeholder="Accédez à votre espace professionnel" required />
                </BrandingField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <BrandingField label="Téléphone support" description="Affiché en bas de la page de connexion et dans le footer.">
                  <input type="tel" inputMode="tel" value={brandingSettings.supportPhone} onChange={(e) => handleBrandingFieldChange('supportPhone', e.target.value)} className={settingInputClass} placeholder="+242 06 00 00 00" />
                </BrandingField>
                <BrandingField label="Email support" description="Pratique pour un contact plus formel depuis le footer.">
                  <input type="email" inputMode="email" value={brandingSettings.supportEmail} onChange={(e) => handleBrandingFieldChange('supportEmail', e.target.value)} className={settingInputClass} placeholder="contact@entreprise.com" />
                </BrandingField>
              </div>

              <BrandingField label="Adresse de la boutique" description="Affichée sur les factures, bulletins de paie et rapports PDF.">
                <input type="text" value={brandingSettings.address} onChange={(e) => handleBrandingFieldChange('address', e.target.value)} className={settingInputClass} placeholder="Ex : 12 Avenue Bourguiba, Dakar" />
              </BrandingField>

              <BrandingField label="Texte du footer" description="La ligne institutionnelle en bas de l'application.">
                <input type="text" value={brandingSettings.footerText} onChange={(e) => handleBrandingFieldChange('footerText', e.target.value)} className={settingInputClass} placeholder="Entreprise. Tous droits réservés." required />
              </BrandingField>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={handleResetBrandingSettings} disabled={savingBrandingSettings} className="ms-button ms-button-secondary ms-button-md w-full justify-center disabled:opacity-60 sm:w-auto">
                  <RotateCcw className="h-4 w-4" />
                  Réinitialiser
                </button>
                <button type="submit" disabled={savingBrandingSettings} className="ms-button ms-button-md w-full justify-center text-white disabled:opacity-60 sm:w-auto" style={{ background: previewColor, borderColor: previewColor }}>
                  <Save className="h-4 w-4" />
                  {savingBrandingSettings ? 'Enregistrement...' : 'Enregistrer la personnalisation'}
                </button>
                <button type="button" onClick={handleDownloadBrochure} className="ms-button ms-button-secondary ms-button-md w-full justify-center sm:w-auto" title="Brochure de présentation PDF à votre image">
                  <FileDown className="h-4 w-4" />
                  Brochure (PDF)
                </button>
              </div>
            </div>

            {/* Live preview */}
            <div className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] p-3 sm:p-4" style={{ background: 'var(--colorNeutralBackground2)' }}>
              <div className="mb-3">
                <h3 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Aperçu rapide</h3>
                <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>Vérifiez le rendu de base avant d'enregistrer.</p>
              </div>

              <div className="overflow-hidden rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-white)] shadow-[var(--ms-shadow-sm)]">
                <div className="flex items-center gap-3 border-b border-[var(--ms-border)] px-4 py-3" style={{ backgroundColor: previewSurface }}>
                  <img src={previewLogo} alt={brandingSettings.shortName || brandingSettings.appName} className="h-11 w-11 rounded-[var(--radiusMedium)] border border-white/70 bg-white object-contain p-1 shadow-sm" />
                  <div className="min-w-0">
                    <p className="truncate fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{brandingSettings.appName}</p>
                    <p className="truncate fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{brandingSettings.tagline}</p>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-5">
                  <div className="text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-[var(--radiusLarge)]" style={{ backgroundColor: previewSurface }}>
                      <img src={previewLogo} alt={brandingSettings.shortName || brandingSettings.appName} className="h-9 w-9 rounded-[var(--radiusMedium)] bg-white object-contain p-1 shadow-sm" />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: previewColor }}>{brandingSettings.shortName || brandingSettings.appName}</p>
                    <p className="mt-2 fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>{brandingSettings.loginTitle}</p>
                    <p className="mt-1 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{brandingSettings.loginSubtitle}</p>
                  </div>

                  <button type="button" className="w-full rounded-[var(--radiusMedium)] px-4 py-3 text-sm font-medium text-white" style={{ backgroundColor: previewColor }}>
                    Bouton principal
                  </button>

                  <div className="rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-3 py-3 fui-caption1" style={{ background: 'var(--colorNeutralBackground2)', color: 'var(--colorNeutralForeground3)' }}>
                    <p className="font-medium" style={{ color: 'var(--colorNeutralForeground2)' }}>{brandingSettings.footerText}</p>
                    {(brandingSettings.supportPhone || brandingSettings.supportEmail) && (
                      <p className="mt-1">{[brandingSettings.supportPhone, brandingSettings.supportEmail].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </section>
      )}

      {isAdmin && (
        <section className="fluent-card-filled p-4 sm:p-6">
          <div className="mb-4 flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)' }}>
              <CalendarClock className="h-5 w-5" />
            </span>
            <div>
              <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Dates manuelles</h2>
              <p className="fui-caption1 mt-0.5 max-w-xl" style={{ color: 'var(--colorNeutralForeground3)' }}>
                Activez ou masquez la saisie manuelle des dates pour rattraper des ventes ou dépenses notées sur papier.
              </p>
            </div>
          </div>

          <div className="space-y-2.5">
            <PreferenceToggle label="Date manuelle des ventes" description="Autorise la saisie ou la correction manuelle de la date réelle d'une vente." checked={dateSettings.manualSaleDateEnabled} disabled={savingDateSettings} onChange={(checked) => handleDateSettingToggle('manualSaleDateEnabled', checked)} />
            <PreferenceToggle label="Date manuelle des dépenses" description="Autorise la saisie ou la correction manuelle de la date réelle d'une dépense." checked={dateSettings.manualExpenseDateEnabled} disabled={savingDateSettings} onChange={(checked) => handleDateSettingToggle('manualExpenseDateEnabled', checked)} />
            <PreferenceToggle label="Date manuelle des paiements" description="Autorise la saisie ou la correction manuelle de la date réelle d'un paiement sur une vente." checked={dateSettings.manualPaymentDateEnabled} disabled={savingDateSettings} onChange={(checked) => handleDateSettingToggle('manualPaymentDateEnabled', checked)} />
          </div>
        </section>
      )}

      {/* Listes de référence */}
      <section className="fluent-card-filled overflow-hidden">
        <div className="px-4 pt-4 sm:px-6">
          <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Listes de référence</h2>
          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Catégories, conteneurs, entrepôts et fournisseurs utilisés dans toute l'application.
          </p>
          <div className="fui-pivot mt-3">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`fui-pivot__tab ${activeTab === tab.key ? 'fui-pivot__tab--active' : ''}`}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {activeTab === 'suppliers' ? (
            <SupplierTab endpoint="/lookups/suppliers" />
          ) : (
            <LookupTab key={activeTab} endpoint={activeTabConfig.endpoint} label={activeTabConfig.label} />
          )}
        </div>
      </section>
    </Workspace>
  );
};

const BrandingField = ({ label, description, children }) => (
  <label className="block">
    <div className="mb-2">
      <div className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{label}</div>
      <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>{description}</p>
    </div>
    {children}
  </label>
);

const PreferenceToggle = ({ label, description, checked, disabled, onChange }) => (
  <div className={`flex items-start justify-between gap-4 rounded-[var(--radiusLarge)] border p-4 transition ${disabled ? 'opacity-70' : ''}`} style={{ borderColor: 'var(--ms-border)', background: 'var(--colorNeutralBackground1)' }}>
    <div className="min-w-0 flex-1">
      <div className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{label}</div>
      <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
      style={{ background: checked ? 'var(--ms-blue)' : 'var(--colorNeutralBackground4)' }}
    >
      <span className="inline-block h-5 w-5 rounded-full bg-white shadow transition-transform" style={{ transform: checked ? 'translateX(22px)' : 'translateX(4px)' }} />
    </button>
  </div>
);

/* ============================================================ */
/* Generic Lookup Tab (Categories, Containers, Warehouses)       */
/* ============================================================ */
const LookupTab = ({ endpoint, label }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(endpoint);
      setItems(data);
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setSubmitting(true);
      const { data } = await api.post(endpoint, { name: newName.trim() });
      setItems((prev) => sortByName([...prev, data]));
      setNewName('');
      toast.success('Ajouté');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      setSubmitting(true);
      const { data } = await api.put(`${endpoint}/${id}`, { name: editName.trim() });
      setItems((prev) => sortByName(prev.map((item) => (item._id === id ? data : item))));
      setEditingId(null);
      setEditName('');
      toast.success('Modifié');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!await confirmDialog('Supprimer cet élément ?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      toast.success('Supprimé');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Nouveau ${label.toLowerCase()}...`}
          className="form-control sm:flex-1"
        />
        <button type="submit" disabled={submitting || !newName.trim()} className="ms-button ms-button-primary ms-button-md w-full justify-center disabled:opacity-50 sm:w-auto">
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </form>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState title="Aucun élément" description="Ajoutez-en un avec le champ ci-dessus." />
      ) : (
        <ul className="overflow-hidden rounded-[var(--radiusLarge)] border border-[var(--ms-border)]">
          {items.map((item, i) => (
            <li
              key={item._id}
              className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
              style={{ background: 'var(--ms-white)', borderTop: i === 0 ? 'none' : '1px solid var(--colorNeutralStroke2)' }}
            >
              {editingId === item._id ? (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="form-control sm:flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(item._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(item._id)} disabled={submitting} className="ms-icon-button flex-1 sm:flex-none" style={{ color: 'var(--colorStatusSuccessForeground1)' }} aria-label="Enregistrer">
                      <Check className="h-5 w-5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="ms-icon-button flex-1 sm:flex-none" style={{ color: 'var(--colorNeutralForeground3)' }} aria-label="Annuler">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <span className="min-w-0 flex-1 truncate fui-body1" style={{ color: 'var(--colorNeutralForeground1)' }}>{item.name}</span>
                  <button onClick={() => { setEditingId(item._id); setEditName(item.name); }} className="ms-icon-button" style={{ color: 'var(--colorNeutralForeground2)' }} aria-label="Modifier">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(item._id)} className="ms-icon-button" style={{ color: 'var(--colorStatusDangerForeground1)' }} aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
          {items.length} élément{items.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

/* ============================================================ */
/* Supplier Tab (name + phone)                                   */
/* ============================================================ */
const SupplierTab = ({ endpoint }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(endpoint);
      setItems(data);
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    try {
      setSubmitting(true);
      const { data } = await api.post(endpoint, { name: newName.trim(), phone: newPhone.trim() });
      setItems((prev) => sortByName([...prev, data]));
      setNewName('');
      setNewPhone('');
      toast.success('Fournisseur ajouté');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id) => {
    if (!editName.trim()) return;
    try {
      setSubmitting(true);
      const { data } = await api.put(`${endpoint}/${id}`, { name: editName.trim(), phone: editPhone.trim() });
      setItems((prev) => sortByName(prev.map((item) => (item._id === id ? data : item))));
      setEditingId(null);
      setEditName('');
      setEditPhone('');
      toast.success('Modifié');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!await confirmDialog('Supprimer ce fournisseur ?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      toast.success('Supprimé');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  return (
    <div className="space-y-4">
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-3 sm:flex-row">
        <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nom du fournisseur" className="form-control sm:flex-1" />
        <input type="tel" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Téléphone" className="form-control sm:w-48" />
        <button type="submit" disabled={submitting || !newName.trim()} className="ms-button ms-button-primary ms-button-md w-full justify-center disabled:opacity-50 sm:w-auto">
          <Plus className="h-4 w-4" />
          Ajouter
        </button>
      </form>

      {loading ? (
        <LoadingSkeleton rows={5} />
      ) : items.length === 0 ? (
        <EmptyState title="Aucun fournisseur" description="Ajoutez-en un avec le champ ci-dessus." />
      ) : (
        <ul className="overflow-hidden rounded-[var(--radiusLarge)] border border-[var(--ms-border)]">
          {items.map((item, i) => (
            <li
              key={item._id}
              className="flex items-center gap-3 px-3 py-2.5 sm:px-4"
              style={{ background: 'var(--ms-white)', borderTop: i === 0 ? 'none' : '1px solid var(--colorNeutralStroke2)' }}
            >
              {editingId === item._id ? (
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nom"
                    className="form-control sm:flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(item._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <input
                    type="tel"
                    inputMode="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Téléphone"
                    className="form-control sm:w-40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(item._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleUpdate(item._id)} disabled={submitting} className="ms-icon-button flex-1 sm:flex-none" style={{ color: 'var(--colorStatusSuccessForeground1)' }} aria-label="Enregistrer">
                      <Check className="h-5 w-5" />
                    </button>
                    <button onClick={() => setEditingId(null)} className="ms-icon-button flex-1 sm:flex-none" style={{ color: 'var(--colorNeutralForeground3)' }} aria-label="Annuler">
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="truncate fui-body1" style={{ color: 'var(--colorNeutralForeground1)' }}>{item.name}</div>
                    {item.phone && <div className="mt-0.5 truncate fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{item.phone}</div>}
                  </div>
                  <button onClick={() => { setEditingId(item._id); setEditName(item.name); setEditPhone(item.phone || ''); }} className="ms-icon-button" style={{ color: 'var(--colorNeutralForeground2)' }} aria-label="Modifier">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={() => handleDelete(item._id)} className="ms-icon-button" style={{ color: 'var(--colorStatusDangerForeground1)' }} aria-label="Supprimer">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {!loading && (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
          {items.length} fournisseur{items.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
};

export default Settings;
