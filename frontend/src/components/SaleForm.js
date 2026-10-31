import React, { useState, useEffect, useContext, useMemo, useRef, lazy, Suspense } from 'react';
import PropTypes from 'prop-types';
import toast from 'react-hot-toast';
import { ArrowRight as ArrowRightIcon, CheckCircle2 as CheckCircle2Icon, ScanLine, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { getCompanyIdentity } from '../utils/appBranding';
import { generateProformaPdf } from '../utils/proformaPdf';
import { getSaleTypeText } from '../utils/saleUtils';
import { useFeature } from './FeatureGate';
import { saleDraftKey, readSaleDraft, hasSaleDraftContent, SALE_DRAFT_VERSION } from '../utils/saleDraft';
import { FEATURE_KEYS } from '../config/features';

const ProductQrScanner = lazy(() => import('./ProductQrScanner'));
const ExportSalesPdf = lazy(() => import('./ExportSalesPdf'));

// Extract a product id from a scanned QR value (sell URL, product URL, or raw id).
const parseScannedProductId = (text) => {
  if (!text) return '';
  const byAdd = String(text).match(/[?&]addProduct=([a-f\d]{24})/i);
  if (byAdd) return byAdd[1];
  const byPath = String(text).match(/\/products\/([a-f\d]{24})/i);
  if (byPath) return byPath[1];
  const raw = String(text).trim().match(/^[a-f\d]{24}$/i);
  if (raw) return raw[0];
  return '';
};

const normalizeCollection = (value, nestedKeys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of nestedKeys) {
    if (Array.isArray(value?.[key])) {
      return value[key];
    }
  }
  return [];
};

// Libellés des boutons "Continuer" par étape — source unique partagée avec
// tout conteneur qui rend son propre bouton de progression (ex:
// GlobalSaleModal, qui rend SaleForm avec hideSubmit). Mode vente uniquement :
// hideSubmit masque aussi le bascule vente/proforma (voir plus bas), donc ce
// conteneur ne voit jamais documentMode === 'proforma'.
export const SALE_STAGE_CONTINUE_LABELS = [
  'Continuer vers les produits',
  'Continuer vers le paiement',
  'Vérifier la vente',
];

