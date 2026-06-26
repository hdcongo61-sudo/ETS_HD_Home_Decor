import React, { useState, useContext, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../services/api';
import { confirmDialog } from '../components/ConfirmProvider';
import QRCode from 'react-qr-code';
import { Line } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import 'chart.js/auto';
import { productEditPath, productPath } from '../utils/paths';
import AuthContext from '../context/AuthContext';
import Modal from '../components/Modal';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { EmptyState, LoadingSkeleton, Workspace } from '../components/business';
import {
  ArrowLeft,
  QrCode,
  FileDown,
  Pencil,
  Eye,
  EyeOff,
  TrendingUp,
  DollarSign,
  BarChart2,
  Archive,
  ShoppingCart,
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Tag,
  Warehouse,
  Building2,
  Phone,
  ExternalLink,
  Maximize2,
  Images,
  AlertTriangle,
  Plus,
  RotateCcw,
} from 'lucide-react';

/* ─── utilities ─── */
const LOSS_REASONS = [
  { value: 'casse', label: 'Casse / abîmé' },
  { value: 'cadeau', label: 'Cadeau / échantillon' },
  { value: 'vol', label: 'Vol' },
  { value: 'peremption', label: 'Péremption' },
  { value: 'usage_personnel', label: 'Usage personnel' },
  { value: 'correction', label: 'Correction de stock' },
  { value: 'autre', label: 'Autre' },
];
const lossReasonLabel = (r) => (LOSS_REASONS.find((x) => x.value === r)?.label || r);

const toNumber = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (v) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(toNumber(v));
const fmtDate = (d) =>
  d
    ? `${new Date(d).toLocaleDateString('fr-FR')} à ${new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    : '—';

const buildStatsSkeleton = (p = {}) => ({
  salesThisPeriod: 0,
  ordersThisPeriod: 0,
  revenueThisPeriod: 0,
  profitThisPeriod: 0,
  totalUnitsSold: 0,
  totalRevenue: 0,
  totalProfit: 0,
  stock: { currentStock: p.stock || 0, stockValue: (p.stock || 0) * (p.price || 0) },
  activities: [],
});

/* ─── activity helpers ─── */
const ACTIVITY_META = {
  creation:     { icon: CheckCircle2, bg: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' },
  adjustment:   { icon: RefreshCw,    bg: 'var(--colorStatusInfoBackground1)',    color: 'var(--colorStatusInfoForeground1)' },
  stock_update: { icon: Archive,      bg: '#EDE9FE',                              color: '#6D28D9' },
  price_update: { icon: Tag,          bg: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)' },
  sale:         { icon: ShoppingCart, bg: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' },
  return:       { icon: AlertCircle,  bg: 'var(--colorStatusDangerBackground1)',  color: 'var(--colorStatusDangerForeground1)' },
  default:      { icon: Clock,        bg: 'var(--colorNeutralBackground3)',       color: 'var(--colorNeutralForeground3)' },
};

/* ═══════════════════════════════════════════════════════ */
/*  PRODUCT DETAILS                                        */
/* ═══════════════════════════════════════════════════════ */
const ProductDetails = () => {
  const { id } = useParams();
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin || auth?.isAdmin);
  const userPermissions = Array.isArray(auth?.user?.permissions) ? auth.user.permissions : [];
  const navigate = useNavigate();
  const location = useLocation();

  const [product, setProduct] = useState(null);
  const [stats, setStats] = useState(buildStatsSkeleton());
  const [weekStats, setWeekStats] = useState(buildStatsSkeleton());
  const [loading, setLoading] = useState(true);
  const [gallery, setGallery] = useState([]); // distinct images across same-name duplicates
  const [activeImage, setActiveImage] = useState('');
  const [imageZoom, setImageZoom] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [showQRCode, setShowQRCode] = useState(false);
  const [qrMode, setQrMode] = useState('sell'); // 'sell' (scan-to-sell) | 'view'
  const [showProfitSections, setShowProfitSections] = useState(true);
  const [salesHistory, setSalesHistory] = useState([]);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);
  const [salesHistoryError, setSalesHistoryError] = useState('');
  const [buyersModalOpen, setBuyersModalOpen] = useState(false);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [buyersError, setBuyersError] = useState('');
  const [buyersSales, setBuyersSales] = useState([]);
  const buyersTableRef = useRef(null);
  useResponsiveTable(buyersTableRef, [buyersSales, buyersModalOpen]);
  const [requestModal, setRequestModal] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const [requestValue, setRequestValue] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  // Pertes & cadeaux (sorties de stock hors vente)
  const [lossModalOpen, setLossModalOpen] = useState(false);
  const [lossForm, setLossForm] = useState({ reason: 'casse', quantity: '1', note: '' });
  const [lossSubmitting, setLossSubmitting] = useState(false);
  const [lossMovements, setLossMovements] = useState([]);
  const [lossLoading, setLossLoading] = useState(false);
  const qrCodeRef = useRef();
  const pageRef = useRef();

  const fetchLossMovements = useCallback(async () => {
    if (!id) return;
    setLossLoading(true);
    try {
      const { data } = await api.get(`/products/stock-movements?product=${id}`);
      setLossMovements(data.movements || []);
    } catch {
      setLossMovements([]);
    } finally {
      setLossLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/products/${id}`);
        setProduct(res.data);
        // Shared pictures across same-name duplicates (one per container).
        try {
          const imgRes = await api.get(`/products/${id}/images`);
          const imgs = imgRes.data?.images || [];
          setGallery(imgs);
          setActiveImage(res.data.image || imgRes.data?.primary || '');
        } catch {
          setGallery([]);
          setActiveImage(res.data.image || '');
        }
        const statsRes = await api.get(`/products/${id}/stats?range=month`);
        setStats({ ...buildStatsSkeleton(res.data), ...statsRes.data });
        const weekStatsRes = await api.get(`/products/${id}/stats?range=week`);
        setWeekStats({ ...buildStatsSkeleton(res.data), ...weekStatsRes.data });
      } catch (err) {
        console.error('Error loading product details:', err);
      } finally {
        setLoading(false);
      }
    };
    const loadHistory = async () => {
      setSalesHistoryLoading(true);
      setSalesHistoryError('');
      try {
        const { data } = await api.get(`/products/${id}/sales-history?limit=5`);
        setSalesHistory(data.sales || []);
      } catch {
        setSalesHistory([]);
        setSalesHistoryError('Impossible de charger les ventes liées');
      } finally {
        setSalesHistoryLoading(false);
      }
    };
    load();
    loadHistory();
  }, [id]);

  // Refresh product + stats after a stock movement (stock/profit change).
  const refreshProductAndStats = useCallback(async () => {
    try {
      const res = await api.get(`/products/${id}`);
      setProduct(res.data);
      const statsRes = await api.get(`/products/${id}/stats?range=month`);
      setStats({ ...buildStatsSkeleton(res.data), ...statsRes.data });
      const weekStatsRes = await api.get(`/products/${id}/stats?range=week`);
      setWeekStats({ ...buildStatsSkeleton(res.data), ...weekStatsRes.data });
    } catch { /* ignore */ }
  }, [id]);

  useEffect(() => { if (isAdmin) fetchLossMovements(); }, [isAdmin, fetchLossMovements]);

  const submitLoss = async (e) => {
    e.preventDefault();
    const qty = parseInt(lossForm.quantity, 10);
    if (!qty || qty <= 0) { toast.error('Quantité invalide.'); return; }
    setLossSubmitting(true);
    try {
      await api.post('/products/stock-movement', {
        productId: id, quantity: qty, reason: lossForm.reason, note: lossForm.note.trim(),
      });
      toast.success('Sortie de stock enregistrée.');
      setLossModalOpen(false);
      setLossForm({ reason: 'casse', quantity: '1', note: '' });
      await Promise.all([fetchLossMovements(), refreshProductAndStats()]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setLossSubmitting(false);
    }
  };

  const undoLoss = async (movementId) => {
    if (!(await confirmDialog('Annuler cette sortie ? Le stock sera restauré.'))) return;
    try {
      await api.delete(`/products/stock-movement/${movementId}`);
      toast.success('Sortie annulée, stock restauré.');
      await Promise.all([fetchLossMovements(), refreshProductAndStats()]);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur.');
    }
  };

  const canSeeFinancials = isAdmin || userPermissions.includes('view_sensitive_financials');
  const canSeeSupplierContacts = isAdmin || userPermissions.includes('view_supplier_contacts');

  // Ensure activeTab is valid for current user
  useEffect(() => {
    if (!canSeeFinancials && activeTab === 'financial') {
      setActiveTab('overview');
    }
  }, [canSeeFinancials, activeTab]);

  const profitMargin =
    product?.costPrice && product?.price
      ? ((product.price - product.costPrice) / product.costPrice) * 100
      : null;
  const absoluteProfit = product?.costPrice && product?.price ? product.price - product.costPrice : 0;
  const showRealizedProfit = canSeeFinancials && showProfitSections;
  const productUrl = `${window.location.origin}${productPath(product || id)}`;
  // Scan-to-sell: opens the sales page with this product preloaded in the form.
  const productSaleUrl = `${window.location.origin}/sales?addProduct=${product?._id || id}#sale-form`;
  const qrValue = qrMode === 'sell' ? productSaleUrl : productUrl;

  // Download the QR as a PNG (printable shelf/product label).
  const downloadQRCode = () => {
    const svg = qrCodeRef.current?.querySelector('svg');
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const svgUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    img.onload = () => {
      const size = 600;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      const pad = 40;
      ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
      URL.revokeObjectURL(svgUrl);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const safeName = (product?.name || 'produit').replace(/[^\w-]+/g, '-').slice(0, 40);
        a.download = `qr-${safeName}-${qrMode === 'sell' ? 'vente' : 'fiche'}.png`;
        a.click();
        URL.revokeObjectURL(a.href);
      }, 'image/png');
    };
    img.src = svgUrl;
  };
  const returnToProducts = location.state?.returnToProducts || '/products';

  const openBuyersModal = async () => {
    setBuyersModalOpen(true);
    if (buyersLoading || buyersSales.length > 0) return;
    setBuyersLoading(true);
    setBuyersError('');
    try {
      const { data } = await api.get(`/products/${id}/sales-history?limit=200`);
      setBuyersSales(data.sales || []);
    } catch {
      setBuyersSales([]);
      setBuyersError('Impossible de charger la liste des acheteurs');
    } finally {
      setBuyersLoading(false);
    }
  };

  const openAdminRequest = (type) => {
    setRequestModal(type);
    setRequestReason('');
    setRequestValue('');
  };

  const submitAdminRequest = async () => {
    if (!requestModal || requestSubmitting || !requestReason.trim()) return;
    const numericValue = requestValue === '' ? null : Number(requestValue);
    if (requestModal !== 'other' && (numericValue === null || Number.isNaN(numericValue))) return;
    const metadata = { productId: product._id };
    let type = 'other';
    let targetLabel = product.name;
    let note = '';
    if (requestModal === 'price') {
      type = 'product.price_change';
      metadata.oldPrice = product.price;
      metadata.newPrice = numericValue;
      targetLabel = `Prix produit: ${product.name}`;
      note = `Nouveau prix proposé: ${fmt(numericValue)}`;
    } else if (requestModal === 'stock') {
      type = 'stock.adjustment';
      metadata.currentStock = product.stock;
      metadata.targetStock = numericValue;
      targetLabel = `Stock produit: ${product.name}`;
      note = `Stock cible proposé: ${numericValue}`;
    }
    try {
      setRequestSubmitting(true);
      await api.post('/admin-requests', { type, targetModel: 'Product', targetId: product._id, targetLabel, reason: requestReason.trim(), note, metadata });
      setRequestModal(null);
      setRequestReason('');
      setRequestValue('');
    } finally {
      setRequestSubmitting(false);
    }
  };

  const handleExportPDF = async () => {
    // useCORS lets html2canvas render cross-origin product images (Cloudinary,
    // Dropbox raw, …) so the picture is actually included in the downloaded PDF.
    const canvas = await html2canvas(pageRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    pdf.addImage(imgData, 'PNG', 0, 0, width, (canvas.height * width) / canvas.width);
    pdf.save(`Fiche_${product.name.replace(/\s+/g, '_')}.pdf`);
  };

  const salesPerformance7Days = (() => {
    const trendByDate = new Map((weekStats.trend || []).map((entry) => [entry.date, entry]));
    const days = [];
    const today = new Date();

    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(today);
      date.setHours(0, 0, 0, 0);
      date.setDate(today.getDate() - offset);
      const key = date.toISOString().split('T')[0];
      const entry = trendByDate.get(key) || {};
      days.push({
        key,
        label: date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit' }),
        unitsSold: Number(entry.unitsSold || 0),
        revenue: Number(entry.revenue || 0),
        orders: Number(entry.orders || 0),
      });
    }

    return days;
  })();

  const salesTrendData = {
    labels: salesPerformance7Days.map((day) => day.label),
    datasets: [{
      label: 'Unités vendues',
      data: salesPerformance7Days.map((day) => day.unitsSold),
      borderColor: 'var(--colorBrandBackground)',
      backgroundColor: 'rgba(15,108,189,0.08)',
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointBackgroundColor: 'var(--colorBrandBackground)',
    }],
  };

  const sevenDayTotals = salesPerformance7Days.reduce(
    (acc, day) => ({
      units: acc.units + day.unitsSold,
      revenue: acc.revenue + day.revenue,
      orders: acc.orders + day.orders,
    }),
    { units: 0, revenue: 0, orders: 0 }
  );

  const chartOptions = {
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false }, ticks: { font: { size: 11 }, color: 'var(--colorNeutralForeground3)' } },
      y: { grid: { color: 'var(--colorNeutralStroke2)' }, ticks: { font: { size: 11 }, color: 'var(--colorNeutralForeground3)' } },
    },
    maintainAspectRatio: false,
  };

  /* ── loading / empty states ── */
  if (loading) return <Workspace><LoadingSkeleton rows={8} /></Workspace>;

  if (!product)
    return (
      <Workspace>
        <EmptyState
          title="Produit introuvable"
          description="La fiche produit demandée n'est pas disponible."
          action={
            <button className="ms-button ms-button-secondary ms-button-md" onClick={() => navigate(returnToProducts)}>
              Retour à la liste
            </button>
          }
        />
      </Workspace>
    );

  const stockTone = product.stock < 5 ? 'danger' : product.stock < 15 ? 'warning' : 'success';

  /* ─── TABS config ─── */
  const TABS = [
    { id: 'overview',  label: 'Aperçu' },
    { id: 'journal', label: 'Journal' },
    ...(canSeeFinancials ? [{ id: 'financial', label: 'Analyse financière' }] : []),
    ...(isAdmin ? [{ id: 'losses', label: 'Pertes & cadeaux' }] : []),
  ];

  return (
    <Workspace>
      <div ref={pageRef} className="space-y-4">

        {/* ══ COMMAND BAR ══ */}
        <div className="ms-command-bar flex-wrap gap-y-2">
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => navigate(returnToProducts)}
              className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"
            >
              <ArrowLeft size={14} />
              Retour
            </button>
            <div className="hidden sm:block w-px h-5 bg-[var(--colorNeutralStroke1)]" />
            <span className="hidden sm:block text-[13px] text-[var(--colorNeutralForeground3)] truncate max-w-[240px]">
              {product.name}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            {canSeeFinancials && (
              <button
                onClick={() => setShowProfitSections(p => !p)}
                className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"
                title={showProfitSections ? 'Masquer les données financières' : 'Afficher les données financières'}
              >
                {showProfitSections ? <EyeOff size={14} /> : <Eye size={14} />}
                <span className="hidden sm:inline">{showProfitSections ? 'Masquer bénéfice' : 'Afficher bénéfice'}</span>
              </button>
            )}
            <button
              onClick={() => setShowQRCode(true)}
              className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"
            >
              <QrCode size={14} />
              <span className="hidden sm:inline">QR Code</span>
            </button>
            {isAdmin && (
              <button
                onClick={handleExportPDF}
                className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"
              >
                <FileDown size={14} />
                <span className="hidden sm:inline">PDF</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => { setLossForm({ reason: 'casse', quantity: '1', note: '' }); setLossModalOpen(true); }}
                className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"
                title="Enregistrer une casse, un cadeau ou une autre sortie de stock"
              >
                <AlertTriangle size={14} />
                <span className="hidden sm:inline">Perte / Cadeau</span>
              </button>
            )}
            {isAdmin && (
              <button
                onClick={() => navigate(productEditPath(product || id), { state: { returnTo: productPath(product || id) } })}
                className="ms-button ms-button-primary ms-button-sm flex items-center gap-1.5"
              >
                <Pencil size={14} />
                Modifier
              </button>
            )}
            {!isAdmin && (
              <>
                <button
                  onClick={() => openAdminRequest('price')}
                  className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"
                >
                  <Tag size={14} />
                  Demander prix
                </button>
                <button
                  onClick={() => openAdminRequest('stock')}
                  className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1.5"
                >
                  <Archive size={14} />
                  Demander stock
                </button>
              </>
            )}
          </div>
        </div>

        {/* ══ HERO: IMAGE + DETAILS ══ */}
        <div className="fluent-card-filled p-0 overflow-hidden">
          <div className="fui-detail-hero p-5 md:p-6">

            {/* ── Image column ── */}
            {(() => {
              const effectiveImage = activeImage || product.image || '/placeholder.png';
              const hasImage = Boolean(activeImage || product.image);
              const isShared = !product.image && Boolean(activeImage);
              return (
                <div className="space-y-3">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => hasImage && setImageZoom(true)}
                      className="group relative block w-full overflow-hidden rounded-[var(--radiusLarge)]"
                      style={{ border: '1px solid var(--colorNeutralStroke2)', cursor: hasImage ? 'zoom-in' : 'default' }}
                      aria-label="Agrandir l'image"
                    >
                      <img src={effectiveImage} alt={product.name} className="fui-detail-image" />
                      {hasImage && (
                        <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100" style={{ background: 'rgba(0,0,0,0.55)', color: '#fff' }}>
                          <Maximize2 size={15} />
                        </span>
                      )}
                    </button>

                    {isShared && (
                      <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
                        <Images size={11} /> Image partagée
                      </span>
                    )}

                    {canSeeFinancials && showProfitSections && profitMargin > 0 && (
                      <div
                        className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold"
                        style={{ background: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)', border: '1px solid var(--colorStatusSuccessStroke1)' }}
                      >
                        <TrendingUp size={11} />
                        +{profitMargin.toFixed(1)}% marge
                      </div>
                    )}
                  </div>

                  {/* Thumbnail strip — distinct pictures across same-name duplicates */}
                  {gallery.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                      {gallery.map((img) => {
                        const isActive = img.url === effectiveImage;
                        return (
                          <button
                            key={img.url}
                            type="button"
                            onClick={() => setActiveImage(img.url)}
                            className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--radiusMedium)] transition"
                            style={{ border: isActive ? '2px solid var(--ms-blue)' : '1px solid var(--colorNeutralStroke2)' }}
                            title={img.container ? `Conteneur ${img.container}` : (img.isCurrent ? 'Cette fiche' : 'Doublon')}
                            aria-pressed={isActive}
                          >
                            <img src={img.url} alt="" className="h-full w-full object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {gallery.length > 1 && (
                    <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                      {gallery.length} photos trouvées sur les fiches « {product.name} ».
                    </p>
                  )}
                </div>
              );
            })()}

            {/* ── Info column ── */}
            <div className="flex flex-col justify-between gap-5 min-w-0">
              <div className="space-y-4">
                {/* Eyebrow */}
                <p className="fui-caption1-strong uppercase tracking-widest" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Fiche produit
                </p>

                {/* Title */}
                <div>
                  <h1 className="fui-title1 mb-2" style={{ color: 'var(--colorNeutralForeground1)' }}>
                    {product.name}
                  </h1>
                  <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground3)', lineHeight: '1.6' }}>
                    {product.description || 'Aucune description enregistrée.'}
                  </p>
                </div>

                {/* Price */}
                <div className="flex items-baseline gap-3 flex-wrap">
                  <span className="fui-large-title" style={{ color: 'var(--colorNeutralForeground1)' }}>
                    {fmt(product.price)}
                  </span>
                  {canSeeFinancials && showProfitSections && product.costPrice && (
                    <span className="fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                      Coût : {fmt(product.costPrice)}
                    </span>
                  )}
                </div>

                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <span className={`ms-status-badge ms-status-${stockTone}`}>
                    {product.stock} en stock
                  </span>
                  {product.container?.trim() && (
                    <span className="ms-status-badge ms-status-neutral flex items-center gap-1">
                      <Archive size={11} />
                      {product.container.trim()}
                    </span>
                  )}
                  {product.warehouse?.trim() && (
                    <span className="ms-status-badge ms-status-neutral flex items-center gap-1">
                      <Warehouse size={11} />
                      {product.warehouse.trim()}
                    </span>
                  )}
                </div>
              </div>

              {/* Supplier card */}
              {product.supplierName && (
                <div
                  className="rounded-[var(--radiusLarge)] p-4 text-sm space-y-1"
                  style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}
                >
                  <p className="fui-caption1-strong flex items-center gap-1.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
                    <Building2 size={12} />
                    Fournisseur
                  </p>
                  <Link
                    to={`/suppliers/${encodeURIComponent(product.supplierName)}`}
                    className="fui-subtitle2 flex items-center gap-1 hover:underline"
                    style={{ color: 'var(--colorBrandForeground1)' }}
                  >
                    {product.supplierName}
                    <ExternalLink size={12} />
                  </Link>
                  {canSeeSupplierContacts && product.supplierPhone && (
                    <p className="fui-caption1 flex items-center gap-1.5 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                      <Phone size={11} />
                      {product.supplierPhone}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ══ KPI STRIP ══ */}
        <div className="fui-kpi-grid">
          <KPICard
            icon={<ShoppingCart size={16} />}
            label="Unités vendues"
            value={toNumber(stats.totalUnitsSold).toLocaleString('fr-FR')}
            tone="brand"
          />
          <KPICard
            icon={<DollarSign size={16} />}
            label="CA total"
            value={fmt(stats.totalRevenue)}
            tone="success"
          />
          {canSeeFinancials && showProfitSections && (
            <KPICard
              icon={<TrendingUp size={16} />}
              label="Bénéfice total"
              value={fmt(stats.totalProfit)}
              tone="success"
            />
          )}
          <KPICard
            icon={<BarChart2 size={16} />}
            label="Valeur du stock"
            value={fmt(stats.stock.stockValue)}
            tone="neutral"
          />
        </div>

        {/* ══ PIVOT TABS ══ */}
        <div className="fluent-card-filled overflow-hidden">
          {/* Tab bar */}
          <div className="fui-pivot px-4">
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`fui-pivot__tab ${activeTab === id ? 'fui-pivot__tab--active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-5">

            {/* ── APERÇU ── */}
            {activeTab === 'overview' && (
              <div className="grid md:grid-cols-2 gap-5">
                {/* Chart */}
                <div>
                  <p className="fui-subtitle2 mb-4" style={{ color: 'var(--colorNeutralForeground1)' }}>
                    Performance des ventes (7 derniers jours)
                  </p>
                  <div style={{ height: 180 }}>
                    <Line data={salesTrendData} options={chartOptions} />
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MiniStat label="Unités" value={sevenDayTotals.units.toLocaleString('fr-FR')} />
                    <MiniStat label="Ventes" value={sevenDayTotals.orders.toLocaleString('fr-FR')} />
                    <MiniStat label="CA" value={fmt(sevenDayTotals.revenue)} />
                  </div>
                </div>

                {/* Recent sales */}
                <div>
                  <p className="fui-subtitle2 mb-4" style={{ color: 'var(--colorNeutralForeground1)' }}>
                    Ventes récentes
                  </p>
                  {salesHistoryLoading ? (
                    <LoadingSkeleton rows={3} />
                  ) : salesHistoryError ? (
                    <p className="fui-caption1" style={{ color: 'var(--colorStatusDangerForeground1)' }}>{salesHistoryError}</p>
                  ) : salesHistory.length === 0 ? (
                    <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucune vente récente</p>
                  ) : (
                    <div className="space-y-2">
                      {salesHistory.slice(0, 5).map((sale) => (
                        <Link
                          key={sale.saleId}
                          to={`/sales/${sale.saleId}`}
                          className="flex items-center justify-between rounded-[var(--radiusLarge)] px-3 py-2.5 transition-colors"
                          style={{ border: '1px solid var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground1)' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--colorNeutralBackground2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'var(--colorNeutralBackground1)'}
                        >
                          <div className="min-w-0">
                            <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>
                              {sale.clientName || 'Client inconnu'}
                            </p>
                            <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                              {sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('fr-FR') : '—'}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <div className="text-right">
                              <span className="fui-caption1-strong block" style={{ color: 'var(--colorNeutralForeground2)' }}>
                                {sale.quantity} u
                              </span>
                              {canSeeFinancials && showProfitSections && sale.profit != null && (
                                <span className="fui-caption2 block" style={{ color: sale.profit >= 0 ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
                                  {sale.profit >= 0 ? '+' : ''}{fmt(sale.profit)}
                                </span>
                              )}
                            </div>
                            <ExternalLink size={13} style={{ color: 'var(--colorBrandForeground1)' }} />
                          </div>
                        </Link>
                      ))}
                      <button
                        type="button"
                        onClick={openBuyersModal}
                        className="ms-button ms-button-secondary ms-button-sm w-full mt-1"
                      >
                        Voir tous les acheteurs
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── JOURNAL ── */}
            {activeTab === 'journal' && (
              <div className="space-y-4">
                <div>
                  <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>
                    Journal de mise à jour du produit
                  </p>
                  <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                    Historique des créations, modifications, ajustements de stock et ventes enregistrés sur cette fiche.
                  </p>
                </div>

                {Array.isArray(stats.activities) && stats.activities.length > 0 ? (
                  <ul className="space-y-3">
                    {stats.activities.map((activity, index) => (
                      <ActivityJournalItem key={activity._id || `${activity.timestamp || 'activity'}-${index}`} activity={activity} />
                    ))}
                  </ul>
                ) : (
                  <EmptyState title="Aucun journal disponible" description="Aucune activité n'a encore été enregistrée pour ce produit." />
                )}
              </div>
            )}

            {/* ── ANALYSE FINANCIÈRE ── */}
            {activeTab === 'financial' && (
              <div className="space-y-5">
                <div className="grid sm:grid-cols-3 gap-4">
                  <FinCard label="Prix de vente" value={fmt(product.price)} />
                  {canSeeFinancials && showProfitSections ? (
                    <>
                      <FinCard label="Prix de revient" value={fmt(product.costPrice)} />
                      <FinCard label="Bénéfice unitaire" value={fmt(absoluteProfit)} tone="success" />
                    </>
                  ) : (
                    <div className="sm:col-span-2 rounded-[var(--radiusLarge)] p-5 flex items-center gap-3" style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}>
                      <EyeOff size={18} style={{ color: 'var(--colorNeutralForeground3)' }} />
                      <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                        Les données de marge sont masquées.
                      </p>
                    </div>
                  )}
                </div>

                {showRealizedProfit && (
                  <div>
                    <p className="fui-subtitle2 mb-1" style={{ color: 'var(--colorNeutralForeground1)' }}>
                      Bénéfice réel réalisé (ventes effectuées)
                    </p>
                    <p className="fui-caption1 mb-3" style={{ color: 'var(--colorNeutralForeground3)' }}>
                      Calculé à partir du bénéfice enregistré au moment de chaque vente (prix réel − coût).
                    </p>
                    <div className="grid sm:grid-cols-3 gap-4">
                      <FinCard label="Bénéfice réel total" value={fmt(stats.totalProfit)} tone="success" />
                      <FinCard label="Unités vendues" value={toNumber(stats.totalUnitsSold).toLocaleString('fr-FR')} />
                      <FinCard label="Bénéfice moyen / unité" value={fmt(stats.lifetimeAvgProfitPerUnit)} tone="success" />
                    </div>
                  </div>
                )}

                {canSeeFinancials && showProfitSections && (
                  <div
                    className="rounded-[var(--radiusLarge)] p-5"
                    style={{ background: 'var(--colorStatusInfoBackground1)', border: '1px solid rgba(15,108,189,0.2)' }}
                  >
                    <p className="fui-subtitle2 mb-2" style={{ color: 'var(--colorBrandForeground1)' }}>
                      Rentabilité du stock actuel
                    </p>
                    <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground2)' }}>
                      Si tout le stock ({product.stock} unités) est vendu au prix actuel, le bénéfice total estimé est de{' '}
                      <strong style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(absoluteProfit * product.stock)}</strong>.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── PERTES & CADEAUX ── */}
            {activeTab === 'losses' && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>Sorties de stock (hors vente)</p>
                    <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Casse, cadeaux, vol, péremption… Le coût est déduit du bénéfice net.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setLossForm({ reason: 'casse', quantity: '1', note: '' }); setLossModalOpen(true); }}
                    className="ms-button ms-button-primary ms-button-sm flex items-center gap-1.5 shrink-0"
                  >
                    <Plus size={14} /> Enregistrer
                  </button>
                </div>

                {lossLoading ? (
                  <LoadingSkeleton rows={3} />
                ) : lossMovements.length === 0 ? (
                  <EmptyState title="Aucune perte ni cadeau" description="Aucune sortie de stock hors vente enregistrée pour ce produit." />
                ) : (
                  <ul className="space-y-2">
                    {lossMovements.map((m) => (
                      <li
                        key={m._id}
                        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radiusLarge)] p-3"
                        style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}
                      >
                        <div className="min-w-0">
                          <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
                            {lossReasonLabel(m.reason)} · {m.quantity} u
                          </p>
                          <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                            {m.createdAt ? new Date(m.createdAt).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                            {m.user?.name ? ` · ${m.user.name}` : ''}{m.note ? ` · ${m.note}` : ''}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {canSeeFinancials && m.costImpact > 0 && (
                            <span className="fui-caption1-strong" style={{ color: 'var(--colorStatusDangerForeground1)' }}>−{fmt(m.costImpact)}</span>
                          )}
                          <button type="button" onClick={() => undoLoss(m._id)} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1">
                            <RotateCcw size={13} /> Annuler
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

</div>
        </div>
      </div>

      {/* ══ MODAL: PERTE / CADEAU ══ */}
      <Modal isOpen={lossModalOpen} onClose={() => setLossModalOpen(false)} title="Enregistrer une sortie de stock" subtitle="Casse, cadeau, vol, péremption…" size="sm">
        <form onSubmit={submitLoss} className="space-y-4">
          <div>
            <label className="form-label mb-1 block">Motif</label>
            <select className="form-control" value={lossForm.reason} onChange={(e) => setLossForm((f) => ({ ...f, reason: e.target.value }))}>
              {LOSS_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label mb-1 block">Quantité</label>
            <input type="number" min="1" inputMode="numeric" className="form-control" value={lossForm.quantity} onChange={(e) => setLossForm((f) => ({ ...f, quantity: e.target.value }))} />
            <p className="fui-caption2 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>Stock actuel : {toNumber(product.stock)} u</p>
          </div>
          <div>
            <label className="form-label mb-1 block">Note (optionnel)</label>
            <input type="text" className="form-control" maxLength={300} value={lossForm.note} onChange={(e) => setLossForm((f) => ({ ...f, note: e.target.value }))} placeholder="Précisez si besoin…" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setLossModalOpen(false)} className="ms-button ms-button-secondary ms-button-md">Annuler</button>
            <button type="submit" disabled={lossSubmitting} className="ms-button ms-button-primary ms-button-md disabled:opacity-60">
              {lossSubmitting ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ══ MODAL: IMAGE ZOOM ══ */}
      <Modal isOpen={imageZoom} onClose={() => setImageZoom(false)} title={product?.name || 'Image'} size="lg">
        <div className="flex flex-col items-center gap-4">
          <img
            src={activeImage || product?.image || '/placeholder.png'}
            alt={product?.name}
            className="max-h-[70vh] w-auto max-w-full rounded-[var(--radiusLarge)] object-contain"
            style={{ border: '1px solid var(--colorNeutralStroke2)' }}
          />
          {gallery.length > 1 && (
            <div className="flex flex-wrap justify-center gap-2">
              {gallery.map((img) => {
                const isActive = img.url === (activeImage || product?.image);
                return (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => setActiveImage(img.url)}
                    className="h-16 w-16 overflow-hidden rounded-[var(--radiusMedium)]"
                    style={{ border: isActive ? '2px solid var(--ms-blue)' : '1px solid var(--colorNeutralStroke2)' }}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      {/* ══ MODAL: QR CODE ══ */}
      <Modal isOpen={showQRCode} onClose={() => setShowQRCode(false)} title="QR Code du produit" size="sm">
        <div className="flex flex-col items-center gap-4 py-2">
          {/* Mode toggle: scan-to-sell vs view product */}
          <div className="grid w-full grid-cols-2 gap-1 rounded-[var(--radiusLarge)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground2)] p-1">
            {[
              { key: 'sell', label: 'Vente rapide' },
              { key: 'view', label: 'Fiche produit' },
            ].map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setQrMode(m.key)}
                className={`min-h-[36px] rounded-[var(--radiusMedium)] text-sm font-semibold transition-colors ${qrMode === m.key ? 'bg-[var(--ms-blue)] text-white' : 'text-[var(--ms-text-muted)] hover:text-[var(--ms-text)]'}`}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div ref={qrCodeRef} className="p-4 rounded-[var(--radiusXLarge)] bg-white" style={{ border: '1px solid var(--colorNeutralStroke2)' }}>
            <QRCode value={qrValue} size={180} />
          </div>
          <p className="fui-caption1 text-center" style={{ color: 'var(--colorNeutralForeground3)' }}>
            {qrMode === 'sell'
              ? 'Scannez pour démarrer une vente avec ce produit déjà ajouté.'
              : 'Scannez pour ouvrir la fiche du produit.'}
          </p>
          <div className="flex w-full flex-col gap-2 sm:flex-row">
            <button onClick={downloadQRCode} className="ms-button ms-button-primary ms-button-md flex-1 justify-center">
              <FileDown size={16} /> Télécharger
            </button>
            <button onClick={() => setShowQRCode(false)} className="ms-button ms-button-secondary ms-button-md flex-1 justify-center">
              Fermer
            </button>
          </div>
        </div>
      </Modal>

      {/* ══ MODAL: ACHETEURS ══ */}
      <Modal
        isOpen={buyersModalOpen}
        onClose={() => setBuyersModalOpen(false)}
        title="Acheteurs du produit"
        size="md"
        footer={
          <button onClick={() => setBuyersModalOpen(false)} className="ms-button ms-button-secondary ms-button-md">
            Fermer
          </button>
        }
      >
        <div className="overflow-auto rounded-[var(--radiusLarge)]" style={{ border: '1px solid var(--colorNeutralStroke2)' }}>
          {buyersLoading && <div className="p-6 fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>Chargement…</div>}
          {!buyersLoading && buyersError && <div className="p-6 fui-body1" style={{ color: 'var(--colorStatusDangerForeground1)' }}>{buyersError}</div>}
          {!buyersLoading && !buyersError && buyersSales.length === 0 && <div className="p-6 fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucun acheteur trouvé</div>}
          {!buyersLoading && !buyersError && buyersSales.length > 0 && (
            <table ref={buyersTableRef} className="responsive-table w-full text-sm">
              <thead style={{ background: 'var(--colorNeutralBackground2)' }}>
                <tr>
                  {['Client', 'Date', 'Statut', 'Qté', 'Total', ...(showRealizedProfit ? ['Bénéfice'] : []), ''].map((h) => (
                    <th key={h} className={`px-4 py-3 text-left fui-caption1-strong ${h === 'Qté' || h === 'Total' || h === 'Bénéfice' ? 'text-right' : ''}`} style={{ color: 'var(--colorNeutralForeground3)', borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {buyersSales.map((sale) => (
                  <tr key={sale.saleId} style={{ borderBottom: '1px solid var(--colorNeutralStroke2)' }}>
                    <td className="px-4 py-3 fui-body1" style={{ color: 'var(--colorNeutralForeground1)' }}>{sale.clientName || 'Inconnu'}</td>
                    <td className="px-4 py-3 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                      {sale.saleDate ? new Date(sale.saleDate).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`ms-status-badge ms-status-${sale.status === 'paid' ? 'success' : sale.status === 'pending' ? 'warning' : 'neutral'}`}>
                        {sale.status || 'pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3 fui-body1 text-right" style={{ color: 'var(--colorNeutralForeground2)' }}>{sale.quantity}</td>
                    <td className="px-4 py-3 fui-body1-strong text-right" style={{ color: 'var(--colorNeutralForeground1)' }}>{fmt(sale.totalAmount)}</td>
                    {showRealizedProfit && (
                      <td className="px-4 py-3 fui-body1-strong text-right" style={{ color: sale.profit >= 0 ? 'var(--colorStatusSuccessForeground1)' : 'var(--colorStatusDangerForeground1)' }}>
                        {sale.profit != null ? `${sale.profit >= 0 ? '+' : ''}${fmt(sale.profit)}` : '—'}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <Link to={`/sales/${sale.saleId}`} className="ms-button ms-button-secondary ms-button-sm flex items-center gap-1 ml-auto w-fit">
                        <ExternalLink size={12} />
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Modal>

      {/* ══ MODAL: ADMIN REQUEST ══ */}
      <Modal
        isOpen={Boolean(requestModal)}
        onClose={() => setRequestModal(null)}
        title={requestModal === 'price' ? 'Demander changement de prix' : 'Demander ajustement de stock'}
        subtitle="La demande sera transmise à un administrateur."
        size="sm"
        footer={
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setRequestModal(null)} className="ms-button ms-button-secondary ms-button-md">
              Annuler
            </button>
            <button
              type="button"
              onClick={submitAdminRequest}
              disabled={requestSubmitting || !requestReason.trim() || requestValue === ''}
              className="ms-button ms-button-primary ms-button-md"
            >
              {requestSubmitting ? 'Envoi...' : 'Envoyer la demande'}
            </button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="form-label mb-2 block">
              {requestModal === 'price' ? 'Nouveau prix proposé (CFA)' : 'Stock cible proposé'}
            </label>
            <input
              type="number"
              min="0"
              value={requestValue}
              onChange={(e) => setRequestValue(e.target.value)}
              className="form-control"
              placeholder={requestModal === 'price' ? 'Ex : 45000' : 'Ex : 50'}
            />
          </div>
          <div>
            <label className="form-label mb-2 block">Raison (obligatoire)</label>
            <textarea
              value={requestReason}
              onChange={(e) => setRequestReason(e.target.value)}
              rows={4}
              maxLength={600}
              className="form-control"
              placeholder="Expliquez pourquoi cette modification est nécessaire..."
            />
          </div>
        </div>
      </Modal>
    </Workspace>
  );
};

/* ─── local sub-components ─── */
const TONE_STYLES = {
  brand:   { bg: 'var(--ms-blue-soft)',                    color: 'var(--colorBrandBackground)' },
  success: { bg: 'var(--colorStatusSuccessBackground1)',   color: 'var(--colorStatusSuccessForeground1)' },
  warning: { bg: 'var(--colorStatusWarningBackground1)',   color: 'var(--colorStatusWarningForeground1)' },
  danger:  { bg: 'var(--colorStatusDangerBackground1)',    color: 'var(--colorStatusDangerForeground1)' },
  neutral: { bg: 'var(--colorNeutralBackground3)',         color: 'var(--colorNeutralForeground3)' },
};

const KPICard = ({ icon, label, value, tone = 'neutral' }) => {
  const t = TONE_STYLES[tone] || TONE_STYLES.neutral;
  return (
    <div className="ms-kpi-card">
      <div>
        <p className="ms-kpi-title">{label}</p>
        <p className="ms-kpi-value">{value}</p>
      </div>
      <div className="ms-kpi-icon" style={{ background: t.bg, color: t.color }}>
        {icon}
      </div>
    </div>
  );
};

const MiniStat = ({ label, value }) => (
  <div
    className="rounded-[var(--radiusMedium)] px-3 py-2"
    style={{ background: 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}
  >
    <p className="fui-caption2 uppercase" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</p>
    <p className="fui-caption1-strong mt-0.5" style={{ color: 'var(--colorNeutralForeground1)' }}>{value}</p>
  </div>
);

const formatActivityValue = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'number') return value.toLocaleString('fr-FR');
  if (typeof value === 'boolean') return value ? 'Oui' : 'Non';
  return String(value);
};

const ActivityJournalItem = ({ activity }) => {
  const meta = ACTIVITY_META[activity.type] || ACTIVITY_META.default;
  const Icon = meta.icon;
  const userLabel = activity.user?.name || activity.user?.email || 'Utilisateur';
  const hasFieldChange = activity.oldValue !== undefined || activity.newValue !== undefined;

  return (
    <li
      className="flex gap-3 rounded-[var(--radiusLarge)] p-3"
      style={{ background: 'var(--colorNeutralBackground1)', border: '1px solid var(--colorNeutralStroke2)' }}
    >
      <span
        className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: meta.bg, color: meta.color }}
      >
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="fui-body1-strong" style={{ color: 'var(--colorNeutralForeground1)' }}>
            {activity.description || 'Modification du produit'}
          </p>
          <span className="fui-caption2 shrink-0" style={{ color: 'var(--colorNeutralForeground3)' }}>
            {fmtDate(activity.timestamp)}
          </span>
        </div>
        <p className="fui-caption1 mt-1 flex items-center gap-1.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
          <User size={12} /> {userLabel}
        </p>
        {hasFieldChange && (
          <div className="mt-2 rounded-[var(--radiusMedium)] px-3 py-2 fui-caption1" style={{ background: 'var(--colorNeutralBackground2)', color: 'var(--colorNeutralForeground2)' }}>
            <span>{formatActivityValue(activity.oldValue)}</span>
            <span className="mx-2">→</span>
            <span className="font-semibold">{formatActivityValue(activity.newValue)}</span>
          </div>
        )}
      </div>
    </li>
  );
};

const FinCard = ({ label, value, tone }) => {
  const t = tone ? TONE_STYLES[tone] : null;
  return (
    <div
      className="rounded-[var(--radiusLarge)] p-5"
      style={{ background: t ? t.bg : 'var(--colorNeutralBackground2)', border: '1px solid var(--colorNeutralStroke2)' }}
    >
      <p className="fui-caption1-strong mb-2" style={{ color: t ? t.color : 'var(--colorNeutralForeground3)' }}>
        {label}
      </p>
      <p className="fui-title3" style={{ color: t ? t.color : 'var(--colorNeutralForeground1)' }}>
        {value}
      </p>
    </div>
  );
};

export default ProductDetails;
