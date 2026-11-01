import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight, Bell, Check, Database, FileImage, FileText, History, Layers, RefreshCw, Server, ShieldCheck, Trash2, Upload, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader, Workspace } from '../components/business';
import { platformApi } from '../features/platform/api';
import { useAppSettings } from '../context/AppSettingsContext';
import { resolveAppLogo } from '../utils/appBranding';

const PLATFORM_CONTACT_FIELDS = [
  { name: 'supportEmail', label: 'E-mail de support', type: 'email', maxLength: 254, placeholder: 'support@exemple.com' },
  { name: 'supportPhone', label: 'Téléphone de support', type: 'tel', maxLength: 40, placeholder: '+243 …' },
  { name: 'whatsappUrl', label: 'Lien WhatsApp', type: 'url', maxLength: 500, placeholder: 'https://wa.me/243…' },
  { name: 'websiteUrl', label: 'Site web', type: 'url', maxLength: 500, placeholder: 'https://www.exemple.com' },
  { name: 'address', label: 'Adresse de la plateforme', type: 'text', maxLength: 200, placeholder: 'Ville, pays' },
];

const getPlatformContactInfo = (branding = {}) => ({
  supportEmail: branding.supportEmail || '',
  supportPhone: branding.supportPhone || '',
  whatsappUrl: branding.whatsappUrl || '',
  websiteUrl: branding.websiteUrl || '',
  address: branding.address || '',
});