const SaleFormFields = ({
  clients = [],
  products: initialProducts = [],
  onSubmit,
  onProformaCreated,
  formId = 'sale-form',
  hideSubmit = false,
  initialProductId = '',
  draftKey = '',
  documentMode,
  setDocumentMode,
  onStageChange,
}) => {
  const { auth } = useContext(AuthContext);
  const { appSettings } = useAppSettings();
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const manualSaleDateEnabled = isAdmin && Boolean(auth?.user?.adminPreferences?.manualSaleDateEnabled);
  const safeClients = useMemo(() => normalizeCollection(clients, ['clients', 'data']), [clients]);
  const normalizedInitialProducts = useMemo(
    () => normalizeCollection(initialProducts, ['products', 'data']),
    [initialProducts]
  );
  const [products, setProducts] = useState(normalizedInitialProducts);
  const [selectedProducts, setSelectedProducts] = useState([{ product: '', quantity: '', price: 0 }]);
  const [services, setServices] = useState([]);
  const [selectedServices, setSelectedServices] = useState([{ service: '', quantity: 1, price: 0 }]);
  const [serviceErrors, setServiceErrors] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [saleType, setSaleType] = useState('normal');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState(0);
  const [promoCode, setPromoCode] = useState('');
  const [promoApplied, setPromoApplied] = useState(null); // { code, label, type, value }
  const [promoApplying, setPromoApplying] = useState(false);
  const [errors, setErrors] = useState([]);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [note, setNote] = useState('');
  const [saleDate, setSaleDate] = useState('');
  const [setReminder, setSetReminder] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [reminderNote, setReminderNote] = useState('');
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [productSearchTerms, setProductSearchTerms] = useState(['']);
  const [markAsDelivered, setMarkAsDelivered] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanMode, setScanMode] = useState('qr'); // 'qr' | 'barcode'
  const canProforma = useFeature(FEATURE_KEYS.PROFORMA);
  const [validUntil, setValidUntil] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 15);
    return date.toISOString().slice(0, 10);
  });
  const [draftReady, setDraftReady] = useState(false);
  const [pendingDraft, setPendingDraft] = useState(null);
  const [draftNotice, setDraftNotice] = useState('');
  const [draftStorageError, setDraftStorageError] = useState(false);
  const [activeStage, setActiveStage] = useState(0);
  const [completedSale, setCompletedSale] = useState(null);
  const submitLock = useRef(false);
  const stageVisited = useRef(false);

  useEffect(() => {
    try {
      const draft = readSaleDraft(window.localStorage, draftKey);
      setPendingDraft(draft);
      setDraftReady(!draft);
    } catch {
      setDraftStorageError(true);
      setDraftReady(true);
    }
  }, [draftKey]);

  const resumeDraft = () => {
    const draft = pendingDraft;
    if (!draft) return;
    const missingClient = draft.selectedClient && !safeClients.some(client => client._id === draft.selectedClient);
    const missingProduct = draft.selectedProducts.some(line => line.product && !products.some(product => product._id === line.product));
    if (missingClient || missingProduct) {
      setDraftNotice('Certains clients ou produits ne sont plus disponibles. Sélectionnez-les de nouveau avant l’enregistrement.');
    } else {
      setDraftNotice('Brouillon repris. Vérifiez les prix, le stock et le paiement avant d’enregistrer.');
    }
    setSelectedClient(missingClient ? '' : draft.selectedClient);
    setSelectedProducts(draft.selectedProducts.length ? draft.selectedProducts.map(line => ({ ...line, product: products.some(product => product._id === line.product) ? line.product : '' })) : [{ product: '', quantity: '', price: 0 }]);
    setSelectedServices(Array.isArray(draft.selectedServices) && draft.selectedServices.length ? draft.selectedServices.map(line => ({ ...line, service: services.some(service => service._id === line.service) ? line.service : '' })) : [{ service: '', quantity: 1, price: 0 }]);
    setSaleType(draft.saleType || 'normal');
    setPaymentMethod(draft.paymentMethod || 'cash');
    setPaymentAmount(draft.paymentAmount ?? '');
    setNote(draft.note || '');
    setSaleDate(draft.saleDate || '');
    setSetReminder(Boolean(draft.setReminder));
    setReminderDate(draft.reminderDate || '');
    setReminderNote(draft.reminderNote || '');
    setMarkAsDelivered(Boolean(draft.markAsDelivered));
    if (draft.validUntil) setValidUntil(draft.validUntil);
    setPendingDraft(null);
    setDraftReady(true);
  };
  const discardDraft = () => {
    try { if (draftKey) window.localStorage.removeItem(draftKey); } catch { setDraftStorageError(true); }
    setPendingDraft(null);
    setDraftReady(true);
    setDraftNotice('Brouillon supprimé. Vous pouvez commencer un nouveau document.');
  };

  useEffect(() => {
    if (!draftReady) return;
    if (!draftKey) { setDraftStorageError(true); return; }
    const draft = {
      version: SALE_DRAFT_VERSION, updatedAt: new Date().toISOString(),
      selectedClient, selectedProducts, selectedServices, saleType, paymentMethod, paymentAmount, note,
      saleDate, setReminder, reminderDate, reminderNote, markAsDelivered, validUntil,
    };
    try {
      if (hasSaleDraftContent(draft)) {
        window.localStorage.setItem(draftKey, JSON.stringify(draft));
        setDraftStorageError(false);
      } else window.localStorage.removeItem(draftKey);
    } catch { setDraftStorageError(true); }
  }, [draftReady, draftKey, selectedClient, selectedProducts, selectedServices, saleType, paymentMethod, paymentAmount, note, saleDate, setReminder, reminderDate, reminderNote, markAsDelivered, validUntil]);


	
  useEffect(() => {
    if (normalizedInitialProducts.length > 0) {
      setProducts(normalizedInitialProducts);
    }
  }, [normalizedInitialProducts]);

  /** Fetch products **/
  useEffect(() => {
    if (normalizedInitialProducts.length > 0) {
      return undefined;
    }

    const fetchProducts = async () => {
      try {
        const res = await api.get('/products');
        setProducts(normalizeCollection(res.data, ['products', 'data']));
      } catch {
        setFormError('Impossible de charger les produits.');
      }
    };
    fetchProducts();
    return undefined;
  }, [normalizedInitialProducts]);

  /** Fetch services (catalogue hors-stock) **/
  useEffect(() => {
    let active = true;
    Promise.resolve(api.get('/services'))
      .then((res) => {
        const list = Array.isArray(res?.data) ? res.data : [];
        if (active) setServices(list.filter((s) => s.active));
      })
      .catch(() => {
        // Service catalogue optional — a failure must not block product sales.
      });
    return () => { active = false; };
  }, []);

  /** Scan-to-sell: preselect the product passed via the QR/URL (once loaded) **/
  const appliedInitialProductRef = useRef(false);
  useEffect(() => {
    if (appliedInitialProductRef.current || !initialProductId) return;
    const prod = products.find((p) => p._id === initialProductId);
    if (!prod) return; // wait until the catalog has loaded
    appliedInitialProductRef.current = true;
    setSelectedProducts([{ product: prod._id, quantity: 1, price: prod.price || 0 }]);
    setProductSearchTerms(['']);
    setErrors([null]);
  }, [initialProductId, products]);

  /** Calculate total (produits + services) **/
  useEffect(() => {
    const productsTotal = selectedProducts.reduce((sum, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.price) || 0;
      return sum + q * p;
    }, 0);
    const servicesTotal = selectedServices.reduce((sum, item) => {
      const q = Number(item.quantity) || 0;
      const p = Number(item.price) || 0;
      return sum + q * p;
    }, 0);
    setTotalAmount(productsTotal + servicesTotal);
  }, [selectedProducts, selectedServices]);

  const normalizedPaymentAmount = Math.max(0, Number(paymentAmount) || 0);
  const promoDiscount = promoApplied
    ? Math.round(
        promoApplied.type === 'amount'
          ? Math.min(promoApplied.value, totalAmount)
          : (totalAmount * promoApplied.value) / 100
      )
    : 0;
  const payableTotal = Math.max(0, totalAmount - promoDiscount);
  const remainingBalance = Math.max(0, payableTotal - normalizedPaymentAmount);
  const isFullyPaid = payableTotal > 0 && normalizedPaymentAmount === payableTotal;

  useEffect(() => {
    if (!isFullyPaid && markAsDelivered) {
      setMarkAsDelivered(false);
    }
  }, [isFullyPaid, markAsDelivered]);

  useEffect(() => {
    if (isFullyPaid && setReminder) {
      setSetReminder(false);
      setReminderDate('');
      setReminderNote('');
    }
  }, [isFullyPaid, setReminder]);

  /** Filter clients & products **/
  const filteredClients = safeClients.filter(c =>
    c.name.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );
  const getFilteredProducts = (term, selectedProductId = '') =>
    products.filter((product) => {
      const matchesSearch = (product.name || '').toLowerCase().includes(term.toLowerCase());
      const hasStock = Number(product.stock) > 0;
      const isCurrentSelection = product._id === selectedProductId;
      return matchesSearch && (hasStock || isCurrentSelection);
    });

  /** Validation **/
  const validatePrices = () => {
    // Totalise les quantités par produit : plusieurs lignes du même produit ne
    // doivent pas dépasser le stock global (le backend les agrège).
    const totals = new Map();
    selectedProducts.forEach((item) => {
      if (!item.product) return;
      totals.set(item.product, (totals.get(item.product) || 0) + (Number(item.quantity) || 0));
    });
    const newErrors = selectedProducts.map((item) => {
      if (!item.product) return 'Sélectionnez un produit';
      const product = products.find(p => p._id === item.product);
      if (!product) return 'Produit invalide';
      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) return 'Quantité invalide';
      if (totals.get(item.product) > Number(product.stock)) return `Stock insuffisant (${product.stock} disponibles au total)`;
      if (!Number.isFinite(Number(item.price)) || Number(item.price) < 0) return 'Prix invalide';
      if (item.price < product.costPrice) return `Prix trop bas (min: ${product.costPrice} CFA)`;
      return null;
    });
    setErrors(newErrors);
    return newErrors.every(e => !e);
  };

  const validateServices = () => {
    const newErrors = selectedServices.map((item) => {
      if (!item.service) return null; // ligne vide : ignorée
      const service = services.find(s => s._id === item.service);
      if (!service) return 'Service invalide';
      if (!Number.isFinite(Number(item.quantity)) || Number(item.quantity) <= 0) return 'Quantité invalide';
      if (!Number.isFinite(Number(item.price)) || Number(item.price) < 0) return 'Prix invalide';
      return null;
    });
    setServiceErrors(newErrors);
    return newErrors.every(e => !e);
  };

  /** Handlers **/
  const handleProductChange = (index, id) => {
    const newArr = [...selectedProducts];
    const product = products.find(p => p._id === id);
    newArr[index] = {
      product: id,
      quantity: newArr[index]?.quantity ?? '',
      price: product?.price || 0,
    };
    setSelectedProducts(newArr);
    setProductSearchTerms(prev => prev.map((t, i) => (i === index ? '' : t)));
  };

  const handleQuantityChange = (index, val) => {
    const newArr = [...selectedProducts];
    const q = parseInt(val, 10);
    newArr[index].quantity = Number.isNaN(q) ? '' : Math.max(1, q);
    setSelectedProducts(newArr);
  };

  const handlePriceChange = (index, val) => {
    const newArr = [...selectedProducts];
    newArr[index].price = Math.max(0, parseFloat(val) || 0);
    setSelectedProducts(newArr);
  };

  const addProduct = () => {
    setSelectedProducts([...selectedProducts, { product: '', quantity: '', price: 0 }]);
    setErrors([...errors, null]);
    setProductSearchTerms([...productSearchTerms, '']);
  };

  const handleServiceChange = (index, id) => {
    const newArr = [...selectedServices];
    const service = services.find(s => s._id === id);
    newArr[index] = {
      service: id,
      quantity: newArr[index]?.quantity ?? 1,
      price: service?.price ?? 0,
    };
    setSelectedServices(newArr);
  };

  const handleServiceQuantityChange = (index, val) => {
    const newArr = [...selectedServices];
    const q = parseInt(val, 10);
    newArr[index].quantity = Number.isNaN(q) ? 1 : Math.max(1, q);
    setSelectedServices(newArr);
  };

  const handleServicePriceChange = (index, val) => {
    const newArr = [...selectedServices];
    newArr[index].price = Math.max(0, parseFloat(val) || 0);
    setSelectedServices(newArr);
  };

  const addService = () => {
    setSelectedServices([...selectedServices, { service: '', quantity: 1, price: 0 }]);
    setServiceErrors([...serviceErrors, null]);
  };

  const removeService = (index) => {
    if (selectedServices.length > 1) {
      setSelectedServices(selectedServices.filter((_, i) => i !== index));
      setServiceErrors(serviceErrors.filter((_, i) => i !== index));
    }
  };

  // Add (or increment) a scanned/looked-up product on the sale lines.
  const addScannedProduct = (prod) => {
    const idx = selectedProducts.findIndex((l) => l.product === prod._id);
    if (idx >= 0) {
      const next = [...selectedProducts];
      next[idx] = { ...next[idx], quantity: (Number(next[idx].quantity) || 0) + 1 };
      setSelectedProducts(next);
      toast.success(`${prod.name} (+1)`);
      return;
    }

    const line = { product: prod._id, quantity: 1, price: prod.price || 0 };
    const emptyIdx = selectedProducts.findIndex((l) => !l.product);
    if (emptyIdx >= 0) {
      const next = [...selectedProducts];
      next[emptyIdx] = line;
      setSelectedProducts(next);
    } else {
      setSelectedProducts([...selectedProducts, line]);
      setProductSearchTerms([...productSearchTerms, '']);
      setErrors([...errors, null]);
    }
    toast.success(`${prod.name} ajouté`);
  };

  // QR / barcode scan → add the product to the form.
  const handleScannedProduct = async (text) => {
    const pid = parseScannedProductId(text);
    if (pid) {
      const prod = products.find((p) => p._id === pid);
      if (!prod) { toast.error('Produit introuvable dans le catalogue.'); return; }
      addScannedProduct(prod);
      return;
    }

    // Not a product id → treat as a barcode (EAN/UPC).
    const code = String(text || '').trim();
    if (!code) { toast.error('Code scanné non reconnu.'); return; }
    try {
      const { data } = await api.get('/products/by-barcode', { params: { code } });
      addScannedProduct(data);
    } catch (error) {
      if (error.response?.status === 404) {
        toast.error('Aucun produit avec ce code-barres.');
      } else {
        toast.error('Erreur de recherche du code-barres.');
      }
    }
  };

  const handleApplyPromo = async () => {
    const code = promoCode.trim();
    if (!code) return;
    setPromoApplying(true);
    try {
      const { data } = await api.post('/promotions/apply', { code, subtotal: totalAmount });
      setPromoApplied(data.promotion);
      toast.success(`Code ${data.promotion.code} appliqué`);
    } catch (error) {
      setPromoApplied(null);
      toast.error(error.response?.data?.message || 'Code promo invalide');
    } finally {
      setPromoApplying(false);
    }
  };

  const removeProduct = (index) => {
    if (selectedProducts.length > 1) {
      setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
      setErrors(errors.filter((_, i) => i !== index));
      setProductSearchTerms(productSearchTerms.filter((_, i) => i !== index));
    }
  };

  const resetForm = () => {
    setSelectedClient('');
    setSelectedProducts([{ product: '', quantity: '', price: 0 }]);
    setSelectedServices([{ service: '', quantity: 1, price: 0 }]);
    setServiceErrors([]);
    setSaleType('normal');
    setPaymentMethod('cash');
    setPaymentAmount('');
    setNote('');
    setSaleDate('');
    setSetReminder(false);
    setReminderDate('');
    setReminderNote('');
    setMarkAsDelivered(false);
    setTotalAmount(0);
    setPromoCode('');
    setPromoApplied(null);
    setActiveStage(0);
    setCompletedSale(null);
    setFormError('');
    try {
      if (draftKey && typeof window !== 'undefined') window.localStorage.removeItem(draftKey);
    } catch (error) {
      console.warn('Unable to clear sale draft', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current || !draftReady) return;
    if (activeStage < 3) {
      goToStage(activeStage + 1);
      return;
    }
    submitLock.current = true;
    setIsSubmitting(true);
    setFormError('');

    if (!safeClients.some(client => client._id === selectedClient)) {
      setFormError('Sélectionnez un client.');
      submitLock.current = false;
      setIsSubmitting(false);
      return;
    }
    if (!validatePrices() || !validateServices()) {
      setFormError('Corrigez les erreurs du formulaire.');
      submitLock.current = false;
      setIsSubmitting(false);
      return;
    }

    if (documentMode === 'proforma') {
      try {
        const client = safeClients.find((item) => item._id === selectedClient);
        const items = selectedProducts.map((item) => {
          const product = products.find((candidate) => candidate._id === item.product);
          return {
            name: product?.name || 'Produit',
            quantity: Number(item.quantity),
            price: Number(item.price),
          };
        });
        const { data: proforma } = await api.post('/proformas', {
          client: selectedClient,
          products: selectedProducts.map((item) => ({
            product: item.product,
            quantity: Number(item.quantity),
            price: Number(item.price),
          })),
          note,
          validUntil,
        });
        onProformaCreated?.(proforma);
        window.dispatchEvent(new CustomEvent('proformaCreated', { detail: proforma }));
        try {
          await generateProformaPdf({
            client: proforma.client || client || {},
            items: (proforma.products || items).map((item) => ({
              name: item.productName || item.name || item.product?.name || 'Produit',
              quantity: item.quantity,
              price: item.price,
            })),
            note: proforma.note,
            validUntil: proforma.validUntil,
            sellerName: auth?.user?.name || auth?.user?.email || '',
            company: getCompanyIdentity(appSettings.branding),
            reference: proforma.reference,
            issueDate: proforma.createdAt,
          });
        } catch (pdfError) {
          console.error('Unable to generate saved proforma PDF:', pdfError);
          setFormError('Proforma enregistrée, mais le téléchargement du PDF a échoué.');
        }
      } catch (error) {
        console.error('Unable to generate proforma PDF:', error);
        setFormError('Impossible de générer la facture proforma.');
      } finally {
        submitLock.current = false;
      setIsSubmitting(false);
      }
      return;
    }

    if (normalizedPaymentAmount > payableTotal) {
      setFormError('Le montant payé ne peut pas dépasser le total de la vente.');
      submitLock.current = false;
      setIsSubmitting(false);
      return;
    }

    try {
      const payload = {
        client: selectedClient,
        products: selectedProducts.filter(p => p.product).map(p => ({
          product: p.product,
          quantity: Number(p.quantity),
          price: Number(p.price),
        })),
        services: selectedServices.filter(s => s.service).map(s => ({
          service: s.service,
          quantity: Number(s.quantity),
          price: Number(s.price),
        })),
        saleType,
        paymentMethod,
        initialPaymentAmount: normalizedPaymentAmount,
        promotionCode: promoApplied?.code || undefined,
        markAsDelivered: isFullyPaid && markAsDelivered,
        note,
        saleDate: manualSaleDateEnabled && saleDate ? saleDate : undefined,
        reminderDate: setReminder && !isFullyPaid ? reminderDate : undefined,
        reminderNote: setReminder && !isFullyPaid ? reminderNote : undefined,
      };
      const result = await onSubmit(payload);
      resetForm();
      if (documentMode === 'sale') {
        const fallbackSale = {
          client: safeClients.find(client => client._id === selectedClient) || selectedClient,
          totalAmount,
          payments: normalizedPaymentAmount > 0 ? [{ amount: normalizedPaymentAmount }] : [],
        };
        setCompletedSale({ ...fallbackSale, ...(result || {}) });
      }
    } catch (error) {
      setFormError(
        error?.response?.data?.message ||
        'Erreur lors de la création de la vente.'
      );
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
  };

  const inputBase =
    'form-control text-gray-900 placeholder:text-gray-400';

  const sectionTitleClass = 'text-sm font-semibold text-[var(--ms-text)] uppercase tracking-[0.12em]';
  const workflowSteps = [
    { label: 'Client', complete: Boolean(selectedClient) },
    { label: 'Produits', complete: selectedProducts.some((item) => item.product && Number(item.quantity) > 0) || selectedServices.some((item) => item.service && Number(item.quantity) > 0) },
    { label: 'Paiement', complete: totalAmount > 0 && paymentAmount !== '' },
    { label: 'Confirmation', complete: false },
  ];
  useEffect(() => {
    onStageChange?.(activeStage);
    if (stageVisited.current) {
      const headingId = ['sale-form-client', 'sale-form-products', documentMode === 'proforma' ? 'proforma-validity' : 'sale-form-payment', 'sale-review-title'][activeStage];
      const heading = document.getElementById(headingId);
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    }
    stageVisited.current = true;
  }, [activeStage, documentMode, onStageChange]);

  const stageClass = (stage) => activeStage === stage ? '' : 'hidden';
  const goToStage = (nextStage) => {
    if (nextStage === 1 && !safeClients.some(client => client._id === selectedClient)) {
      setFormError('Sélectionnez un client avant de continuer.');
      return false;
    }
    if (nextStage >= 2 && !validatePrices()) {
      setFormError('Ajoutez un produit valide et corrigez les erreurs avant de continuer.');
      return false;
    }
    if (nextStage >= 3 && (totalAmount <= 0 || (documentMode === 'sale' && (paymentAmount === '' || normalizedPaymentAmount > totalAmount)))) {
      setFormError('Vérifiez le montant payé avant de continuer.');
      return false;
    }
    setFormError('');
    setActiveStage(Math.max(0, Math.min(3, nextStage)));
    return true;
  };

  /** UI **/
  if (completedSale) {
    const saleId = completedSale._id || completedSale.id;
    const clientName = typeof completedSale.client === 'object' ? completedSale.client?.name : safeClients.find(client => client._id === completedSale.client)?.name;
    const saleTotal = Number(completedSale.totalAmount ?? completedSale.total ?? totalAmount) || 0;
    const paid = Array.isArray(completedSale.payments)
      ? completedSale.payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0)
      : Number(completedSale.paidAmount ?? normalizedPaymentAmount) || 0;
    const balance = Math.max(0, saleTotal - paid);
    return (
      <section className="space-y-5" aria-labelledby="sale-complete-title" role="status">
        <header className="border-b border-[var(--ms-border)] pb-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--colorStatusSuccessBackground1)] text-[var(--colorStatusSuccessForeground1)]"><CheckCircle2Icon aria-hidden="true" /></span>
            <div className="min-w-0">
              <h3 id="sale-complete-title" className="text-lg font-semibold text-[var(--ms-text-strong)]">Vente enregistrée</h3>
              <p className="mt-1 text-sm text-[var(--ms-text-muted)]">{clientName ? `La vente de ${clientName} est enregistrée.` : 'La vente est enregistrée.'} {saleId ? `Référence : ${saleId}` : ''}</p>
            </div>
          </div>
        </header>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-md border border-[var(--ms-border)] p-3"><dt className="text-xs text-[var(--ms-text-muted)]">Total</dt><dd className="mt-1 font-semibold tabular-nums">{saleTotal.toLocaleString('fr-FR')} CFA</dd></div>
          <div className="rounded-md border border-[var(--ms-border)] p-3"><dt className="text-xs text-[var(--ms-text-muted)]">Encaissé</dt><dd className="mt-1 font-semibold tabular-nums">{paid.toLocaleString('fr-FR')} CFA</dd></div>
          <div className="col-span-2 rounded-md border border-[var(--ms-border)] p-3 sm:col-span-1"><dt className="text-xs text-[var(--ms-text-muted)]">À suivre</dt><dd className="mt-1 font-semibold tabular-nums">{balance > 0 ? `${balance.toLocaleString('fr-FR')} CFA à encaisser` : markAsDelivered ? 'Livraison confirmée' : 'Paiement complet'}</dd></div>
        </dl>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-[var(--ms-text)]">Prochaine étape</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {saleId && <Link to={`/sales/${saleId}`} className="ms-button ms-button-primary min-h-[44px]">{balance > 0 ? 'Ouvrir pour encaisser' : 'Ouvrir le suivi de livraison'} <ArrowRightIcon size={16} /></Link>}
            {saleId && <Suspense fallback={<span role="status" className="inline-flex min-h-[44px] items-center px-3 text-sm">Préparation de la facture…</span>}><ExportSalesPdf sale={completedSale} buttonClassName="ms-button ms-button-secondary min-h-[44px]" /></Suspense>}
            <Link to="/sales?workspace=history" className="ms-button ms-button-secondary min-h-[44px]">Voir les ventes</Link>
            <button type="button" className="ms-button ms-button-secondary min-h-[44px]" onClick={() => { resetForm(); setDraftReady(true); }}>Enregistrer une autre vente</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form
      id={formId}
      onSubmit={handleSubmit}
      className="form-shell"
    >
      {pendingDraft && <section className="p-4 space-y-3" aria-label="Brouillon disponible">
        <p className="fui-body1">Un brouillon de cette boutique est disponible, enregistré le {new Date(pendingDraft.updatedAt).toLocaleString('fr-FR')}.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="ms-button ms-button-primary ms-button-md min-h-[44px]" onClick={resumeDraft}>Reprendre le brouillon</button>
          <button type="button" className="ms-button ms-button-secondary ms-button-md min-h-[44px]" onClick={discardDraft}>Supprimer le brouillon</button>
        </div>
      </section>}
      {draftNotice && <p role="status" className="p-4 text-sm">{draftNotice}</p>}
      {draftStorageError && <p role="alert" className="p-4 text-sm">Le brouillon ne peut pas être enregistré sur cet appareil. Gardez ce formulaire ouvert pour conserver votre saisie.</p>}
      <fieldset disabled={!draftReady || isSubmitting} className="min-w-0">
      {/* Header */}
      <div className="border-b border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-5 py-4 sm:px-6 sm:py-5">
        <h3 className="text-lg font-semibold text-[var(--ms-text-strong)]">
          {documentMode === 'sale' ? 'Nouvelle vente' : 'Facture proforma'}
        </h3>
        <p className="text-sm text-[var(--ms-text-muted)] mt-0.5">
          {documentMode === 'sale'
            ? 'Renseignez le client, les produits et le paiement.'
            : 'Préparez une proposition commerciale sans enregistrer de vente.'}
        </p>
        {
          <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Progression de la vente">
            {workflowSteps.map((originalStep, index) => {
              const step = documentMode === 'proforma' ? { ...originalStep, label: ['Client', 'Produits', 'Validité', 'Confirmation'][index], complete: index < activeStage } : originalStep;
              const isActive = index === activeStage;
              return (
                <li key={step.label} className="min-w-0">
                  <button type="button" onClick={() => index <= activeStage && goToStage(index)} className={`flex w-full min-h-[42px] items-center gap-1.5 rounded-[var(--radiusMedium)] border px-2 py-1.5 text-left ${step.complete ? 'border-[var(--colorStatusSuccessStroke1)] bg-[var(--colorStatusSuccessBackground1)]' : isActive ? 'border-[var(--colorBrandStroke1)] bg-[var(--ms-blue-soft)]' : 'border-[var(--ms-border)] bg-[var(--ms-white)]'}`} aria-current={activeStage === index ? 'step' : undefined}>
                    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${step.complete ? 'bg-[var(--colorStatusSuccessForeground1)] text-white' : isActive ? 'bg-[var(--ms-blue)] text-white' : 'bg-[var(--colorNeutralBackground3)] text-[var(--colorNeutralForeground3)]'}`}>
                      {step.complete ? '✓' : index + 1}
                    </span>
                    <span className="truncate text-[11px] font-semibold" style={{ color: step.complete ? 'var(--colorStatusSuccessForeground1)' : isActive ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralForeground3)' }}>{step.label}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        }
        {!hideSubmit && canProforma && <div className="mt-4 grid grid-cols-2 gap-1 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--colorNeutralBackground2)] p-1">
          {[
            { key: 'sale', label: 'Vente' },
            { key: 'proforma', label: 'Proforma' },
          ].map((mode) => (
            <button
              key={mode.key}
              type="button"
              onClick={() => {
                setDocumentMode(mode.key);
                setFormError('');
              }}
              className={`min-h-[40px] rounded-[var(--radiusMedium)] text-sm font-semibold transition-colors ${
                documentMode === mode.key
                  ? 'bg-[var(--ms-blue)] text-white shadow-[var(--ms-shadow-sm)]'
                  : 'text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>}
      </div>

      <div className="p-5 sm:p-6 space-y-8">
        {/* CLIENT */}
        <section className={`${stageClass(0)} space-y-3`} aria-labelledby="sale-form-client">
          <h4 id="sale-form-client" tabIndex={-1} className={sectionTitleClass}>
            Client
          </h4>
          <div className="form-panel p-4 space-y-3">
            <input
              type="text"
              placeholder="Rechercher un client…"
              className={inputBase}
              value={clientSearchTerm}
              onChange={(e) => setClientSearchTerm(e.target.value)}
              aria-label="Rechercher un client"
            />
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className={inputBase}
              required
              aria-label="Sélectionner un client"
            >
              <option value="">Sélectionner un client…</option>
              {filteredClients.map(c => (
                <option key={c._id} value={c._id}>{c.name}</option>
              ))}
            </select>
            {safeClients.length === 0 && (
              <p className="text-sm text-[var(--ms-warning)]">Aucun client disponible.</p>
            )}
          </div>
        </section>

        {activeStage === 0 && <div className="flex justify-end"><button type="button" className="ms-button ms-button-primary min-h-[44px]" onClick={() => goToStage(1)}>{SALE_STAGE_CONTINUE_LABELS[0]} <ArrowRightIcon /></button></div>}

        {/* PRODUCTS */}
        <section className={`${stageClass(1)} space-y-4`} aria-labelledby="sale-form-products">
          <div className="flex items-center justify-between gap-2">
            <h4 id="sale-form-products" tabIndex={-1} className={sectionTitleClass}>
              Produits
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--ms-text-muted)]">{selectedProducts.length} ligne(s)</span>
              <button
                type="button"
                onClick={() => setShowScanner((v) => !v)}
                className={`inline-flex min-h-[32px] items-center gap-1.5 rounded-[var(--radiusMedium)] border px-2.5 text-xs font-semibold transition-colors ${showScanner ? 'border-transparent bg-[var(--ms-blue)] text-white' : 'border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:bg-[var(--ms-surface-muted)]'}`}
                aria-pressed={showScanner}
              >
                <ScanLine className="h-3.5 w-3.5" /> Scanner
              </button>
            </div>
          </div>

          {showScanner && (
            <div className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="inline-flex rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-surface-muted)] p-0.5">
                  <button
                    type="button"
                    onClick={() => setScanMode('qr')}
                    className={`min-h-[28px] rounded-[var(--radiusSmall)] px-2.5 text-xs font-semibold transition-colors ${scanMode === 'qr' ? 'bg-[var(--ms-blue)] text-white' : 'text-[var(--ms-text-muted)]'}`}
                  >
                    QR produit
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanMode('barcode')}
                    className={`min-h-[28px] rounded-[var(--radiusSmall)] px-2.5 text-xs font-semibold transition-colors ${scanMode === 'barcode' ? 'bg-[var(--ms-blue)] text-white' : 'text-[var(--ms-text-muted)]'}`}
                  >
                    Code-barres
                  </button>
                </div>
                <span className="text-xs font-medium text-[var(--ms-text)]">
                  {scanMode === 'barcode' ? "Scannez le code-barres d'un produit pour l'ajouter" : "Scannez le QR d'un produit pour l'ajouter"}
                </span>
                <button type="button" onClick={() => setShowScanner(false)} className="ms-icon-button" aria-label="Fermer le scanner"><X className="h-4 w-4" /></button>
              </div>
              <Suspense fallback={<div className="py-8 text-center text-sm text-[var(--ms-text-muted)]">Activation de la caméra…</div>}>
                <ProductQrScanner
                  key={scanMode}
                  mode={scanMode}
                  onDetect={handleScannedProduct}
                  onError={() => toast.error("Impossible d'accéder à la caméra. Autorisez l'accès et réessayez.")}
                />
              </Suspense>
              <p className="mt-2 text-center text-xs text-[var(--ms-text-muted)]">La caméra reste active — scannez plusieurs produits à la suite.</p>
            </div>
          )}

          <div className="space-y-4">
            {selectedProducts.map((item, index) => {
              const selectedProduct = products.find(p => p._id === item.product);
              const productSearchTerm = productSearchTerms[index] || '';
              const hasProductSearch = productSearchTerm.trim().length > 0;
              const filteredProducts = hasProductSearch
                ? getFilteredProducts(productSearchTerm, item.product).slice(0, 30)
                : [];
              return (
                <div
                  key={index}
                  className={`rounded-[20px] border p-4 space-y-3 transition-colors ${
                    errors[index]
                      ? 'border-[var(--ms-danger)]/30 bg-[#FDF3F4]'
                      : 'border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">
                      Article {index + 1}
                    </span>
                    {selectedProducts.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProduct(index)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[var(--ms-danger)] transition-colors hover:bg-[#FDF3F4]"
                        aria-label={`Supprimer l'article ${index + 1}`}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Retirer
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    placeholder="Rechercher un produit…"
                    className={inputBase}
                    value={productSearchTerm}
                    onChange={(e) => {
                      const newTerms = [...productSearchTerms];
                      newTerms[index] = e.target.value;
                      setProductSearchTerms(newTerms);
                    }}
                    aria-label={`Recherche produit ${index + 1}`}
                  />

                  {hasProductSearch && (
                    <div
                      className={`overflow-hidden rounded-xl border bg-[var(--ms-white)] ${
                        errors[index] ? 'border-[var(--ms-danger)]/50' : 'border-[var(--ms-border)]'
                      }`}
                      role="listbox"
                      aria-label={`Choix produit ${index + 1}`}
                      aria-invalid={!!errors[index]}
                      aria-describedby={errors[index] ? `product-error-${index}` : undefined}
                    >
                      {filteredProducts.length > 0 ? (
                        <div className="max-h-72 overflow-y-auto">
                          {filteredProducts.map((p) => {
                            const isSelected = p._id === item.product;
                            return (
                              <button
                                key={p._id}
                                type="button"
                                onClick={() => handleProductChange(index, p._id)}
                                className={`flex w-full items-center gap-3 border-b border-[var(--ms-border)] px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--ms-bg-subtle)] ${
                                  isSelected ? 'bg-[var(--ms-blue-soft)]' : 'bg-transparent'
                                }`}
                                role="option"
                                aria-selected={isSelected}
                              >
                                <img
                                  src={p.image || '/placeholder.png'}
                                  alt=""
                                  className="h-12 w-12 shrink-0 rounded-lg border border-[var(--ms-border)] object-cover"
                                  loading="lazy"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-[var(--ms-text)]">
                                    {p.name}
                                  </span>
                                  <span className="mt-0.5 block text-xs text-[var(--ms-text-muted)]">
                                    Stock : {p.stock} · Prix : {(p.price || 0).toLocaleString('fr-FR')} CFA
                                  </span>
                                </span>
                                {isSelected && (
                                  <span className="shrink-0 rounded-full bg-[var(--ms-blue)] px-2 py-1 text-xs font-semibold text-white">
                                    Choisi
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="px-3 py-4 text-sm text-[var(--ms-text-muted)]">
                          Aucun produit disponible.
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ms-text-muted)]" htmlFor={`qty-${index}`}>Quantité</label>
                      <input
                        id={`qty-${index}`}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        className={inputBase}
                        value={item.quantity}
                        onChange={(e) => handleQuantityChange(index, e.target.value)}
                        placeholder="Qté"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ms-text-muted)]" htmlFor={`price-${index}`}>Prix unitaire (CFA)</label>
                      <input
                        id={`price-${index}`}
                        type="number"
                        inputMode="decimal"
                        className={inputBase}
                        value={item.price}
                        onChange={(e) => handlePriceChange(index, e.target.value)}
                        placeholder="Prix"
                      />
                    </div>
                  </div>

                  {selectedProduct && (
                    <div className="flex items-center gap-3 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-3">
                      <img
                        src={selectedProduct.image || '/placeholder.png'}
                        alt=""
                        className="w-14 h-14 object-cover rounded-md border border-[var(--ms-border)]"
                      />
                      <div className="text-sm text-[var(--ms-text-muted)] min-w-0">
                        <p className="font-medium text-[var(--ms-text)] truncate">{selectedProduct.name}</p>
                        <p>Stock : {selectedProduct.stock} · Catalogue : {(selectedProduct.price || 0).toLocaleString('fr-FR')} CFA</p>
                      </div>
                    </div>
                  )}

                  {errors[index] && (
                    <p id={`product-error-${index}`} className="text-sm text-[var(--ms-danger)]" role="alert">
                      {errors[index]}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addProduct}
            className="form-button-secondary flex w-full items-center justify-center gap-2 text-sm"
          >
            <span className="text-lg leading-none" aria-hidden>+</span>
            Ajouter un produit
          </button>

          {documentMode === 'sale' && (
            <div className="space-y-3 border-t border-dashed border-[var(--ms-border)] pt-4">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-[var(--ms-text)] uppercase tracking-[0.12em]">
                  Services
                </h4>
                <span className="text-xs text-[var(--ms-text-muted)]">{selectedServices.length} ligne(s)</span>
              </div>

              {selectedServices.map((item, index) => (
                <div
                  key={index}
                  className={`rounded-[20px] border p-4 space-y-3 transition-colors ${
                    serviceErrors[index]
                      ? 'border-[var(--ms-danger)]/30 bg-[#FDF3F4]'
                      : 'border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">
                      Service {index + 1}
                    </span>
                    {selectedServices.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeService(index)}
                        className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[var(--ms-danger)] transition-colors hover:bg-[#FDF3F4]"
                        aria-label={`Supprimer le service ${index + 1}`}
                      >
                        Retirer
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-[var(--ms-text-muted)]" htmlFor={`service-${index}`}>Service</label>
                    <select
                      id={`service-${index}`}
                      className={inputBase}
                      value={item.service}
                      onChange={(e) => handleServiceChange(index, e.target.value)}
                    >
                      <option value="">Sélectionner un service…</option>
                      {services.map((s) => (
                        <option key={s._id} value={s._id}>{s.name} ({(s.price || 0).toLocaleString('fr-FR')} CFA)</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ms-text-muted)]" htmlFor={`service-qty-${index}`}>Quantité</label>
                      <input
                        id={`service-qty-${index}`}
                        type="number"
                        inputMode="numeric"
                        min="1"
                        className={inputBase}
                        value={item.quantity}
                        onChange={(e) => handleServiceQuantityChange(index, e.target.value)}
                        placeholder="Qté"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-[var(--ms-text-muted)]" htmlFor={`service-price-${index}`}>Prix unitaire (CFA)</label>
                      <input
                        id={`service-price-${index}`}
                        type="number"
                        inputMode="decimal"
                        className={inputBase}
                        value={item.price}
                        onChange={(e) => handleServicePriceChange(index, e.target.value)}
                        placeholder="Prix"
                      />
                    </div>
                  </div>

                  {serviceErrors[index] && (
                    <p id={`service-error-${index}`} className="text-sm text-[var(--ms-danger)]" role="alert">
                      {serviceErrors[index]}
                    </p>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addService}
                className="form-button-secondary flex w-full items-center justify-center gap-2 text-sm"
              >
                <span className="text-lg leading-none" aria-hidden>+</span>
                Ajouter un service
              </button>
            </div>
          )}
        </section>

        {activeStage === 1 && <div className="flex justify-between gap-2"><button type="button" className="ms-button ms-button-secondary min-h-[44px]" onClick={() => goToStage(0)}>Retour</button><button type="button" className="ms-button ms-button-primary min-h-[44px]" onClick={() => goToStage(2)}>{SALE_STAGE_CONTINUE_LABELS[1]} <ArrowRightIcon /></button></div>}

        {activeStage === 2 && (
          <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Dernières informations avant la vérification : note, {documentMode === 'proforma' ? 'validité de l’offre' : 'type de vente et encaissement'}.
          </p>
        )}

        {/* NOTE */}
        <section className={`${stageClass(2)} space-y-2`} aria-labelledby="sale-form-note">
          <label id="sale-form-note" className={sectionTitleClass}>
            Note (optionnelle)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Commentaire ou remarque..."
            className={`${inputBase} min-h-[80px] resize-y`}
            rows={2}
            aria-describedby="sale-form-note"
          />
        </section>

        {documentMode === 'proforma' && (
          <section className={`${stageClass(2)} space-y-3`} aria-labelledby="proforma-validity">
          <h4 id="proforma-validity" tabIndex={-1} className={sectionTitleClass}>
              Validité de l’offre
            </h4>
            <div className="form-panel p-4 space-y-2">
              <input
                type="date"
                value={validUntil}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setValidUntil(e.target.value)}
                className={inputBase}
                required
              />
              <p className="form-help">Cette date apparaîtra sur la facture proforma.</p>
            </div>
          </section>
        )}

        {documentMode === 'sale' && manualSaleDateEnabled && (
          <section className={`${stageClass(2)} space-y-3`} aria-labelledby="sale-form-date">
            <h4 id="sale-form-date" className={sectionTitleClass}>
              Date réelle de vente
            </h4>
            <div className="form-panel p-4 space-y-2">
              <input
                type="datetime-local"
                value={saleDate}
                onChange={(e) => setSaleDate(e.target.value)}
                className={inputBase}
                aria-label="Date réelle de la vente"
              />
              <p className="form-help">
                Optionnel. Utilisez ce champ pour rattraper des ventes notées sur papier avec leur vraie date.
              </p>
            </div>
          </section>
        )}

        {documentMode === 'sale' && (
          <section className={`${stageClass(2)} space-y-3`} aria-labelledby="sale-form-type">
            <h4 id="sale-form-type" className={sectionTitleClass}>
              Type de vente
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-labelledby="sale-form-type">
              {['normal', 'wholesale'].map((type) => {
                const active = saleType === type;

                return (
                  <label
                    key={type}
                    className={`cursor-pointer rounded-[20px] border p-4 transition-all ${
                      active
                        ? 'border-[var(--ms-text-strong)] bg-[var(--ms-text-strong)] text-[var(--ms-white)] shadow-[var(--ms-shadow)]'
                        : 'border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:border-[var(--ms-border-strong)] hover:bg-[var(--ms-surface-muted)]'
                    }`}
                  >
                    <input
                      type="radio"
                      name="saleType"
                      value={type}
                      checked={active}
                      onChange={(e) => setSaleType(e.target.value)}
                      className="sr-only"
                    />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{getSaleTypeText(type)}</p>
                        <p className="mt-1 text-xs opacity-80">
                          {type === 'wholesale'
                            ? 'Commande en gros visible séparément dans les statistiques.'
                            : 'Commande standard affichée comme vente normale.'}
                        </p>
                      </div>
                      <span className={`mt-0.5 h-3.5 w-3.5 rounded-full border ${active ? 'border-current bg-current' : 'border-gray-300 bg-white'}`} />
                    </div>
                  </label>
                );
              })}
            </div>
          </section>
        )}

        {/* REMINDER */}
        {documentMode === 'sale' && <section className={`${stageClass(2)} space-y-3`} aria-labelledby="sale-form-reminder">
          <h4 id="sale-form-reminder" className={sectionTitleClass}>
            Rappel de paiement
          </h4>
          {isFullyPaid && (
            <div className="rounded-lg border border-[var(--ms-success)]/20 bg-[#F1FAF1] px-4 py-3 text-sm text-[var(--ms-success)]">
              La vente est soldee. Le rappel de paiement est desactive.
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer group">
            <input
              type="checkbox"
              checked={setReminder}
              onChange={(e) => setSetReminder(e.target.checked)}
              disabled={isFullyPaid}
              className="form-check rounded"
            />
            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">Définir un rappel</span>
          </label>
          {setReminder && !isFullyPaid && (
            <div className="form-panel p-4 space-y-3">
              <input
                type="datetime-local"
                value={reminderDate}
                onChange={(e) => setReminderDate(e.target.value)}
                className={inputBase}
                aria-label="Date et heure du rappel"
              />
              <textarea
                value={reminderNote}
                onChange={(e) => setReminderNote(e.target.value)}
                placeholder="Note du rappel…"
                className={`${inputBase} min-h-[72px] resize-y`}
                rows={2}
                aria-label="Note du rappel"
              />
            </div>
          )}
        </section>}

        {/* PAYMENT METHOD */}
        {documentMode === 'sale' && <section className={`${stageClass(2)} space-y-3`} aria-labelledby="sale-form-payment">
          <h4 id="sale-form-payment" tabIndex={-1} className={sectionTitleClass}>
            Méthode de paiement
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-labelledby="sale-form-payment">
            {['cash', 'MobileMoney', 'credit'].map((m) => (
              <label
                key={m}
                className={`flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-lg border px-4 py-3 transition-all ${
                  paymentMethod === m
                    ? 'border-[var(--ms-text-strong)] bg-[var(--ms-text-strong)] text-[var(--ms-white)] shadow-[var(--ms-shadow)]'
                    : 'border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] text-[var(--ms-text)] hover:border-[var(--ms-border-strong)] hover:bg-[var(--ms-surface-muted)]'
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  value={m}
                  checked={paymentMethod === m}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="sr-only"
                />
                <span className="text-sm font-medium capitalize">
                  {m === 'MobileMoney' ? 'Mobile Money' : m === 'credit' ? 'Crédit' : 'Espèces'}
                </span>
              </label>
            ))}
          </div>

          <div className="form-panel p-4 space-y-3">
            <label htmlFor="sale-promo-code" className="form-label block">Code promo (optionnel)</label>
            <div className="flex gap-2">
              <input
                id="sale-promo-code"
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                className={inputBase}
                placeholder="Ex: BIENVENUE10"
                disabled={Boolean(promoApplied)}
              />
              {promoApplied ? (
                <button type="button" onClick={() => { setPromoApplied(null); setPromoCode(''); }} className="ms-button ms-button-secondary min-h-[44px] shrink-0">Retirer</button>
              ) : (
                <button type="button" onClick={handleApplyPromo} disabled={promoApplying || !promoCode.trim()} className="ms-button ms-button-secondary min-h-[44px] shrink-0 disabled:opacity-60">
                  {promoApplying ? 'Vérification…' : 'Appliquer'}
                </button>
              )}
            </div>
            {promoApplied && (
              <p className="text-sm text-[var(--ms-success)]">
                {promoApplied.label || promoApplied.code} : −{promoDiscount.toLocaleString('fr-FR')} CFA
              </p>
            )}
          </div>

          <div className="form-panel p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <label htmlFor="sale-payment-amount" className="form-label mb-1.5 block">
                  Montant payé maintenant
                </label>
                <input
                  id="sale-payment-amount"
                  type="number"
                  min="0"
                  max={payableTotal || undefined}
                  step="0.01"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className={inputBase}
                  placeholder="0"
                />
              </div>
              <button
                type="button"
                onClick={() => setPaymentAmount(payableTotal > 0 ? String(payableTotal) : '')}
                className="form-button-secondary"
              >
                Paiement total
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="rounded-lg bg-[var(--ms-white)] border border-[var(--ms-border)] px-3 py-2.5">
                <p className="text-[var(--ms-text-muted)]">Total vente</p>
                <p className="font-semibold text-[var(--ms-text)]">{payableTotal.toLocaleString('fr-FR')} CFA</p>
                {promoDiscount > 0 && (
                  <p className="text-xs text-[var(--ms-success)]">Remise −{promoDiscount.toLocaleString('fr-FR')} CFA</p>
                )}
              </div>
              <div className="rounded-lg bg-[var(--ms-white)] border border-[var(--ms-border)] px-3 py-2.5">
                <p className="text-[var(--ms-text-muted)]">Paye</p>
                <p className="font-semibold text-[var(--ms-success)]">{normalizedPaymentAmount.toLocaleString('fr-FR')} CFA</p>
              </div>
              <div className="rounded-lg bg-[var(--ms-white)] border border-[var(--ms-border)] px-3 py-2.5">
                <p className="text-[var(--ms-text-muted)]">Reste</p>
                <p className="font-semibold text-[var(--ms-warning)]">{remainingBalance.toLocaleString('fr-FR')} CFA</p>
              </div>
            </div>

            {isFullyPaid && (
              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-[var(--ms-success)]/20 bg-[#F1FAF1] px-4 py-3">
                <input
                  type="checkbox"
                  checked={markAsDelivered}
                  onChange={(e) => setMarkAsDelivered(e.target.checked)}
                  className="form-check rounded"
                />
                <span className="text-sm font-medium text-[var(--ms-success)]">
                  Confirmer la livraison immediatement
                </span>
              </label>
            )}
          </div>
        </section>}

        {activeStage === 2 && <div className="flex justify-between gap-2"><button type="button" className="ms-button ms-button-secondary min-h-[44px]" onClick={() => goToStage(1)}>Retour</button><button type="button" className="ms-button ms-button-primary min-h-[44px]" onClick={() => goToStage(3)}>{documentMode === 'proforma' ? 'Vérifier la proforma' : SALE_STAGE_CONTINUE_LABELS[2]} <ArrowRightIcon /></button></div>}

        {/* TOTAL */}
        <div className={`${stageClass(3)} rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-5 py-4`}>
          <div className="mb-3 flex items-center justify-between"><h4 id="sale-review-title" tabIndex={-1} className="font-semibold">{documentMode === 'proforma' ? 'Vérification de la proforma' : 'Vérification finale'}</h4><button type="button" className="ms-button ms-button-secondary min-h-[44px]" onClick={() => goToStage(2)}>Modifier</button></div>
          <div className="grid gap-2 text-sm sm:grid-cols-2"><p>Client : <strong>{safeClients.find(client => client._id === selectedClient)?.name || '—'}</strong></p><p>Mode : <strong>{documentMode === 'proforma' ? 'Facture proforma' : getSaleTypeText(saleType)}</strong></p>{documentMode === 'sale' && <><p>Paiement : <strong>{paymentMethod === 'MobileMoney' ? 'Mobile Money' : paymentMethod === 'credit' ? 'Crédit' : 'Espèces'}</strong></p><p>Payé maintenant : <strong>{normalizedPaymentAmount.toLocaleString('fr-FR')} CFA</strong></p><p>Reste à payer : <strong>{remainingBalance.toLocaleString('fr-FR')} CFA</strong></p></>}{documentMode === 'proforma' && <p>Valide jusqu’au : <strong>{validUntil || '—'}</strong></p>}</div>
          <ul className="mt-3 divide-y divide-[var(--ms-border)] rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)]" aria-label="Articles à vérifier">
            {selectedProducts.filter(item => item.product).map((item, index) => {
              const product = products.find(candidate => candidate._id === item.product);
              return <li key={`${item.product}-${index}`} className="flex items-start justify-between gap-3 p-3 text-sm"><span className="min-w-0"><strong className="block truncate">{product?.name || 'Produit à sélectionner'}</strong><span>{item.quantity} × {Number(item.price || 0).toLocaleString('fr-FR')} CFA</span></span><strong className="shrink-0 tabular-nums">{(Number(item.quantity || 0) * Number(item.price || 0)).toLocaleString('fr-FR')} CFA</strong></li>;
            })}
            {selectedServices.filter(item => item.service).map((item, index) => {
              const service = services.find(candidate => candidate._id === item.service);
              return <li key={`${item.service}-${index}`} className="flex items-start justify-between gap-3 p-3 text-sm"><span className="min-w-0"><strong className="block truncate">🛠️ {service?.name || 'Service à sélectionner'}</strong><span>{item.quantity} × {Number(item.price || 0).toLocaleString('fr-FR')} CFA</span></span><strong className="shrink-0 tabular-nums">{(Number(item.quantity || 0) * Number(item.price || 0)).toLocaleString('fr-FR')} CFA</strong></li>;
            })}
          </ul>
          {note && <p className="mt-2 text-sm">Note : {note}</p>}
          <div className="mt-3 space-y-1 border-t border-[var(--ms-border)] pt-3">
            <div className="flex items-center justify-between text-sm"><span className="text-[var(--ms-text-muted)]">Sous-total</span><span className="tabular-nums">{totalAmount.toLocaleString('fr-FR')} CFA</span></div>
            {promoDiscount > 0 && (
              <div className="flex items-center justify-between text-sm"><span className="text-[var(--ms-success)]">Remise {promoApplied?.code ? `(${promoApplied.code})` : ''}</span><span className="tabular-nums text-[var(--ms-success)]">−{promoDiscount.toLocaleString('fr-FR')} CFA</span></div>
            )}
            <div className="flex items-center justify-between"><span className="font-semibold">Total</span><span className="text-xl font-bold tabular-nums">{payableTotal.toLocaleString('fr-FR')} CFA</span></div>
          </div>
        </div>

        {!hideSubmit && activeStage === 3 && (
          <button
            type="submit"
            disabled={isSubmitting}
            className="form-button-primary w-full"
          >
            {isSubmitting
              ? documentMode === 'proforma'
                ? 'Génération du PDF...'
                : 'Enregistrement...'
              : documentMode === 'proforma'
                ? 'Télécharger la proforma'
                : 'Enregistrer la vente'}
          </button>
        )}

        {formError && (
          <div
            className="p-4 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] text-[var(--ms-danger)] text-sm text-center"
            role="alert"
          >
            {formError}
          </div>
        )}
      </div>
      </fieldset>
    </form>
  );
};

// Remount fields on identity/mode changes so one shop or document cannot inherit another's state.
const SaleForm = props => {
  const { auth } = useContext(AuthContext);
  const [documentMode, setDocumentMode] = useState('sale');
  const key = saleDraftKey({ tenantId: auth?.tenantId, userId: auth?.user?._id, mode: documentMode });
  return <SaleFormFields {...props} key={key || 'unscoped'} draftKey={key} documentMode={documentMode} setDocumentMode={setDocumentMode} />;
};

SaleForm.propTypes = {
  clients: PropTypes.oneOfType([
    PropTypes.arrayOf(
      PropTypes.shape({
        _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        name: PropTypes.string.isRequired,
      })
    ),
    PropTypes.object,
  ]),
  products: PropTypes.oneOfType([
    PropTypes.arrayOf(
      PropTypes.shape({
        _id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        name: PropTypes.string,
      })
    ),
    PropTypes.object,
  ]),
  onSubmit: PropTypes.func.isRequired,
  onProformaCreated: PropTypes.func,
  formId: PropTypes.string,
  hideSubmit: PropTypes.bool,
  initialProductId: PropTypes.string,
  onStageChange: PropTypes.func,
};

export default SaleForm;
