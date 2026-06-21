import { confirmDialog } from '../components/ConfirmProvider';
import { useState, useEffect, useCallback, useContext } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  Plus, Pencil, Trash2, Check, X, RotateCcw, Save,
  Tag, Receipt, Boxes, Warehouse, Truck, Palette, Sparkles, CalendarClock, FileDown, CreditCard, ArrowUpRight, Printer, FileSpreadsheet,
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { getLogoDataUrl, mixHexColors, resolveAppLogo } from '../utils/appBranding';
import { PageHeader, Workspace, EmptyState, LoadingSkeleton } from '../components/business';

const TABS = [
  { key: 'categories', label: 'Catégories produits', endpoint: '/lookups/categories', icon: Tag },
  { key: 'expenseCategories', label: 'Catégories dépenses', endpoint: '/lookups/expense-categories', icon: Receipt },
  { key: 'containers', label: 'Conteneurs', endpoint: '/lookups/containers', icon: Boxes },
  { key: 'warehouses', label: 'Entrepôts', endpoint: '/lookups/warehouses', icon: Warehouse },
  { key: 'suppliers', label: 'Fournisseurs', endpoint: '/lookups/suppliers', icon: Truck },
];

// Top-level settings sections — drive the desktop sidebar and the mobile pill switcher.
const SETTINGS_SECTIONS = [
  { key: 'identite',    label: 'Identité',           icon: Sparkles,      adminOnly: true },
  { key: 'preferences', label: 'Préférences',        icon: CalendarClock, adminOnly: true },
  { key: 'abonnement',  label: 'Abonnement',         icon: CreditCard,    adminOnly: true },
  { key: 'documents',   label: 'Documents',          icon: FileDown,      adminOnly: true },
  { key: 'listes',      label: 'Listes de référence', icon: Tag,          adminOnly: false },
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
const currentDateValue = () => new Date().toISOString().slice(0, 10);

const parseDateValue = (value) => {
  const [year, month, day] = String(value || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const getDaysInRange = (startValue, endValue) => {
  const start = parseDateValue(startValue);
  const end = parseDateValue(endValue);
  if (!start || !end || start > end) return [];

  const days = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const sanitizeFilename = (value) =>
  String(value || 'document')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeSaleReferencePrefix = (value) =>
  sanitizeFilename(value)
    .replace(/_/g, '')
    .slice(0, 8)
    .toUpperCase();

const normalizeSaleReferenceSign = (value) =>
  sanitizeFilename(value)
    .replace(/_/g, '')
    .slice(0, 4)
    .toUpperCase();

const buildSaleReferencePrefix = (branding = {}) => {
  const name = branding.shortName || branding.appName || 'SHOP';
  const words = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-zA-Z0-9]+/g) || [];
  const initials = words.length > 1
    ? words.map((word) => word[0]).join('')
    : words[0];
  return normalizeSaleReferencePrefix(initials || 'SHOP') || 'SHOP';
};

const buildSaleEmployeeSign = (employeeName) => {
  const words = String(employeeName || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .match(/[a-zA-Z0-9]+/g) || [];
  if (!words.length) return 'EMP';
  const sign = words.length > 1
    ? words.map((word) => word[0]).join('')
    : words[0].slice(0, 3);
  return normalizeSaleReferenceSign(sign) || 'EMP';
};

const formatSaleReferenceDate = (date) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;

const formatDocumentDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

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
  const [activeSection, setActiveSection] = useState(isAdmin ? 'identite' : 'listes');
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
  const [saleSheetStartDate, setSaleSheetStartDate] = useState(currentDateValue());
  const [saleSheetEndDate, setSaleSheetEndDate] = useState(currentDateValue());
  const [saleSheetEmployeeName, setSaleSheetEmployeeName] = useState('');
  const [saleSheetEmployeeSign, setSaleSheetEmployeeSign] = useState('');
  const [saleSheetReferencePrefix, setSaleSheetReferencePrefix] = useState(() => buildSaleReferencePrefix(appSettings?.branding));
  const [saleSheetRowsPerDay, setSaleSheetRowsPerDay] = useState(12);
  const [employees, setEmployees] = useState([]);
  const [generatingSalesSheet, setGeneratingSalesSheet] = useState(false);
  const [partialInvoiceProductRows, setPartialInvoiceProductRows] = useState(7);
  const [partialInvoicePaymentRows, setPartialInvoicePaymentRows] = useState(6);
  const [partialInvoiceCopies, setPartialInvoiceCopies] = useState(2);
  const [generatingPartialInvoice, setGeneratingPartialInvoice] = useState(false);
  const [finalInvoiceProductRows, setFinalInvoiceProductRows] = useState(12);
  const [finalInvoiceCopies, setFinalInvoiceCopies] = useState(2);
  const [generatingFinalInvoice, setGeneratingFinalInvoice] = useState(false);

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

  useEffect(() => {
    if (!isAdmin) return;
    api.get('/employees')
      .then(({ data }) => setEmployees(Array.isArray(data) ? data : []))
      .catch(() => setEmployees([]));
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

  useEffect(() => {
    if (saleSheetReferencePrefix) return;
    setSaleSheetReferencePrefix(buildSaleReferencePrefix(appSettings?.branding));
  }, [appSettings?.branding, saleSheetReferencePrefix]);

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

  const handleDownloadProductImportTemplate = async () => {
    try {
      const XLSX = await import('xlsx');
      const productColumns = [
        'name',
        'description',
        'price',
        'stock',
        'category',
        'costPrice',
        'supplierName',
        'supplierPhone',
        'container',
        'warehouse',
        'sku',
        'minStockLevel',
        'image',
      ];
      const exampleRows = [
        {
          name: 'Canapé 3 places',
          description: 'Canapé tissu gris avec coussins',
          price: 250000,
          stock: 4,
          category: 'Salon',
          costPrice: 175000,
          supplierName: 'Fournisseur SARL',
          supplierPhone: '+242000000000',
          container: 'CONT-001',
          warehouse: 'Entrepôt principal',
          sku: 'SAL-CAN-001',
          minStockLevel: 2,
          image: 'https://exemple.com/photos/canape.jpg',
        },
      ];
      const guideRows = [
        { colonne: 'name', obligatoire: 'Oui', aliases_acceptes: 'Name, Nom, nom', note: 'Nom du produit.' },
        { colonne: 'description', obligatoire: 'Non', aliases_acceptes: 'Description, desc', note: 'Si vide, une description est générée automatiquement.' },
        { colonne: 'price', obligatoire: 'Oui', aliases_acceptes: 'Price, Prix, prix', note: 'Prix de vente. Utiliser un nombre positif.' },
        { colonne: 'stock', obligatoire: 'Non', aliases_acceptes: 'Stock, Quantité, quantite, qty', note: 'Quantité en stock. Vide = 0.' },
        { colonne: 'category', obligatoire: 'Non', aliases_acceptes: 'Category, Catégorie, categorie', note: 'Vide = Non catégorisé.' },
        { colonne: 'costPrice', obligatoire: 'Non', aliases_acceptes: 'costprice, Prix de revient, prix de revient, cost', note: 'Prix de revient pour calculer les bénéfices.' },
        { colonne: 'supplierName', obligatoire: 'Non', aliases_acceptes: 'supplier, Fournisseur, fournisseur', note: 'Nom du fournisseur.' },
        { colonne: 'supplierPhone', obligatoire: 'Non', aliases_acceptes: 'Téléphone fournisseur, telephone', note: 'Téléphone du fournisseur.' },
        { colonne: 'container', obligatoire: 'Non', aliases_acceptes: 'Conteneur, conteneur', note: 'Conteneur associé au produit.' },
        { colonne: 'warehouse', obligatoire: 'Non', aliases_acceptes: 'Entrepôt, entrepot', note: 'Entrepôt ou dépôt.' },
        { colonne: 'sku', obligatoire: 'Non', aliases_acceptes: 'SKU, Référence, reference', note: 'Référence unique. Si vide, le système génère une SKU.' },
        { colonne: 'minStockLevel', obligatoire: 'Non', aliases_acceptes: 'Stock minimum, stock minimum', note: 'Seuil d’alerte stock faible. Vide = 5.' },
        { colonne: 'image', obligatoire: 'Non', aliases_acceptes: 'Image, imageUrl, photo', note: 'URL de la photo du produit.' },
      ];

      const workbook = XLSX.utils.book_new();
      const productsSheet = XLSX.utils.json_to_sheet(exampleRows, { header: productColumns });
      productsSheet['!cols'] = [
        { wch: 26 },
        { wch: 38 },
        { wch: 12 },
        { wch: 10 },
        { wch: 18 },
        { wch: 14 },
        { wch: 24 },
        { wch: 18 },
        { wch: 16 },
        { wch: 22 },
        { wch: 16 },
        { wch: 14 },
        { wch: 42 },
      ];
      const guideSheet = XLSX.utils.json_to_sheet(guideRows);
      guideSheet['!cols'] = [
        { wch: 18 },
        { wch: 12 },
        { wch: 44 },
        { wch: 58 },
      ];

      XLSX.utils.book_append_sheet(workbook, productsSheet, 'Produits');
      XLSX.utils.book_append_sheet(workbook, guideSheet, 'Guide colonnes');
      XLSX.writeFile(workbook, 'modele_import_produits.xlsx');
      toast.success('Modèle Excel produits généré.');
    } catch (error) {
      console.error('Product import template error:', error);
      toast.error('Impossible de générer le modèle Excel produits.');
    }
  };

  const handleGenerateDailySalesPdf = async () => {
    const employeeName = saleSheetEmployeeName.trim();
    const referencePrefix = normalizeSaleReferencePrefix(saleSheetReferencePrefix || buildSaleReferencePrefix(appSettings?.branding));
    const employeeSign = normalizeSaleReferenceSign(saleSheetEmployeeSign || buildSaleEmployeeSign(employeeName));
    const days = getDaysInRange(saleSheetStartDate, saleSheetEndDate);
    if (!saleSheetStartDate || !saleSheetEndDate) {
      toast.error('Choisissez une date de début et une date de fin.');
      return;
    }
    if (!days.length) {
      toast.error('La date de fin doit être après la date de début.');
      return;
    }
    if (!employeeName) {
      toast.error("Choisissez ou saisissez le nom de l'employé.");
      return;
    }
    if (!referencePrefix) {
      toast.error('Saisissez un préfixe de référence.');
      return;
    }
    if (!employeeSign) {
      toast.error("Saisissez un signe pour l'employé.");
      return;
    }

    try {
      setGeneratingSalesSheet(true);
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default?.jsPDF || jsPDFModule.default;
      const autoTable = autoTableModule.default || autoTableModule;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const branding = appSettings?.branding || {};
      const appName = branding.appName || branding.shortName || 'HD Gestion';
      const logoDataUrl = await getLogoDataUrl(resolveAppLogo(branding.logoUrl));
      const periodLabel = `${parseDateValue(saleSheetStartDate).toLocaleDateString('fr-FR')} - ${parseDateValue(saleSheetEndDate).toLocaleDateString('fr-FR')}`;
      const rowsPerDay = Math.min(Math.max(Number(saleSheetRowsPerDay) || 12, 6), 20);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const columns = [
        'N',
        'Client',
        'Article vendu',
        'Qté',
        'PU',
        'Total vente',
        'Montant payé',
        'Note',
      ];

      days.forEach((day, dayIndex) => {
        if (dayIndex > 0) doc.addPage('a4', 'landscape');

        const dateLabel = day.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        });

        if (logoDataUrl) {
          try {
            doc.addImage(logoDataUrl, 40, 24, 42, 42);
          } catch {
            // Keep generating the document if the uploaded logo format cannot be embedded.
          }
        }

        const titleX = logoDataUrl ? 94 : 40;
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(32, 31, 30);
        doc.setFontSize(15);
        doc.text(appName, titleX, 38);
        doc.setFontSize(12);
        doc.text('Fiche journalière des ventes', titleX, 58);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text(`Période : ${periodLabel}`, 40, 82);
        doc.text(`Employé : ${employeeName} (${employeeSign})`, 220, 78);
        doc.text(`Date : ${dateLabel}`, 460, 78);

        doc.setFontSize(8);
        doc.text("Le N contient le code boutique et le signe employé. Réutiliser le même N pour chaque paiement partiel.", 40, 96);

        autoTable(doc, {
          startY: 108,
          head: [columns],
          body: Array.from({ length: rowsPerDay }, (_, rowIndex) => [
            `${referencePrefix}-${employeeSign}-${formatSaleReferenceDate(day)}-${String(rowIndex + 1).padStart(3, '0')}`,
            '',
            '',
            '',
            '',
            '',
            '',
            '',
          ]),
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 5,
            minCellHeight: 24,
            lineColor: [200, 198, 196],
            lineWidth: 0.7,
            textColor: [32, 31, 30],
          },
          headStyles: {
            fillColor: [0, 120, 212],
            textColor: 255,
            fontStyle: 'bold',
          },
          columnStyles: {
            0: { cellWidth: 126 },
            1: { cellWidth: 100 },
            2: { cellWidth: 135 },
            3: { cellWidth: 38, halign: 'center' },
            4: { cellWidth: 55, halign: 'right' },
            5: { cellWidth: 75, halign: 'right' },
            6: { cellWidth: 80, halign: 'right' },
            7: { cellWidth: 153 },
          },
          margin: { left: 40, right: 40 },
        });

        const summaryY = pageHeight - 92;
        autoTable(doc, {
          startY: summaryY,
          body: [
            ['Total ventes', '', 'Total encaissé', '', 'Signature employé', '', 'Signature admin', ''],
          ],
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 6,
            minCellHeight: 28,
            lineColor: [200, 198, 196],
            lineWidth: 0.7,
          },
          columnStyles: {
            0: { fontStyle: 'bold', cellWidth: 70 },
            1: { cellWidth: 105 },
            2: { fontStyle: 'bold', cellWidth: 82 },
            3: { cellWidth: 105 },
            4: { fontStyle: 'bold', cellWidth: 100 },
            5: { cellWidth: 140 },
            6: { fontStyle: 'bold', cellWidth: 95 },
            7: { cellWidth: 65 },
          },
          margin: { left: 40, right: 40 },
        });

        doc.setFontSize(8);
        doc.setTextColor(96, 94, 92);
        doc.text(`Page ${dayIndex + 1}/${days.length}`, pageWidth - 82, pageHeight - 24);
      });

      doc.save(`fiche_ventes_${sanitizeFilename(employeeName)}_${saleSheetStartDate}_${saleSheetEndDate}.pdf`);
      toast.success('Fiche PDF générée.');
    } catch (error) {
      console.error('Daily sales sheet PDF error:', error);
      toast.error('Impossible de générer la fiche PDF.');
    } finally {
      setGeneratingSalesSheet(false);
    }
  };

  const handleGenerateSaleInvoiceTemplatePdf = async ({
    variant,
    productRowsCount,
    paymentRowsCount = 0,
    copyCount = 2,
    setGenerating,
  }) => {
    const isPartial = variant === 'partial';
    const isFourCopyLayout = Number(copyCount) === 4;
    const fileLabel = isPartial ? 'partielle' : 'finale';
    const successLabel = isPartial ? 'Modèle de facture partielle généré.' : 'Modèle de facture finale généré.';
    const errorLabel = isPartial ? 'Impossible de générer le modèle de facture partielle.' : 'Impossible de générer le modèle de facture finale.';

    try {
      setGenerating(true);
      const [jsPDFModule, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ]);

      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default?.jsPDF || jsPDFModule.default;
      const autoTable = autoTableModule.default || autoTableModule;
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const branding = appSettings?.branding || {};
      const companyName = branding.appName || branding.shortName || 'Boutique';
      const companyLogo = await getLogoDataUrl(resolveAppLogo(branding.logoUrl));
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 8;
      const copyWidth = pageWidth / 2;
      const copyHeight = isFourCopyLayout ? pageHeight / 2 : pageHeight;
      const title = isPartial ? 'FACTURE VENTE PARTIELLE' : 'FACTURE VENTE FINALE';
      const partialFourCopyRowBudget = 6;
      const productMaxRows = isPartial ? (isFourCopyLayout ? 5 : 10) : (isFourCopyLayout ? 4 : 12);
      const paymentMaxRows = isPartial ? (isFourCopyLayout ? 5 : 8) : 0;
      const productRowCount = Math.min(Math.max(Number(productRowsCount) || productMaxRows, 1), productMaxRows);
      const availablePaymentRows = isPartial && isFourCopyLayout
        ? Math.max(partialFourCopyRowBudget - productRowCount, 1)
        : paymentMaxRows;
      const paymentRowCount = Math.min(Math.max(Number(paymentRowsCount) || 0, 0), availablePaymentRows);
      const productRows = Array.from({ length: productRowCount }, () => ['', '', '', '']);
      const paymentRows = Array.from({ length: paymentRowCount }, (_, index) => [String(index + 1), '', '']);

      const drawCopy = (copyLabel, pageIndex) => {
        const offsetX = (pageIndex % 2) * copyWidth;
        const offsetY = isFourCopyLayout ? Math.floor(pageIndex / 2) * copyHeight : 0;
        const copyLeft = offsetX + margin;
        const copyRight = offsetX + copyWidth - margin;
        const copyUsableWidth = copyWidth - margin * 2;
        const headerY = offsetY + (isFourCopyLayout ? 4 : 6);
        const headerHeight = isFourCopyLayout ? 16 : 22;
        const infoY = offsetY + (isFourCopyLayout ? 23 : 31);
        const infoHeight = isFourCopyLayout ? 18 : 24;
        const tableY = offsetY + (isFourCopyLayout ? 44 : 60);
        const footerY = offsetY + copyHeight - (isFourCopyLayout ? 4 : 6);
        const tableMargin = { left: copyLeft, right: pageWidth - copyRight };

        if (pageIndex === 0) {
          doc.setFillColor(248, 249, 251);
          doc.rect(0, 0, pageWidth, pageHeight, 'F');
          doc.setDrawColor(209, 213, 219);
          doc.setLineWidth(0.25);
          doc.line(pageWidth / 2, margin, pageWidth / 2, pageHeight - margin);
          if (isFourCopyLayout) {
            doc.line(margin, pageHeight / 2, pageWidth - margin, pageHeight / 2);
          }
        }

        doc.setFillColor(255, 255, 255);
        doc.roundedRect(copyLeft, headerY, copyUsableWidth, headerHeight, 3, 3, 'F');

        const hasLogo = Boolean(companyLogo);
        if (hasLogo) {
          try {
            doc.addImage(companyLogo, 'PNG', copyLeft + 4, headerY + 3, isFourCopyLayout ? 10 : 14, isFourCopyLayout ? 10 : 14);
          } catch {
            // Continue without logo if the uploaded file cannot be embedded.
          }
        }

        const headerX = hasLogo ? copyLeft + (isFourCopyLayout ? 17 : 22) : copyLeft + 5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isFourCopyLayout ? 7.5 : 9);
        doc.setTextColor(17, 24, 39);
        doc.text(companyName, headerX, headerY + (isFourCopyLayout ? 6 : 7));
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isFourCopyLayout ? 5 : 6);
        doc.setTextColor(107, 114, 128);
        const contactLine = [branding.address, branding.supportPhone, branding.supportEmail].filter(Boolean).join(' · ');
        if (contactLine) doc.text(contactLine, headerX, headerY + (isFourCopyLayout ? 11 : 13), { maxWidth: copyUsableWidth * 0.52 });
        if (!isFourCopyLayout && branding.footerText) doc.text(branding.footerText, headerX, headerY + 18, { maxWidth: copyUsableWidth * 0.52 });

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isFourCopyLayout ? 7 : 8.5);
        doc.setTextColor(17, 24, 39);
        doc.text(title, copyRight - 4, headerY + (isFourCopyLayout ? 6 : 7), { align: 'right' });
        doc.setFontSize(isFourCopyLayout ? 6 : 7);
        doc.setTextColor(37, 99, 235);
        doc.text(copyLabel, copyRight - 4, headerY + (isFourCopyLayout ? 12 : 15), { align: 'right' });

        const cardWidth = (copyUsableWidth - 6) / 2;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(copyLeft, infoY, cardWidth, infoHeight, 3, 3, 'F');
        doc.roundedRect(copyLeft + cardWidth + 6, infoY, cardWidth, infoHeight, 3, 3, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isFourCopyLayout ? 5.5 : 6.5);
        doc.setTextColor(107, 114, 128);
        doc.text('ACHETEUR', copyLeft + 4, infoY + (isFourCopyLayout ? 5 : 6));
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isFourCopyLayout ? 6 : 7);
        doc.setTextColor(55, 65, 81);
        doc.text('Nom :', copyLeft + 4, infoY + (isFourCopyLayout ? 11 : 13));
        doc.line(copyLeft + 18, infoY + (isFourCopyLayout ? 11 : 13), copyLeft + cardWidth - 4, infoY + (isFourCopyLayout ? 11 : 13));
        doc.text('Téléphone :', copyLeft + 4, infoY + (isFourCopyLayout ? 16 : 20));
        doc.line(copyLeft + 30, infoY + (isFourCopyLayout ? 16 : 20), copyLeft + cardWidth - 4, infoY + (isFourCopyLayout ? 16 : 20));

        const saleCardX = copyLeft + cardWidth + 6;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(isFourCopyLayout ? 5.5 : 6.5);
        doc.setTextColor(107, 114, 128);
        doc.text('VENTE', saleCardX + 4, infoY + (isFourCopyLayout ? 5 : 6));
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isFourCopyLayout ? 6 : 7);
        doc.setTextColor(55, 65, 81);
        doc.text('N :', saleCardX + 4, infoY + (isFourCopyLayout ? 10 : 12));
        doc.line(saleCardX + 13, infoY + (isFourCopyLayout ? 10 : 12), saleCardX + cardWidth - 4, infoY + (isFourCopyLayout ? 10 : 12));
        doc.text('Date :', saleCardX + 4, infoY + (isFourCopyLayout ? 15 : 18));
        doc.line(saleCardX + 20, infoY + (isFourCopyLayout ? 15 : 18), saleCardX + cardWidth - 4, infoY + (isFourCopyLayout ? 15 : 18));
        if (!isFourCopyLayout) {
          doc.text('Vendeur :', saleCardX + 4, infoY + 23);
          doc.line(saleCardX + 27, infoY + 23, saleCardX + cardWidth - 4, infoY + 23);
        }

        autoTable(doc, {
          startY: tableY,
          head: [['Produit', 'Prix unitaire', 'Qté', 'Total']],
          body: productRows,
          theme: 'grid',
          margin: tableMargin,
          headStyles: { fillColor: [17, 24, 39], textColor: 255, fontStyle: 'bold', fontSize: isFourCopyLayout ? 5.5 : 6.5, minCellHeight: isFourCopyLayout ? 4 : 5 },
          styles: { fontSize: isFourCopyLayout ? 5.5 : 6.5, cellPadding: isFourCopyLayout ? 0.8 : 1, minCellHeight: isFourCopyLayout ? 4 : 5, lineColor: [229, 231, 235], lineWidth: 0.2 },
          columnStyles: {
            0: { cellWidth: 58 },
            1: { cellWidth: 28, halign: 'right' },
            2: { cellWidth: 14, halign: 'center' },
            3: { cellWidth: 32, halign: 'right' },
          },
        });

        if (isPartial) {
          autoTable(doc, {
            startY: doc.lastAutoTable.finalY + (isFourCopyLayout ? 2 : 3),
            head: [['#', 'Date du paiement', 'Montant payé']],
            body: paymentRows,
            theme: 'grid',
            margin: tableMargin,
            headStyles: { fillColor: [37, 99, 235], textColor: 255, fontStyle: 'bold', fontSize: isFourCopyLayout ? 5.5 : 6.5, minCellHeight: isFourCopyLayout ? 4 : 5 },
            styles: { fontSize: isFourCopyLayout ? 5.5 : 6.5, cellPadding: isFourCopyLayout ? 0.8 : 1, minCellHeight: isFourCopyLayout ? 4 : 5, lineColor: [229, 231, 235], lineWidth: 0.2 },
            columnStyles: {
              0: { cellWidth: 12, halign: 'center' },
              1: { cellWidth: 73 },
              2: { cellWidth: 47, halign: 'right' },
            },
          });
        }

        const totalsY = doc.lastAutoTable.finalY + 4;
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(copyRight - 60, totalsY, 60, isFourCopyLayout ? 11 : 14, 3, 3, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isFourCopyLayout ? 6 : 7);
        doc.setTextColor(107, 114, 128);
        doc.text('Prix total', copyRight - 56, totalsY + (isFourCopyLayout ? 4 : 5));
        doc.text('Total payé', copyRight - 56, totalsY + (isFourCopyLayout ? 9 : 11));
        doc.setDrawColor(156, 163, 175);
        doc.line(copyRight - 30, totalsY + (isFourCopyLayout ? 4 : 5), copyRight - 4, totalsY + (isFourCopyLayout ? 4 : 5));
        doc.line(copyRight - 30, totalsY + (isFourCopyLayout ? 9 : 11), copyRight - 4, totalsY + (isFourCopyLayout ? 9 : 11));

        const signatureBottomOffset = isPartial ? (isFourCopyLayout ? 10 : 10) : (isFourCopyLayout ? 14 : 18);
        const signatureY = Math.min(totalsY + (isFourCopyLayout ? 15 : 20), offsetY + copyHeight - signatureBottomOffset);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(isFourCopyLayout ? 6 : 7);
        doc.setTextColor(55, 65, 81);
        doc.text('Signature acheteur', copyLeft, signatureY);
        doc.text('Signature boutique', copyRight - 46, signatureY);
        doc.setDrawColor(156, 163, 175);
        doc.line(copyLeft, signatureY + (isFourCopyLayout ? 6 : 8), copyLeft + 46, signatureY + (isFourCopyLayout ? 6 : 8));
        doc.line(copyRight - 46, signatureY + (isFourCopyLayout ? 6 : 8), copyRight, signatureY + (isFourCopyLayout ? 6 : 8));

        if (!isPartial) {
          doc.setFontSize(6.5);
          doc.setTextColor(107, 114, 128);
          doc.text(`Document généré le ${formatDocumentDate(new Date())}`, copyLeft, footerY);
          doc.text(copyLabel, copyRight, footerY, { align: 'right' });
        }
      };

      const copyLabels = isFourCopyLayout
        ? ['Copie boutique', 'Copie client', 'Copie boutique', 'Copie client']
        : ['Copie boutique', 'Copie client'];
      copyLabels.forEach((copyLabel, index) => {
        drawCopy(copyLabel, index);
      });

      doc.save(`modele_facture_${fileLabel}_${sanitizeFilename(companyName)}.pdf`);
      toast.success(successLabel);
    } catch (error) {
      console.error('Sale invoice template PDF error:', error);
      toast.error(errorLabel);
    } finally {
      setGenerating(false);
    }
  };

  const handleGeneratePartialInvoicePdf = () => handleGenerateSaleInvoiceTemplatePdf({
    variant: 'partial',
    productRowsCount: partialInvoiceProductRows,
    paymentRowsCount: partialInvoicePaymentRows,
    copyCount: partialInvoiceCopies,
    setGenerating: setGeneratingPartialInvoice,
  });

  const handleGenerateFinalInvoicePdf = () => handleGenerateSaleInvoiceTemplatePdf({
    variant: 'final',
    productRowsCount: finalInvoiceProductRows,
    copyCount: finalInvoiceCopies,
    setGenerating: setGeneratingFinalInvoice,
  });

  const activeTabConfig = TABS.find((t) => t.key === activeTab);

  const availableSections = SETTINGS_SECTIONS.filter((s) => isAdmin || !s.adminOnly);
  const hasSectionNav = availableSections.length > 1;

  const renderSectionButton = (section, variant) => {
    const Icon = section.icon;
    const active = activeSection === section.key;
    if (variant === 'mobile') {
      return (
        <button
          key={section.key}
          type="button"
          onClick={() => setActiveSection(section.key)}
          aria-current={active ? 'page' : undefined}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition-colors ${
            active
              ? 'border-[var(--ms-blue)] bg-[var(--ms-blue)] text-white'
              : 'border-[var(--ms-border)] bg-[var(--ms-white)] text-[var(--ms-text-muted)]'
          }`}
        >
          <Icon className="h-4 w-4" />
          {section.label}
        </button>
      );
    }
    return (
      <button
        key={section.key}
        type="button"
        onClick={() => setActiveSection(section.key)}
        aria-current={active ? 'page' : undefined}
        className={`flex w-full items-center gap-2.5 rounded-[var(--radiusMedium)] px-3 py-2.5 text-left text-sm font-medium transition-colors ${
          active
            ? 'bg-[var(--ms-blue-soft)] text-[var(--colorBrandForeground1)]'
            : 'text-[var(--ms-text)] hover:bg-[var(--colorNeutralBackground2)]'
        }`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{section.label}</span>
      </button>
    );
  };

  return (
    <Workspace className="space-y-5">
      <PageHeader
        eyebrow="Configuration"
        title="Paramètres"
        description="Personnalisez l'identité de la boutique et gérez vos listes de référence."
      />

      {/* Sélecteur de section — pastilles défilables (mobile) */}
      {hasSectionNav && (
        <div className="lg:hidden -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: 'none' }}>
          {availableSections.map((s) => renderSectionButton(s, 'mobile'))}
        </div>
      )}

      <div className={hasSectionNav ? 'lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-6 lg:items-start' : ''}>
        {/* Barre latérale (desktop) */}
        {hasSectionNav && (
          <nav className="hidden lg:flex lg:flex-col lg:gap-1 fluent-card-filled self-start p-2 lg:sticky lg:top-[72px]" aria-label="Sections des paramètres">
            {availableSections.map((s) => renderSectionButton(s, 'desktop'))}
          </nav>
        )}

        {/* Contenu de la section active */}
        <div className="min-w-0 space-y-5">

      {isAdmin && activeSection === 'abonnement' && myTenant && (() => {
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

      {isAdmin && activeSection === 'identite' && (
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

      {isAdmin && activeSection === 'preferences' && (
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

      {isAdmin && activeSection === 'documents' && (
        <section className="fluent-card-filled p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' }}>
                <FileSpreadsheet className="h-5 w-5" />
              </span>
              <div>
                <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Modèle import produits</h2>
                <p className="fui-caption1 mt-0.5 max-w-2xl" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Téléchargez un fichier Excel prêt pour l'import des produits, avec les colonnes compatibles et un guide des alias acceptés.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDownloadProductImportTemplate}
              className="ms-button ms-button-primary ms-button-md w-full justify-center md:w-auto"
            >
              <FileDown className="h-4 w-4" />
              Télécharger modèle Excel
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {['Colonnes compatibles import', 'Feuille guide incluse', 'Colonne image pour URL photo'].map((item) => (
              <div key={item} className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--colorNeutralBackground2)] px-3 py-2.5 fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                <Check className="mr-2 inline h-3.5 w-3.5" style={{ color: 'var(--colorStatusSuccessForeground1)' }} />
                {item}
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && activeSection === 'documents' && (
        <section className="fluent-card-filled p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                <Printer className="h-5 w-5" />
              </span>
              <div>
                <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Fiche ventes papier</h2>
                <p className="fui-caption1 mt-0.5 max-w-2xl" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Générez un PDF par période avec une page par jour pour les employés qui notent les ventes et les paiements sur papier avant remise à l'administrateur.
                </p>
              </div>
            </div>
            <span className="fui-caption1 max-w-sm rounded-[var(--radiusMedium)] px-3 py-2 leading-relaxed" style={{ background: 'var(--colorNeutralBackground2)', color: 'var(--colorNeutralForeground3)' }}>
              Format du N : boutique-signe-date-numéro. Réutilisez le même N pour relier les paiements partiels.
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_1fr_130px_130px_170px_auto] xl:items-end">
            <BrandingField label="Date début" description="Première journée à imprimer.">
              <input
                type="date"
                value={saleSheetStartDate}
                onChange={(event) => setSaleSheetStartDate(event.target.value)}
                className={settingInputClass}
              />
            </BrandingField>

            <BrandingField label="Date fin" description="Dernière journée à imprimer.">
              <input
                type="date"
                value={saleSheetEndDate}
                onChange={(event) => setSaleSheetEndDate(event.target.value)}
                className={settingInputClass}
              />
            </BrandingField>

            <BrandingField label="Employé" description="Choisissez un employé existant ou saisissez le nom exact à imprimer.">
              <input
                type="text"
                list="daily-sales-employees"
                value={saleSheetEmployeeName}
                onChange={(event) => setSaleSheetEmployeeName(event.target.value)}
                className={settingInputClass}
                placeholder="Nom de l'employé"
              />
              <datalist id="daily-sales-employees">
                {employees.map((employee) => (
                  <option key={employee._id || employee.name} value={employee.name || employee.email || ''} />
                ))}
              </datalist>
            </BrandingField>

            <BrandingField label="Signe employé" description="Court code dans le N, ex. JM.">
              <input
                type="text"
                value={saleSheetEmployeeSign}
                onChange={(event) => setSaleSheetEmployeeSign(normalizeSaleReferenceSign(event.target.value))}
                className={settingInputClass}
                placeholder={buildSaleEmployeeSign(saleSheetEmployeeName)}
              />
            </BrandingField>

            <BrandingField label="Préfixe N" description="Code boutique au début de chaque référence.">
              <input
                type="text"
                value={saleSheetReferencePrefix}
                onChange={(event) => setSaleSheetReferencePrefix(normalizeSaleReferencePrefix(event.target.value))}
                className={settingInputClass}
                placeholder={buildSaleReferencePrefix(appSettings?.branding)}
              />
            </BrandingField>

            <BrandingField label="Lignes par jour" description="Entre 6 et 20 lignes.">
              <input
                type="number"
                min="6"
                max="20"
                value={saleSheetRowsPerDay}
                onChange={(event) => setSaleSheetRowsPerDay(event.target.value)}
                className={settingInputClass}
              />
            </BrandingField>

            <button
              type="button"
              onClick={handleGenerateDailySalesPdf}
              disabled={generatingSalesSheet}
              className="ms-button ms-button-primary ms-button-md w-full justify-center disabled:opacity-60 lg:mb-0"
            >
              <FileDown className="h-4 w-4" />
              {generatingSalesSheet ? 'Génération...' : 'Télécharger PDF'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {['N codé boutique + employé', 'Même N pour paiements liés', 'Montant payé à chaque passage'].map((item) => (
              <div key={item} className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--colorNeutralBackground2)] px-3 py-2.5 fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                <Check className="mr-2 inline h-3.5 w-3.5" style={{ color: 'var(--colorStatusSuccessForeground1)' }} />
                {item}
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && activeSection === 'documents' && (
        <section className="fluent-card-filled p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)' }}>
                <CreditCard className="h-5 w-5" />
              </span>
              <div>
                <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Facture vente partielle</h2>
                <p className="fui-caption1 mt-0.5 max-w-2xl" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Téléchargez un modèle papier à remplir par le vendeur pour une vente partiellement payée.
                </p>
              </div>
            </div>
            <span className="fui-caption1 max-w-sm rounded-[var(--radiusMedium)] px-3 py-2 leading-relaxed" style={{ background: 'var(--colorNeutralBackground2)', color: 'var(--colorNeutralForeground3)' }}>
              Le PDF imprime la copie boutique et la copie acheteur côte à côte sur une seule page, sans utiliser les données enregistrées dans l'application.
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_1fr_180px_auto] md:items-end">
            <BrandingField
              label="Lignes produits"
              description={partialInvoiceCopies === 4 ? 'Produits + paiements = maximum 6 lignes.' : 'Maximum 10 lignes avec les deux copies côte à côte.'}
            >
              <input
                type="number"
                min="1"
                max={partialInvoiceCopies === 4 ? String(Math.max(6 - (Number(partialInvoicePaymentRows) || 1), 1)) : '10'}
                value={partialInvoiceProductRows}
                onChange={(event) => {
                  if (partialInvoiceCopies === 4) {
                    const paymentRows = Math.min(Math.max(Number(partialInvoicePaymentRows) || 1, 1), 5);
                    const nextProductRows = Math.min(Math.max(Number(event.target.value) || 1, 1), Math.max(6 - paymentRows, 1));
                    setPartialInvoiceProductRows(nextProductRows);
                    return;
                  }
                  setPartialInvoiceProductRows(event.target.value);
                }}
                className={settingInputClass}
              />
            </BrandingField>

            <BrandingField
              label="Lignes paiements"
              description={partialInvoiceCopies === 4 ? 'Utilise les lignes restantes du total de 6.' : 'Maximum 8 paiements liés au même N.'}
            >
              <input
                type="number"
                min="1"
                max={partialInvoiceCopies === 4 ? String(Math.max(6 - (Number(partialInvoiceProductRows) || 1), 1)) : '8'}
                value={partialInvoicePaymentRows}
                onChange={(event) => {
                  if (partialInvoiceCopies === 4) {
                    const productRows = Math.min(Math.max(Number(partialInvoiceProductRows) || 1, 1), 5);
                    const nextPaymentRows = Math.min(Math.max(Number(event.target.value) || 1, 1), Math.max(6 - productRows, 1));
                    setPartialInvoicePaymentRows(nextPaymentRows);
                    return;
                  }
                  setPartialInvoicePaymentRows(event.target.value);
                }}
                className={settingInputClass}
              />
            </BrandingField>

            <BrandingField label="Nombre de copies" description="2 copies ou 4 copies sur une page A4.">
              <select
                value={partialInvoiceCopies}
                onChange={(event) => {
                  const nextCopyCount = Number(event.target.value);
                  setPartialInvoiceCopies(nextCopyCount);
                  if (nextCopyCount === 4) {
                    const productRows = Math.min(Math.max(Number(partialInvoiceProductRows) || 3, 1), 5);
                    const paymentRows = Math.min(Math.max(Number(partialInvoicePaymentRows) || 3, 1), Math.max(6 - productRows, 1));
                    setPartialInvoiceProductRows(Math.min(productRows, 6 - paymentRows));
                    setPartialInvoicePaymentRows(paymentRows);
                  }
                }}
                className={settingInputClass}
              >
                <option value={2}>2 copies</option>
                <option value={4}>4 copies</option>
              </select>
            </BrandingField>

            <button
              type="button"
              onClick={handleGeneratePartialInvoicePdf}
              disabled={generatingPartialInvoice}
              className="ms-button ms-button-primary ms-button-md w-full justify-center disabled:opacity-60 lg:mb-0"
            >
              <FileDown className="h-4 w-4" />
              {generatingPartialInvoice ? 'Génération...' : 'Télécharger PDF'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {['Copies côte à côte', 'Champs à remplir par le vendeur', 'Aucun mode ni solde restant'].map((item) => (
              <div key={item} className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--colorNeutralBackground2)] px-3 py-2.5 fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                <Check className="mr-2 inline h-3.5 w-3.5" style={{ color: 'var(--colorStatusSuccessForeground1)' }} />
                {item}
              </div>
            ))}
          </div>
        </section>
      )}

      {isAdmin && activeSection === 'documents' && (
        <section className="fluent-card-filled p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' }}>
                <Receipt className="h-5 w-5" />
              </span>
              <div>
                <h2 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Facture vente finale</h2>
                <p className="fui-caption1 mt-0.5 max-w-2xl" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Téléchargez un modèle papier pour une vente payée en totalité, à remplir par le vendeur.
                </p>
              </div>
            </div>
            <span className="fui-caption1 max-w-sm rounded-[var(--radiusMedium)] px-3 py-2 leading-relaxed" style={{ background: 'var(--colorNeutralBackground2)', color: 'var(--colorNeutralForeground3)' }}>
              Le PDF imprime la copie boutique et la copie acheteur côte à côte sur une seule page.
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
            <BrandingField
              label="Lignes produits"
              description={finalInvoiceCopies === 4 ? 'Maximum 4 lignes pour garder les 4 copies sur une page.' : 'Maximum 12 lignes avec les deux copies côte à côte.'}
            >
              <input
                type="number"
                min="1"
                max={finalInvoiceCopies === 4 ? '4' : '12'}
                value={finalInvoiceProductRows}
                onChange={(event) => setFinalInvoiceProductRows(event.target.value)}
                className={settingInputClass}
              />
            </BrandingField>

            <BrandingField label="Nombre de copies" description="2 copies ou 4 copies sur une page A4.">
              <select
                value={finalInvoiceCopies}
                onChange={(event) => {
                  const nextCopyCount = Number(event.target.value);
                  setFinalInvoiceCopies(nextCopyCount);
                  if (nextCopyCount === 4) {
                    setFinalInvoiceProductRows((current) => Math.min(Number(current) || 4, 4));
                  }
                }}
                className={settingInputClass}
              >
                <option value={2}>2 copies</option>
                <option value={4}>4 copies</option>
              </select>
            </BrandingField>

            <button
              type="button"
              onClick={handleGenerateFinalInvoicePdf}
              disabled={generatingFinalInvoice}
              className="ms-button ms-button-primary ms-button-md w-full justify-center disabled:opacity-60 lg:mb-0"
            >
              <FileDown className="h-4 w-4" />
              {generatingFinalInvoice ? 'Génération...' : 'Télécharger PDF'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {['Copies côte à côte', 'Vente finale à remplir', 'Aucun solde restant'].map((item) => (
              <div key={item} className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--colorNeutralBackground2)] px-3 py-2.5 fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                <Check className="mr-2 inline h-3.5 w-3.5" style={{ color: 'var(--colorStatusSuccessForeground1)' }} />
                {item}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Listes de référence */}
      {activeSection === 'listes' && (
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
      )}
        </div>
      </div>
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
