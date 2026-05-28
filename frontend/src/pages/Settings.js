import { useState, useEffect, useCallback, useContext } from 'react';
import api from '../services/api';
import toast, { Toaster } from 'react-hot-toast';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { mixHexColors, resolveAppLogo } from '../utils/appBranding';

const TABS = [
  { key: 'categories', label: 'Catégories produits', endpoint: '/lookups/categories' },
  { key: 'expenseCategories', label: 'Catégories dépenses', endpoint: '/lookups/expense-categories' },
  { key: 'containers', label: 'Conteneurs', endpoint: '/lookups/containers' },
  { key: 'warehouses', label: 'Entrepôts', endpoint: '/lookups/warehouses' },
  { key: 'suppliers', label: 'Fournisseurs', endpoint: '/lookups/suppliers' },
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
  removeLogo: false,
});

const settingInputClass = "min-h-[48px] w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:text-sm";
const settingButtonClass = "min-h-[48px] w-full rounded-xl px-4 py-3 text-sm font-semibold transition disabled:opacity-70 sm:w-auto";

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

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 sm:py-6 lg:py-10">
      <Toaster position="top-right" />
      <h1 className="text-2xl font-semibold text-gray-900 sm:text-3xl tracking-tight mb-5 sm:mb-6">
        Paramètres
      </h1>

      {isAdmin && (
        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Identité de l'application</h2>
              <p className="mt-1 text-sm text-gray-500">
                Personnalisez le nom, le logo, la couleur principale et les textes clés pour rendre l’application plus professionnelle.
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-500">
              Visible dans la navigation, la page de connexion, le footer et le titre du navigateur.
            </div>
          </div>

          <form onSubmit={handleSaveBrandingSettings} className="grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_320px]">
            <div className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <BrandingField
                  label="Nom de l'application"
                  description="Le nom principal visible dans la barre du haut et le titre du navigateur."
                >
                  <input
                    type="text"
                    value={brandingSettings.appName}
                    onChange={(e) => handleBrandingFieldChange('appName', e.target.value)}
                    className={settingInputClass}
                    placeholder="Ex: HD Gestion Pro"
                    required
                  />
                </BrandingField>

                <BrandingField
                  label="Nom court"
                  description="Utilisé pour les versions compactes et les invites d'installation."
                >
                  <input
                    type="text"
                    value={brandingSettings.shortName}
                    onChange={(e) => handleBrandingFieldChange('shortName', e.target.value)}
                    className={settingInputClass}
                    placeholder="Ex: HD Pro"
                    required
                  />
                </BrandingField>
              </div>

              <BrandingField
                label="Signature"
                description="Une courte phrase pour donner du contexte et renforcer l'image professionnelle."
              >
                <input
                  type="text"
                  value={brandingSettings.tagline}
                  onChange={(e) => handleBrandingFieldChange('tagline', e.target.value)}
                  className={settingInputClass}
                  placeholder="Ex: Ventes, stock et encaissements en un seul endroit"
                  required
                />
              </BrandingField>

              <div className="grid gap-4 sm:grid-cols-2">
                <BrandingField
                  label="Logo"
                  description="Importez un logo carré propre pour l’en-tête et l’écran de connexion."
                >
                  <div className="space-y-3 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3 sm:p-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleBrandingLogoChange}
                      className="block w-full text-sm text-gray-600 file:mb-2 file:block file:min-h-[42px] file:w-full file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-semibold file:text-gray-700 sm:file:mb-0 sm:file:inline-block sm:file:w-auto sm:file:mr-3"
                    />
                    <input
                      type="url"
                      value={brandingSettings.logoUrl}
                      onChange={(e) => handleBrandingFieldChange('logoUrl', e.target.value)}
                      className={settingInputClass}
                      placeholder="Ou collez l'URL d'un logo"
                    />
                    <label className="flex min-h-[44px] items-start gap-3 rounded-xl bg-white px-3 py-2.5 text-sm text-gray-600">
                      <input
                        type="checkbox"
                        checked={brandingSettings.removeLogo}
                        onChange={(e) => handleBrandingFieldChange('removeLogo', e.target.checked)}
                        className="mt-0.5 h-5 w-5 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      Retirer le logo personnalisé et revenir au logo par défaut
                    </label>
                  </div>
                </BrandingField>

                <BrandingField
                  label="Couleur principale"
                  description="Une seule couleur forte suffit pour personnaliser les points de contact clés."
                >
                  <div className="flex min-h-[48px] items-center gap-3 rounded-xl border border-gray-300 bg-white px-3 py-2">
                    <input
                      type="color"
                      value={brandingSettings.primaryColor}
                      onChange={(e) => handleBrandingFieldChange('primaryColor', e.target.value)}
                      className="h-11 w-14 shrink-0 cursor-pointer rounded-lg border border-gray-200 bg-white"
                    />
                    <input
                      type="text"
                      value={brandingSettings.primaryColor}
                      onChange={(e) => handleBrandingFieldChange('primaryColor', e.target.value)}
                      className="min-w-0 flex-1 border-0 bg-transparent text-base font-medium text-gray-700 focus:outline-none focus:ring-0 sm:text-sm"
                      placeholder="#2563EB"
                    />
                  </div>
                </BrandingField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <BrandingField
                  label="Titre de connexion"
                  description="Le grand titre affiché sur la page de connexion."
                >
                  <input
                    type="text"
                    value={brandingSettings.loginTitle}
                    onChange={(e) => handleBrandingFieldChange('loginTitle', e.target.value)}
                    className={settingInputClass}
                    placeholder="Connexion"
                    required
                  />
                </BrandingField>

                <BrandingField
                  label="Sous-titre de connexion"
                  description="Le message d'accueil juste sous le titre."
                >
                  <input
                    type="text"
                    value={brandingSettings.loginSubtitle}
                    onChange={(e) => handleBrandingFieldChange('loginSubtitle', e.target.value)}
                    className={settingInputClass}
                    placeholder="Accédez à votre espace professionnel"
                    required
                  />
                </BrandingField>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <BrandingField
                  label="Téléphone support"
                  description="Affiché en bas de la page de connexion et dans le footer."
                >
                  <input
                    type="text"
                    value={brandingSettings.supportPhone}
                    onChange={(e) => handleBrandingFieldChange('supportPhone', e.target.value)}
                    className={settingInputClass}
                    placeholder="+242 06 00 00 00"
                  />
                </BrandingField>

                <BrandingField
                  label="Email support"
                  description="Pratique pour un contact plus formel depuis le footer."
                >
                  <input
                    type="email"
                    value={brandingSettings.supportEmail}
                    onChange={(e) => handleBrandingFieldChange('supportEmail', e.target.value)}
                    className={settingInputClass}
                    placeholder="contact@entreprise.com"
                  />
                </BrandingField>
              </div>

              <BrandingField
                label="Texte du footer"
                description="La ligne institutionnelle en bas de l'application."
              >
                <input
                  type="text"
                  value={brandingSettings.footerText}
                  onChange={(e) => handleBrandingFieldChange('footerText', e.target.value)}
                  className={settingInputClass}
                  placeholder="Entreprise. Tous droits réservés."
                  required
                />
              </BrandingField>

              <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
                <button
                  type="button"
                  onClick={handleResetBrandingSettings}
                  disabled={savingBrandingSettings}
                  className={`${settingButtonClass} border border-gray-300 text-gray-700 hover:bg-gray-50`}
                >
                  Réinitialiser
                </button>
                <button
                  type="submit"
                  disabled={savingBrandingSettings}
                  className={`${settingButtonClass} text-white hover:opacity-95`}
                  style={{ backgroundColor: previewColor }}
                >
                  {savingBrandingSettings ? 'Enregistrement...' : 'Enregistrer la personnalisation'}
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-gray-50 p-3 sm:p-4">
              <div className="mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Aperçu rapide</h3>
                <p className="mt-1 text-xs text-gray-500">
                  Vérifiez le rendu de base avant d’enregistrer.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3" style={{ backgroundColor: previewSurface }}>
                  <img
                    src={previewLogo}
                    alt={brandingSettings.shortName || brandingSettings.appName}
                    className="h-11 w-11 rounded-xl border border-white/70 bg-white object-contain p-1 shadow-sm"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{brandingSettings.appName}</p>
                    <p className="truncate text-xs text-gray-500">{brandingSettings.tagline}</p>
                  </div>
                </div>

                <div className="space-y-4 px-4 py-5">
                  <div className="text-center">
                    <div
                      className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl"
                      style={{ backgroundColor: previewSurface }}
                    >
                      <img
                        src={previewLogo}
                        alt={brandingSettings.shortName || brandingSettings.appName}
                        className="h-9 w-9 rounded-xl bg-white object-contain p-1 shadow-sm"
                      />
                    </div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em]" style={{ color: previewColor }}>
                      {brandingSettings.shortName || brandingSettings.appName}
                    </p>
                    <p className="mt-2 text-lg font-semibold text-gray-900">{brandingSettings.loginTitle}</p>
                    <p className="mt-1 text-sm text-gray-500">{brandingSettings.loginSubtitle}</p>
                  </div>

                  <button
                    type="button"
                    className="w-full rounded-xl px-4 py-3 text-sm font-medium text-white"
                    style={{ backgroundColor: previewColor }}
                  >
                    Bouton principal
                  </button>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 text-xs text-gray-500">
                    <p className="font-medium text-gray-700">{brandingSettings.footerText}</p>
                    {(brandingSettings.supportPhone || brandingSettings.supportEmail) && (
                      <p className="mt-1">
                        {[brandingSettings.supportPhone, brandingSettings.supportEmail].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </form>
        </section>
      )}

      {isAdmin && (
        <section className="mb-5 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Dates Manuelles</h2>
            <p className="mt-1 text-sm text-gray-500">
              Activez ou masquez la saisie manuelle des dates pour rattraper des ventes ou dépenses notées sur papier.
            </p>
          </div>

          <div className="space-y-3">
            <PreferenceToggle
              label="Date manuelle des ventes"
              description="Autorise la saisie ou la correction manuelle de la date réelle d'une vente."
              checked={dateSettings.manualSaleDateEnabled}
              disabled={savingDateSettings}
              onChange={(checked) => handleDateSettingToggle('manualSaleDateEnabled', checked)}
            />
            <PreferenceToggle
              label="Date manuelle des dépenses"
              description="Autorise la saisie ou la correction manuelle de la date réelle d'une dépense."
              checked={dateSettings.manualExpenseDateEnabled}
              disabled={savingDateSettings}
              onChange={(checked) => handleDateSettingToggle('manualExpenseDateEnabled', checked)}
            />
            <PreferenceToggle
              label="Date manuelle des paiements"
              description="Autorise la saisie ou la correction manuelle de la date réelle d'un paiement sur une vente."
              checked={dateSettings.manualPaymentDateEnabled}
              disabled={savingDateSettings}
              onChange={(checked) => handleDateSettingToggle('manualPaymentDateEnabled', checked)}
            />
          </div>
        </section>
      )}

      {/* Tabs */}
      <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:mb-6 sm:rounded-xl sm:bg-gray-100 sm:p-1">
        <div className="flex min-w-max gap-2 sm:min-w-0 sm:gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`min-h-[44px] rounded-xl px-4 py-2.5 text-sm font-semibold transition whitespace-nowrap sm:flex-1 sm:min-w-0 sm:rounded-lg ${
              activeTab === tab.key
                ? 'bg-gray-900 text-white shadow-sm sm:bg-white sm:text-gray-900'
                : 'bg-white text-gray-600 shadow-sm ring-1 ring-gray-200 hover:text-gray-900 sm:bg-transparent sm:shadow-none sm:ring-0'
            }`}
          >
            {tab.label}
          </button>
        ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'suppliers' ? (
        <SupplierTab endpoint="/lookups/suppliers" />
      ) : (
        <LookupTab
          key={activeTab}
          endpoint={TABS.find((t) => t.key === activeTab).endpoint}
          label={TABS.find((t) => t.key === activeTab).label}
        />
      )}
    </div>
  );
};

const BrandingField = ({ label, description, children }) => (
  <label className="block">
    <div className="mb-2.5">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <p className="mt-1 text-xs leading-relaxed text-gray-500 sm:text-sm">{description}</p>
    </div>
    {children}
  </label>
);

const PreferenceToggle = ({ label, description, checked, disabled, onChange }) => (
  <label className={`flex min-h-[64px] items-center justify-between gap-4 rounded-xl border border-gray-200 px-4 py-3 transition ${disabled ? 'opacity-70' : 'hover:border-gray-300 active:bg-gray-50'}`}>
    <div className="min-w-0 flex-1">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <p className="mt-1 text-xs leading-relaxed text-gray-500 sm:text-sm">{description}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-8 w-14 flex-shrink-0 items-center rounded-full transition ${
        checked ? 'bg-indigo-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-6 w-6 transform rounded-full bg-white transition ${
          checked ? 'translate-x-7' : 'translate-x-1'
        }`}
      />
    </button>
  </label>
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
    if (!window.confirm('Supprimer cet élément ?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      toast.success('Supprimé');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Add form */}
      <form onSubmit={handleAdd} className="border-b border-gray-100 bg-gray-50/70 p-3 sm:flex sm:gap-3 sm:p-4">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder={`Nouveau ${label.toLowerCase()}...`}
          className="min-h-[46px] w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:flex-1 sm:text-sm"
        />
        <button
          type="submit"
          disabled={submitting || !newName.trim()}
          className="mt-3 min-h-[46px] w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 sm:mt-0 sm:w-auto"
        >
          Ajouter
        </button>
      </form>

      {/* List */}
      {items.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          Aucun élément. Ajoutez-en un ci-dessus.
        </div>
      ) : (
        <div className="space-y-2 bg-gray-50/40 p-3 sm:space-y-0 sm:divide-y sm:divide-gray-100 sm:bg-white sm:p-0">
          {items.map((item) => (
            <div key={item._id} className="rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm transition hover:bg-gray-50 sm:flex sm:items-center sm:gap-3 sm:rounded-none sm:border-0 sm:px-4 sm:shadow-none">
              {editingId === item._id ? (
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:flex-1 sm:text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(item._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button
                    onClick={() => handleUpdate(item._id)}
                    disabled={submitting}
                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-green-50 px-3 py-2 text-green-700 transition hover:bg-green-100 sm:flex-none sm:bg-transparent sm:p-2 sm:text-green-600"
                    aria-label="Enregistrer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-gray-100 px-3 py-2 text-gray-600 transition hover:bg-gray-200 sm:flex-none sm:p-2 sm:text-gray-400"
                    aria-label="Annuler"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex w-full items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-gray-900 sm:text-sm">{item.name}</span>
                  <button
                    onClick={() => { setEditingId(item._id); setEditName(item.name); }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 sm:bg-transparent sm:text-gray-400"
                    aria-label="Modifier"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(item._id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 sm:bg-transparent sm:text-gray-400"
                    aria-label="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 text-xs text-gray-500">
        {items.length} élément{items.length !== 1 ? 's' : ''}
      </div>
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
    if (!window.confirm('Supprimer ce fournisseur ?')) return;
    try {
      await api.delete(`${endpoint}/${id}`);
      setItems((prev) => prev.filter((item) => item._id !== id));
      toast.success('Supprimé');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Add form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/70 p-3 sm:flex-row sm:p-4">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nom du fournisseur"
          className="min-h-[46px] w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:flex-1 sm:text-sm"
        />
        <input
          type="text"
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          placeholder="Téléphone"
          className="min-h-[46px] w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-base text-gray-900 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:w-48 sm:text-sm"
        />
        <button
          type="submit"
          disabled={submitting || !newName.trim()}
          className="min-h-[46px] w-full rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
        >
          Ajouter
        </button>
      </form>

      {/* List */}
      {items.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          Aucun fournisseur. Ajoutez-en un ci-dessus.
        </div>
      ) : (
        <div className="space-y-2 bg-gray-50/40 p-3 sm:space-y-0 sm:divide-y sm:divide-gray-100 sm:bg-white sm:p-0">
          {items.map((item) => (
            <div key={item._id} className="rounded-xl border border-gray-200 bg-white px-3 py-3 shadow-sm transition hover:bg-gray-50 sm:flex sm:items-center sm:gap-3 sm:rounded-none sm:border-0 sm:px-4 sm:shadow-none">
              {editingId === item._id ? (
                <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:flex-1 sm:text-sm"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(item._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <input
                    type="text"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Téléphone"
                    className="min-h-[44px] w-full rounded-lg border border-gray-300 px-3 py-2 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 sm:w-36 sm:text-sm"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdate(item._id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                  <button
                    onClick={() => handleUpdate(item._id)}
                    disabled={submitting}
                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-green-50 px-3 py-2 text-green-700 transition hover:bg-green-100 sm:flex-none sm:bg-transparent sm:p-2 sm:text-green-600"
                    aria-label="Enregistrer"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-gray-100 px-3 py-2 text-gray-600 transition hover:bg-gray-200 sm:flex-none sm:p-2 sm:text-gray-400"
                    aria-label="Annuler"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <div className="flex w-full items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-[15px] font-semibold text-gray-900 sm:text-sm">{item.name}</div>
                    {item.phone && <div className="mt-0.5 truncate text-xs text-gray-500">{item.phone}</div>}
                  </div>
                  <button
                    onClick={() => { setEditingId(item._id); setEditName(item.name); setEditPhone(item.phone || ''); }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition hover:bg-indigo-100 sm:bg-transparent sm:text-gray-400"
                    aria-label="Modifier"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(item._id)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600 transition hover:bg-red-100 sm:bg-transparent sm:text-gray-400"
                    aria-label="Supprimer"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 text-xs text-gray-500">
        {items.length} fournisseur{items.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
};

export default Settings;