const PlatformLogoSettings = () => {
  const { platformBranding, setPlatformBranding } = useAppSettings();
  const {
    appName: platformAppName,
    supportEmail: platformSupportEmail,
    supportPhone: platformSupportPhone,
    whatsappUrl: platformWhatsappUrl,
    websiteUrl: platformWebsiteUrl,
    address: platformAddress,
  } = platformBranding || {};
  const [appName, setAppName] = useState(platformAppName || 'ETS HD Gestion');
  const [contactInfo, setContactInfo] = useState(() => getPlatformContactInfo(platformBranding));
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const logoUrl = resolveAppLogo(removeLogo ? '' : previewUrl || platformBranding?.logoUrl);
  const savedAppName = platformAppName || 'ETS HD Gestion';
  const savedContactInfo = {
    supportEmail: platformSupportEmail || '',
    supportPhone: platformSupportPhone || '',
    whatsappUrl: platformWhatsappUrl || '',
    websiteUrl: platformWebsiteUrl || '',
    address: platformAddress || '',
  };
  const hasContactChanges = PLATFORM_CONTACT_FIELDS.some(({ name }) => (
    (contactInfo[name] || '').trim() !== savedContactInfo[name]
  ));
  const hasChanges = appName.trim() !== savedAppName || hasContactChanges || Boolean(file) || removeLogo;

  useEffect(() => {
    setAppName(platformAppName || 'ETS HD Gestion');
    setContactInfo({
      supportEmail: platformSupportEmail || '',
      supportPhone: platformSupportPhone || '',
      whatsappUrl: platformWhatsappUrl || '',
      websiteUrl: platformWebsiteUrl || '',
      address: platformAddress || '',
    });
  }, [
    platformAppName,
    platformSupportEmail,
    platformSupportPhone,
    platformWhatsappUrl,
    platformWebsiteUrl,
    platformAddress,
  ]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl('');
      return undefined;
    }
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const selectLogo = (event) => {
    const nextFile = event.target.files?.[0] || null;
    event.target.value = '';
    if (!nextFile) return;
    const supportedFormats = /\.(jpe?g|png|webp|gif|avif)$/i;
    if (!nextFile.type.startsWith('image/') || !supportedFormats.test(nextFile.name)) {
      toast.error('Le fichier sélectionné doit être une image.');
      return;
    }
    if (nextFile.size > 5 * 1024 * 1024) {
      toast.error('Le logo ne doit pas dépasser 5 Mo.');
      return;
    }
    setFile(nextFile);
    setRemoveLogo(false);
  };

  const savePlatformBranding = async () => {
    if (!hasChanges) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('appName', appName.trim());
      PLATFORM_CONTACT_FIELDS.forEach(({ name }) => formData.append(name, (contactInfo[name] || '').trim()));
      if (file) formData.append('logoFile', file);
      if (removeLogo) formData.append('removeLogo', 'true');
      const { data } = await platformApi.updatePlatformBranding(formData);
      setPlatformBranding(data);
      setFile(null);
      setRemoveLogo(false);
      toast.success('Informations de la plateforme mises à jour.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de mettre à jour les informations de la plateforme.');
    } finally {
      setSaving(false);
    }
  };

  const cancelChanges = () => {
    setAppName(savedAppName);
    setContactInfo(savedContactInfo);
    setFile(null);
    setRemoveLogo(false);
  };

  return (
    <section className="fluent-card-filled overflow-hidden">
      <div className="flex flex-wrap items-start gap-4 p-4 sm:p-5">
        <img
          src={logoUrl}
          alt="Aperçu du logo de l’application"
          className="h-16 w-16 shrink-0 rounded-xl border bg-white object-contain p-1"
          style={{ borderColor: 'var(--colorNeutralStroke2)' }}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <FileImage size={18} aria-hidden="true" style={{ color: 'var(--colorBrandForeground1)' }} />
            <h2 className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>Logo de l’application</h2>
          </div>
          <p className="mt-1 max-w-3xl fui-caption1 leading-relaxed" style={{ color: 'var(--colorNeutralForeground2)' }}>
            Ce nom et ce logo représentent la plateforme dans la connexion, la navigation et les écrans de chargement pour toutes les boutiques.
            Les noms et logos commerciaux des boutiques sur leurs factures et documents restent inchangés.
          </p>
          <div className="mt-4 max-w-xl">
            <label htmlFor="platform-app-name" className="mb-1.5 block fui-caption1 font-semibold" style={{ color: 'var(--colorNeutralForeground1)' }}>
              Nom global de l’application
            </label>
            <input
              id="platform-app-name"
              type="text"
              value={appName}
              onChange={(event) => setAppName(event.target.value)}
              maxLength={80}
              required
              className="form-control w-full"
              placeholder="Nom de l’application"
            />
          </div>
          <div className="mt-5 grid max-w-3xl gap-3 sm:grid-cols-2">
            <h3 className="sm:col-span-2 fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
              Coordonnées de la plateforme
            </h3>
            {PLATFORM_CONTACT_FIELDS.map(({ name, label, type, maxLength, placeholder }) => (
              <div key={name} className={name === 'address' ? 'sm:col-span-2' : ''}>
                <label htmlFor={`platform-${name}`} className="mb-1.5 block fui-caption1 font-semibold" style={{ color: 'var(--colorNeutralForeground1)' }}>
                  {label}
                </label>
                <input
                  id={`platform-${name}`}
                  type={type}
                  value={contactInfo[name]}
                  onChange={(event) => setContactInfo((current) => ({ ...current, [name]: event.target.value }))}
                  maxLength={maxLength}
                  className="form-control w-full"
                  placeholder={placeholder}
                  autoComplete={name === 'supportEmail' ? 'email' : name === 'supportPhone' ? 'tel' : 'off'}
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <label htmlFor="platform-app-logo" className="ms-button ms-button-secondary ms-button-sm cursor-pointer">
              <Upload size={15} aria-hidden="true" /> Choisir une image
            </label>
            <input id="platform-app-logo" type="file" accept=".jpg,.jpeg,.png,.webp,.gif,.avif" onChange={selectLogo} className="sr-only" />
            {platformBranding?.logoUrl && !removeLogo && (
              <button
                type="button"
                onClick={() => { setFile(null); setRemoveLogo(true); }}
                className="ms-button ms-button-ghost ms-button-sm"
              >
                <Trash2 size={15} aria-hidden="true" /> Réinitialiser le logo
              </button>
            )}
            {hasChanges && (
              <>
                <button type="button" onClick={savePlatformBranding} disabled={saving || !appName.trim()} className="ms-button ms-button-primary ms-button-sm">
                  {saving ? <RefreshCw size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                  {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
                <button type="button" onClick={cancelChanges} disabled={saving} className="ms-button ms-button-ghost ms-button-sm">
                  <X size={15} aria-hidden="true" /> Annuler
                </button>
              </>
            )}
          </div>
          {file && <p className="mt-2 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{file.name} · {(file.size / (1024 * 1024)).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} Mo</p>}
        </div>
      </div>
    </section>
  );
};

const formatBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} octets`;
  const units = ['Ko', 'Mo', 'Go', 'To'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${units[unitIndex]}`;
};

const TenantDataUsage = () => {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await platformApi.tenantDataUsage();
      setUsage(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Impossible de charger l’utilisation des données.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUsage(); }, [loadUsage]);

  return (
    <section className="fluent-card-filled overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
        <div className="flex items-start gap-3">
          <Database size={19} aria-hidden="true" style={{ color: 'var(--colorBrandForeground1)', marginTop: 2 }} />
          <div>
            <h2 className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>Données utilisées par boutique</h2>
            <p className="mt-1 fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>
              Part estimée de chaque boutique dans le volume total des documents tenant-scopés.
            </p>
          </div>
        </div>
        <button type="button" onClick={loadUsage} disabled={loading} className="ms-button ms-button-secondary ms-button-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {loading && !usage ? (
        <div role="status" className="p-4 fui-body1" style={{ color: 'var(--colorNeutralForeground2)' }}>Calcul de l’utilisation en cours…</div>
      ) : usage ? (
        <>
          <div className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-3 fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>
            <span>Volume mesuré total : <strong>{formatBytes(usage.totalEstimatedBytes)}</strong></span>
            <span>{usage.measuredCollections} collections analysées</span>
          </div>
          {usage.shops.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[38rem] text-left">
                <thead>
                  <tr className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)', borderTop: '1px solid var(--colorNeutralStroke2)' }}>
                    <th scope="col" className="px-4 py-2 font-medium">Boutique</th>
                    <th scope="col" className="px-4 py-2 font-medium">Données estimées</th>
                    <th scope="col" className="px-4 py-2 font-medium">Part du total</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Documents</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.shops.map((shop) => (
                    <tr key={shop.tenantId} className="border-t" style={{ borderColor: 'var(--colorNeutralStroke2)' }}>
                      <th scope="row" className="px-4 py-3 fui-body1 font-medium" style={{ color: 'var(--colorNeutralForeground1)' }}>
                        {shop.name}
                        {shop.code && <span className="ml-2 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>{shop.code}</span>}
                      </th>
                      <td className="px-4 py-3 fui-body1 tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>
                        {formatBytes(shop.estimatedBytes)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex min-w-40 items-center gap-2">
                          <div
                            role="progressbar"
                            aria-label={`Part des données de ${shop.name}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={shop.sharePercentage}
                            className="h-2 flex-1 overflow-hidden rounded-full"
                            style={{ background: 'var(--colorNeutralBackground3)' }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${shop.sharePercentage}%`, background: 'var(--colorBrandForeground1)' }}
                            />
                          </div>
                          <span className="w-14 text-right fui-caption1 tabular-nums" style={{ color: 'var(--colorNeutralForeground1)' }}>
                            {shop.sharePercentage.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right fui-body1 tabular-nums" style={{ color: 'var(--colorNeutralForeground2)' }}>
                        {Number(shop.documentCount || 0).toLocaleString('fr-FR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="p-4 fui-body1" style={{ color: 'var(--colorNeutralForeground2)' }}>Aucune boutique enregistrée.</p>
          )}
          <p className="border-t px-4 py-3 fui-caption1 leading-relaxed" style={{ borderColor: 'var(--colorNeutralStroke2)', color: 'var(--colorNeutralForeground3)' }}>
            {usage.methodology} Ce pourcentage représente la part du total des données mesurées, pas une limite de stockage.
            Calcul effectué le {new Date(usage.computedAt).toLocaleString('fr-FR')}.
          </p>
        </>
      ) : null}
    </section>
  );
};

const PLATFORM_SETTINGS = [
  {
    tab: 'plans',
    title: 'Forfaits et limites',
    description: 'Gérer le catalogue des forfaits, leurs tarifs et les capacités proposées aux boutiques.',
    icon: Layers,
  },
  {
    tab: 'users',
    title: 'Comptes des opérateurs',
    description: 'Administrer les comptes de l’équipe plateforme et leurs rôles.',
    icon: ShieldCheck,
  },
  {
    tab: 'notifications',
    title: 'Annonces aux boutiques',
    description: 'Publier des informations et nouveautés visibles par les équipes des boutiques.',
    icon: Bell,
  },
  {
    tab: 'system',
    title: 'État du système',
    description: 'Consulter la disponibilité de l’API, MongoDB, les boutiques connectées et les ressources du serveur.',
    icon: Server,
  },
  {
    tab: 'resources',
    title: 'Ressources de la plateforme',
    description: 'Gérer les guides, documents PDF et notes de nouveautés proposés aux opérateurs.',
    icon: FileText,
  },
  {
    tab: 'audit',
    title: 'Journal plateforme',
    description: 'Consulter les actions d’administration et les événements de la plateforme.',
    icon: History,
  },
];

const PlatformSettings = () => (
  <Workspace>
    <PageHeader
      eyebrow="Administration plateforme"
      title="Paramètres plateforme"
      description="Accédez aux réglages qui concernent l’ensemble du service, séparément des préférences propres à chaque boutique."
    />

    <PlatformLogoSettings />

    <section
      aria-label="Réglages de la plateforme"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {PLATFORM_SETTINGS.map(({ tab, title, description, icon: Icon }) => (
        <Link
          key={tab}
          to={`/super-admin?tab=${tab}`}
          className="group fluent-card-filled flex min-h-36 items-start gap-4 p-4 transition-colors duration-200 hover:border-[var(--colorBrandStroke1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--colorBrandForeground1)]"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusMedium)]"
            style={{ background: 'var(--colorBrandBackground2)', color: 'var(--colorBrandForeground1)' }}
            aria-hidden="true"
          >
            <Icon size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>{title}</span>
              <ArrowRight
                size={16}
                className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
                style={{ color: 'var(--colorNeutralForeground3)' }}
                aria-hidden="true"
              />
            </span>
            <span className="mt-1 block fui-caption1 leading-relaxed" style={{ color: 'var(--colorNeutralForeground2)' }}>
              {description}
            </span>
          </span>
        </Link>
      ))}
    </section>

    <TenantDataUsage />

    <aside
      className="fluent-card-filled p-4"
      style={{ borderLeft: '3px solid var(--colorBrandForeground1)' }}
    >
      <h2 className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
        Réglages des boutiques
      </h2>
      <p className="mt-1 fui-caption1 leading-relaxed" style={{ color: 'var(--colorNeutralForeground2)' }}>
        L’identité, la devise, les catégories et les autres préférences opérationnelles appartiennent à chaque boutique.
        Pour les consulter, ouvrez la boutique concernée depuis la console Super Admin et utilisez ses paramètres.
      </p>
    </aside>
  </Workspace>
);

export default PlatformSettings;
