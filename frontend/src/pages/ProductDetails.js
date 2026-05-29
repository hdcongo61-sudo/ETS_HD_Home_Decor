import React, { useState, useContext, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import QRCode from 'react-qr-code';
import { Line } from 'react-chartjs-2';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import 'chart.js/auto';
import { productEditPath, productPath } from '../utils/paths';
import AppLoader from '../components/AppLoader';
import AuthContext from '../context/AuthContext';
import Modal from '../components/Modal';

/* ===================================================== */
/* 🧩 UTILITAIRES DE FORMATTAGE */
/* ===================================================== */
const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const formatCurrency = (v) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(
    toNumber(v)
  );

/* ===================================================== */
/* 🧮 STRUCTURE DE BASE DES STATS */
/* ===================================================== */
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

/* ===================================================== */
/* 🏆 PAGE PRINCIPALE */
/* ===================================================== */
const ProductDetails = () => {
  const { id } = useParams();
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin || auth?.isAdmin);
  const userPermissions = Array.isArray(auth?.user?.permissions) ? auth.user.permissions : [];
  const navigate = useNavigate();
  const location = useLocation();
  const [product, setProduct] = useState(null);
  const [stats, setStats] = useState(buildStatsSkeleton());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showQRCode, setShowQRCode] = useState(false);
  const [showProfitSections, setShowProfitSections] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [salesHistory, setSalesHistory] = useState([]);
  const [salesHistoryLoading, setSalesHistoryLoading] = useState(false);
  const [salesHistoryError, setSalesHistoryError] = useState('');
  const [buyersModalOpen, setBuyersModalOpen] = useState(false);
  const [buyersLoading, setBuyersLoading] = useState(false);
  const [buyersError, setBuyersError] = useState('');
  const [buyersSales, setBuyersSales] = useState([]);
  const [requestModal, setRequestModal] = useState(null);
  const [requestReason, setRequestReason] = useState('');
  const [requestValue, setRequestValue] = useState('');
  const [requestSubmitting, setRequestSubmitting] = useState(false);
  const qrCodeRef = useRef();
  const pageRef = useRef();

  useEffect(() => {
    const fetchProductAndStats = async () => {
      setLoading(true);
      setStatsLoading(true);
      try {
        const res = await api.get(`/products/${id}`);
        setProduct(res.data);
        const statsRes = await api.get(`/products/${id}/stats?range=month`);
        setStats({ ...buildStatsSkeleton(res.data), ...statsRes.data });
      } catch (err) {
        console.error('Error loading product details:', err);
      } finally {
        setLoading(false);
        setStatsLoading(false);
      }
    };

    const fetchSalesHistoryData = async () => {
      setSalesHistoryLoading(true);
      setSalesHistoryError('');
      try {
        const { data } = await api.get(`/products/${id}/sales-history?limit=5`);
        setSalesHistory(data.sales || []);
      } catch (error) {
        console.error('Error fetching product sales history:', error);
        setSalesHistory([]);
        setSalesHistoryError('Impossible de charger les ventes liées');
      } finally {
        setSalesHistoryLoading(false);
      }
    };

    fetchProductAndStats();
    fetchSalesHistoryData();
  }, [id]);

  const canSeeFinancials = isAdmin || userPermissions.includes('view_sensitive_financials');
  const canSeeSupplierContacts = isAdmin || userPermissions.includes('view_supplier_contacts');
  const profitMargin =
    product?.costPrice && product?.price
      ? ((product.price - product.costPrice) / product.costPrice) * 100
      : null;
  const absoluteProfit =
    product?.costPrice && product?.price ? product.price - product.costPrice : 0;

  const productUrl = `${window.location.origin}${productPath(product || id)}`;
  const returnToProducts = location.state?.returnToProducts || '/products';

  const openBuyersModal = async () => {
    setBuyersModalOpen(true);
    if (buyersLoading || buyersSales.length > 0) return;

    setBuyersLoading(true);
    setBuyersError('');
    try {
      const { data } = await api.get(`/products/${id}/sales-history?limit=200`);
      setBuyersSales(data.sales || []);
    } catch (error) {
      console.error('Error fetching buyers list:', error);
      setBuyersSales([]);
      setBuyersError('Impossible de charger la liste des acheteurs');
    } finally {
      setBuyersLoading(false);
    }
  };

  const closeBuyersModal = () => setBuyersModalOpen(false);

  const openAdminRequest = (type) => {
    setRequestModal(type);
    setRequestReason('');
    setRequestValue('');
  };

  const submitAdminRequest = async () => {
    if (!requestModal || requestSubmitting) return;
    if (!requestReason.trim()) {
      return;
    }

    const numericValue = requestValue === '' ? null : Number(requestValue);
    if (requestModal !== 'other' && (numericValue === null || Number.isNaN(numericValue))) {
      return;
    }

    const metadata = { productId: product._id };
    let type = 'other';
    let targetLabel = product.name;
    let note = '';

    if (requestModal === 'price') {
      type = 'product.price_change';
      metadata.oldPrice = product.price;
      metadata.newPrice = numericValue;
      targetLabel = `Prix produit: ${product.name}`;
      note = `Nouveau prix proposé: ${formatCurrency(numericValue)}`;
    } else if (requestModal === 'stock') {
      type = 'stock.adjustment';
      metadata.currentStock = product.stock;
      metadata.targetStock = numericValue;
      targetLabel = `Stock produit: ${product.name}`;
      note = `Stock cible proposé: ${numericValue}`;
    }

    try {
      setRequestSubmitting(true);
      await api.post('/admin-requests', {
        type,
        targetModel: 'Product',
        targetId: product._id,
        targetLabel,
        reason: requestReason.trim(),
        note,
        metadata,
      });
      setRequestModal(null);
      setRequestReason('');
      setRequestValue('');
    } finally {
      setRequestSubmitting(false);
    }
  };

  /* ===================================================== */
  /* 📦 EXPORT PDF */
  /* ===================================================== */
  const handleExportPDF = async () => {
    const input = pageRef.current;
    const canvas = await html2canvas(input, { scale: 2 });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const width = pdf.internal.pageSize.getWidth();
    const height = (canvas.height * width) / canvas.width;
    pdf.addImage(imgData, 'PNG', 0, 0, width, height);
    pdf.save(`Fiche_${product.name.replace(/\s+/g, '_')}.pdf`);
  };

  /* ===================================================== */
  /* 📊 MINI GRAPH (FAKE DEMO) */
  /* ===================================================== */
  const salesTrendData = {
    labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
    datasets: [
      {
        label: 'Ventes',
        data: [5, 8, 3, 10, 6, 9, 7],
        borderColor: '#6366F1',
        backgroundColor: 'rgba(99,102,241,0.1)',
        fill: true,
        tension: 0.4,
      },
    ],
  };

  if (loading)
    return (
      <div className="flex justify-center items-center h-screen">
        <AppLoader fullScreen={false} text="Chargement du produit…" />
      </div>
    );

  if (!product)
    return (
      <div className="text-center py-16">
        <h2 className="text-gray-600">Produit introuvable</h2>
        <button
          onClick={() => navigate(returnToProducts)}
          className="mt-4 px-4 py-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600"
        >
          Retour à la liste
        </button>
      </div>
    );

    const getActivityColor = (type) => {
  switch (type) {
    case 'creation':
      return 'bg-green-100 text-green-700';
    case 'adjustment':
      return 'bg-blue-100 text-blue-700';
    case 'stock_update':
      return 'bg-purple-100 text-purple-700';
    case 'price_update':
      return 'bg-yellow-100 text-yellow-700';
    case 'sale':
      return 'bg-indigo-100 text-indigo-700';
    case 'return':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
};

const getActivityIcon = (type) => {
  switch (type) {
    case 'creation':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    case 'adjustment':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5h2m-1 0v14m0-14L5 19m7-14l7 14" />
        </svg>
      );
    case 'stock_update':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3v18h18" />
        </svg>
      );
    case 'price_update':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v8m0 0l3-3m-3 3l-3-3" />
        </svg>
      );
    case 'sale':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      );
    case 'return':
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4" />
        </svg>
      );
    default:
      return (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01" />
        </svg>
      );
  }
};


  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      <div className="max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8" ref={pageRef}>
        {/* 🧭 HEADER */}
        <div className="mb-6 overflow-hidden rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <button
            onClick={() => navigate(returnToProducts)}
            className="inline-flex w-fit items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3.5 py-2 text-sm font-semibold text-gray-700 transition hover:bg-white hover:text-gray-950"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Retour
          </button>

          <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:grid-cols-none sm:flex sm:flex-wrap sm:justify-end">
            {canSeeFinancials && (
            <button
              onClick={() => setShowProfitSections((prev) => !prev)}
              className="col-span-2 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 sm:col-span-1 sm:min-h-[44px] sm:px-4 sm:py-2"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {showProfitSections ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.542-7 1.004-3.196 3.565-5.675 6.73-6.588M15 12a3 3 0 11-6 0 3 3 0 016 0zm6.364 6.364L3.636 5.636" />
                ) : (
                  <>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </>
                )}
              </svg>
              <span className="sm:hidden">{showProfitSections ? 'Masquer marge' : 'Afficher marge'}</span>
              <span className="hidden sm:inline">{showProfitSections ? 'Masquer bénéfice' : 'Afficher bénéfice'}</span>
            </button>
            )}
            {isAdmin && (
              <button
                onClick={handleExportPDF}
                className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(15,23,42,0.18)] transition hover:bg-gray-800 sm:min-h-[44px] sm:px-4 sm:py-2"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Export PDF
              </button>
            )}

            <button
              onClick={() => setShowQRCode(true)}
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 sm:min-h-[44px] sm:px-3 sm:py-2"
              title="QR Code"
            >
              <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 3h7v7H3V3zm0 11h7v7H3v-7zm11-11h7v7h-7V3zm0 11h7v7h-7v-7z"
                />
              </svg>
              <span className="sm:hidden">QR Code</span>
            </button>
            {isAdmin && (
            <button
              onClick={() =>
                navigate(productEditPath(product || id), {
                  state: { returnTo: productPath(product || id) },
                })
              }
              className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 sm:min-h-[44px] sm:px-4 sm:py-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifier
            </button>
            )}
            {!isAdmin && (
              <>
                <button
                  type="button"
                  onClick={() => openAdminRequest('price')}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700 shadow-sm transition hover:bg-amber-100 sm:min-h-[44px] sm:rounded-xl sm:px-4 sm:py-2"
                >
                  Demander prix
                </button>
                <button
                  type="button"
                  onClick={() => openAdminRequest('stock')}
                  className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700 shadow-sm transition hover:bg-blue-100 sm:min-h-[44px] sm:rounded-xl sm:px-4 sm:py-2"
                >
                  Demander stock
                </button>
              </>
            )}
          </div>
        </div>
        </div>

        {/* 🖼️ PRODUIT HEADER */}
        <div className="flex flex-col gap-6 rounded-[28px] border border-white/80 bg-white/95 p-4 shadow-[0_16px_50px_rgba(15,23,42,0.06)] md:flex-row md:p-6">
          <div className="md:w-1/2">
            <img
              src={product.image || '/placeholder.png'}
              alt={product.name}
              className="aspect-[4/3] max-h-96 w-full rounded-[24px] border border-gray-100 bg-gray-50 object-cover shadow-sm"
            />
            {canSeeFinancials && showProfitSections && profitMargin > 0 && (
              <div className="mt-3 inline-flex px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
                +{profitMargin.toFixed(1)}% marge
              </div>
            )}
          </div>

          <div className="flex flex-col justify-between md:w-1/2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gray-500">Fiche produit</p>
              <h1 className="mb-2 text-3xl font-semibold tracking-tight text-gray-950">{product.name}</h1>
              <p className="mb-4 text-sm leading-6 text-gray-500">{product.description || 'Aucune description enregistrée.'}</p>

              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl font-bold tracking-tight text-gray-950">
                  {formatCurrency(product.price)}
                </span>
                {canSeeFinancials && showProfitSections && product.costPrice && (
                  <span className="text-sm text-gray-500">Coût: {formatCurrency(product.costPrice)}</span>
                )}
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                    product.stock < 5
                      ? 'border-red-100 bg-red-50 text-red-700'
                      : product.stock < 15
                      ? 'border-yellow-100 bg-yellow-50 text-yellow-700'
                      : 'border-green-100 bg-green-50 text-green-700'
                  }`}
                >
                  {product.stock} en stock
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                  Conteneur: {product.container?.trim() || 'Non defini'}
                </span>
                <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700">
                  Entrepot: {product.warehouse?.trim() || 'Non defini'}
                </span>
                {product.stock > 20 && (
                  <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    Top Seller
                  </span>
                )}
              </div>

              {product.supplierName && (
                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm">
                  <p className="text-gray-700 font-medium mb-1">Fournisseur :</p>
                  <p className="text-gray-600">{product.supplierName}</p>
                  {canSeeSupplierContacts && product.supplierPhone && (
                    <p className="text-gray-500 text-sm">{product.supplierPhone}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 🧭 ONGLETS */}
        <div className="mt-6">
          <div className="flex gap-2 overflow-x-auto rounded-[22px] border border-white/80 bg-white/90 p-2 shadow-sm">
            {['overview', 'financial', 'history'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`min-h-[42px] shrink-0 rounded-2xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab
                    ? 'bg-gray-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.16)]'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                {tab === 'overview'
                  ? 'Aperçu'
                  : tab === 'financial'
                  ? 'Analyse financière'
                  : 'Historique'}
              </button>
            ))}
          </div>
        </div>

        {/* 🧱 CONTENU ONGLET */}
        <div className="mt-6">
          {activeTab === 'overview' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Performance des ventes</h3>
                <Line data={salesTrendData} height={150} />
              </div>

              <div className="bg-white rounded-xl p-5 shadow-sm">
                <h3 className="text-lg font-semibold mb-3 text-gray-800">Indicateurs clés</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <Metric
                    label="Unités vendues"
                    value={stats.totalUnitsSold}
                    footer={
                      <SalesLinks
                        sales={salesHistory}
                        loading={salesHistoryLoading}
                        error={salesHistoryError}
                        onViewAll={openBuyersModal}
                      />
                    }
                  />
                  <Metric label="CA total" value={formatCurrency(stats.totalRevenue)} />
                  {canSeeFinancials && showProfitSections && (
                    <Metric label="Bénéfice total" value={formatCurrency(stats.totalProfit)} />
                  )}
                  <Metric label="Valeur du stock" value={formatCurrency(stats.stock.stockValue)} />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'financial' && (
            <div className="grid md:grid-cols-3 gap-5">
              <Card title="Prix de vente">{formatCurrency(product.price)}</Card>
              {canSeeFinancials && showProfitSections && (
                <>
                  <Card title="Prix de revient">{formatCurrency(product.costPrice)}</Card>
                  <Card title="Bénéfice unitaire">{formatCurrency(absoluteProfit)}</Card>

                  <div className="md:col-span-3 bg-indigo-50 rounded-xl p-5 border border-indigo-200">
                    <h4 className="font-semibold text-indigo-700 mb-2">Rentabilité du stock</h4>
                    <p className="text-gray-700 text-sm">
                      Si tout le stock est vendu à ce prix, le bénéfice total estimé est de{' '}
                      <strong>{formatCurrency(absoluteProfit * product.stock)}</strong>.
                    </p>
                  </div>
                </>
              )}
              {canSeeFinancials && !showProfitSections && (
                <div className="md:col-span-2 bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <h4 className="font-semibold text-gray-700 mb-2">Sections bénéfice masquées</h4>
                  <p className="text-gray-600 text-sm">
                    Les informations de marge, bénéfice et prix de revient sont actuellement cachées sur cette page.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'history' && (
  <div className="space-y-6">
    {/* Dates importantes */}
    <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-3">Informations clés</h3>
      <div className="space-y-4 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Créé le :</span>
          <span className="font-medium text-gray-900">
            {new Date(product.createdAt).toLocaleDateString('fr-FR')} à{' '}
            {new Date(product.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Dernière modification :</span>
          <span className="font-medium text-gray-900">
            {new Date(product.updatedAt).toLocaleDateString('fr-FR')} à{' '}
            {new Date(product.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Créé par :</span>
          <span className="font-medium text-gray-900">
            {product.createdBy?.name || '—'}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-600">Modifié par :</span>
          <span className="font-medium text-gray-900">
            {product.updatedBy?.name || '—'}
          </span>
        </div>
      </div>
    </div>

    {/* Activités récentes */}
    <div className="bg-white p-5 rounded-xl border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
        <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Activité récente
      </h3>

      {statsLoading ? (
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="space-y-3">
          {stats.activities && stats.activities.length > 0 ? (
            [...stats.activities]
              .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
              .map((activity, index) => (
                <div
                  key={index}
                  className="flex items-start bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-all border border-gray-200"
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getActivityColor(activity.type)}`}>
                    {getActivityIcon(activity.type)}
                  </div>

                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>

                    {activity.oldValue !== undefined && activity.newValue !== undefined && (
                      <p className="text-sm text-gray-600">
                        <span className="text-red-500 line-through mr-1">
                          {String(activity.oldValue)}
                        </span>
                        →
                        <span className="text-green-600 ml-1">{String(activity.newValue)}</span>
                      </p>
                    )}

                    {activity.user?.name && (
                      <p className="text-xs text-gray-500 mt-1">
                        👤 Par <span className="font-medium">{activity.user.name}</span>
                      </p>
                    )}

                    <p className="text-xs text-gray-400 mt-1">
                      🕓 {new Date(activity.timestamp).toLocaleDateString('fr-FR')} à{' '}
                      {new Date(activity.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
              ))
          ) : (
            <p className="text-sm text-gray-500">Aucune activité enregistrée</p>
          )}
        </div>
      )}
    </div>
  </div>
)}

        </div>
      </div>

      {/* 🧾 MODALE QR CODE */}
      <Modal
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
        title="QR Code du produit"
        size="sm"
      >
            <div className="flex justify-center">
              <div ref={qrCodeRef} className="p-3 bg-white">
                <QRCode value={productUrl} size={200} />
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4 text-center">
              Scannez ce code pour ouvrir la page du produit
            </p>
            <div className="flex justify-center mt-4 space-x-3">
              <button
                onClick={() => setShowQRCode(false)}
                className="form-button-secondary"
              >
                Fermer
              </button>
            </div>
      </Modal>

      {/* 👥 MODALE ACHETEURS */}
      <Modal
        isOpen={buyersModalOpen}
        onClose={closeBuyersModal}
        title="Acheteurs du produit"
        size="md"
        footer={
          <button onClick={closeBuyersModal} className="form-button-secondary">
            Fermer
          </button>
        }
      >

            <div className="flex-1 overflow-auto border border-gray-100 rounded-xl">
              {buyersLoading && (
                <div className="p-6 text-sm text-gray-500">Chargement…</div>
              )}

              {!buyersLoading && buyersError && (
                <div className="p-6 text-sm text-red-500">{buyersError}</div>
              )}

              {!buyersLoading && !buyersError && buyersSales.length === 0 && (
                <div className="p-6 text-sm text-gray-500">Aucun acheteur trouvé</div>
              )}

              {!buyersLoading && !buyersError && buyersSales.length > 0 && (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left font-medium px-4 py-3">Client</th>
                      <th className="text-left font-medium px-4 py-3">Date</th>
                      <th className="text-left font-medium px-4 py-3">Statut</th>
                      <th className="text-right font-medium px-4 py-3">Qté</th>
                      <th className="text-right font-medium px-4 py-3">Total</th>
                      <th className="text-right font-medium px-4 py-3">Vente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buyersSales.map((sale) => (
                      <tr key={sale.saleId} className="border-t border-gray-100">
                        <td className="px-4 py-3 text-gray-800">{sale.clientName || 'Client inconnu'}</td>
                        <td className="px-4 py-3 text-gray-600">
                          {sale.saleDate
                            ? new Date(sale.saleDate).toLocaleDateString('fr-FR')
                            : 'Date inconnue'}
                        </td>
                        <td className="px-4 py-3 text-gray-700">
                          {sale.status || 'pending'}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{sale.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-900">
                          {formatCurrency(sale.totalAmount)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            to={`/sales/${sale.saleId}`}
                            className="text-indigo-600 hover:text-indigo-700 text-xs font-medium"
                          >
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

        <Modal
          isOpen={Boolean(requestModal)}
          onClose={() => setRequestModal(null)}
          title={requestModal === 'price' ? 'Demander changement de prix' : 'Demander ajustement stock'}
          subtitle="La demande sera envoyée à un administrateur."
          size="sm"
          footer={
            <>
              <button
                type="button"
                onClick={() => setRequestModal(null)}
                className="form-button-secondary"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={submitAdminRequest}
                disabled={requestSubmitting || !requestReason.trim() || requestValue === ''}
                className="form-button-primary"
              >
                {requestSubmitting ? 'Envoi...' : 'Envoyer'}
              </button>
            </>
          }
        >
              <div className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">
                    {requestModal === 'price' ? 'Nouveau prix proposé' : 'Stock cible proposé'}
                  </span>
                  <input
                    type="number"
                    min="0"
                    value={requestValue}
                    onChange={(event) => setRequestValue(event.target.value)}
                    className="form-control text-sm"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-700">Raison obligatoire</span>
                  <textarea
                    value={requestReason}
                    onChange={(event) => setRequestReason(event.target.value)}
                    rows={4}
                    maxLength={600}
                    className="form-control text-sm"
                    placeholder="Expliquez pourquoi cette modification est nécessaire..."
                  />
                </label>
              </div>
        </Modal>
    </div>
  );
};

/* ===================================================== */
/* 🧱 COMPOSANTS UTILITAIRES */
/* ===================================================== */
const Card = ({ title, children }) => (
  <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-100">
    <p className="text-sm text-gray-500 mb-1">{title}</p>
    <p className="text-lg font-semibold text-gray-800">{children}</p>
  </div>
);

const Metric = ({ label, value, footer = null }) => (
  <div>
    <p className="text-xs text-gray-500 mb-1">{label}</p>
    <p className="text-sm font-semibold text-gray-800">{value}</p>
    {footer && <div className="mt-1">{footer}</div>}
  </div>
);

const SalesLinks = ({ sales, loading, error, onViewAll }) => {
  if (loading) {
    return <p className="text-xs text-gray-400">Chargement des ventes...</p>;
  }

  if (error) {
    return <p className="text-xs text-red-500">{error}</p>;
  }

  if (!sales || sales.length === 0) {
    return <p className="text-xs text-gray-400">Aucune vente récente</p>;
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        {sales.slice(0, 3).map((sale) => {
          const formattedDate = sale.saleDate
            ? new Date(sale.saleDate).toLocaleDateString('fr-FR')
            : 'Date inconnue';
          return (
            <Link
              key={sale.saleId}
              to={`/sales/${sale.saleId}`}
              className="flex items-center justify-between text-xs text-indigo-600 hover:text-indigo-700"
            >
              <span className="truncate pr-2">
                {sale.clientName || 'Vente'} • {formattedDate}
              </span>
              <span className="text-gray-500 whitespace-nowrap">{sale.quantity} u</span>
            </Link>
          );
        })}
      </div>
      {onViewAll && sales.length > 0 && (
        <button
          type="button"
          onClick={onViewAll}
          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
        >
          Voir tous les acheteurs
        </button>
      )}
    </div>
  );
};

export default ProductDetails;
