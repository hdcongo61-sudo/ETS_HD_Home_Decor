// components/GlobalSaleModal.js
import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Loader2, ReceiptText, RefreshCw, Users, Boxes } from 'lucide-react';
import api from '../services/api';
import { useModal } from '../context/ModalContext';
import Modal from './Modal';
import SaleForm from './SaleForm';

const normalizeCollection = (value, nestedKeys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of nestedKeys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
};

const GlobalModalSkeleton = () => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-20 animate-pulse rounded-2xl border border-gray-200 bg-gray-100/80" />
      ))}
    </div>
    <div className="space-y-3 rounded-3xl border border-gray-200 bg-white p-4">
      <div className="h-4 w-36 animate-pulse rounded-full bg-gray-200" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-12 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-2xl bg-gray-100" />
    </div>
  </div>
);

const MetricPill = ({ icon, label, value }) => (
  <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
    <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
      {icon}
      {label}
    </div>
    <p className="mt-1 text-lg font-semibold text-gray-950">{value}</p>
  </div>
);

const GlobalSaleModal = () => {
  const { activeModal, closeModal } = useModal();
  const isOpen = activeModal === 'sale';
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSaleFormData = useCallback(async () => {
    setLoading(true);
    setLoadError('');

    try {
      const [clientsRes, productsRes] = await Promise.all([
        api.get('/clients'),
        api.get('/products', { params: { summary: 'list' } }),
      ]);

      setClients(normalizeCollection(clientsRes.data, ['clients', 'data']));
      setProducts(normalizeCollection(productsRes.data, ['products', 'data']));
    } catch (error) {
      console.error('Error loading sale modal data:', error);
      setClients([]);
      setProducts([]);
      setLoadError(
        error.response?.data?.message ||
          'Impossible de charger les clients et les produits.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    fetchSaleFormData();
  }, [fetchSaleFormData, isOpen]);

  const handleSubmit = async (payload) => {
    setIsSubmitting(true);

    try {
      await api.post('/sales', payload);
      closeModal();
      window.dispatchEvent(new CustomEvent('saleCreated'));
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={closeModal}
      title="Nouvelle vente"
      subtitle="Créer une vente complète sans quitter votre page actuelle."
      size="xl"
      mobileFullscreen
      icon={<ReceiptText size={20} />}
      contentClassName="bg-gray-50/80"
      footerClassName="bg-white/96"
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            disabled={isSubmitting}
            className="min-h-[44px] w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 sm:w-auto"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="global-sale-form"
            disabled={isSubmitting || loading}
            className={`min-h-[44px] w-full rounded-2xl px-4 py-3 font-semibold flex items-center justify-center gap-2 transition sm:w-auto ${
              isSubmitting || loading
                ? 'bg-gray-300 cursor-not-allowed text-gray-600'
                : 'bg-gray-950 hover:bg-gray-800 text-white shadow-sm'
            }`}
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Enregistrement...
              </>
            ) : (
              <>
                <Check size={18} />
                Enregistrer la vente
              </>
            )}
          </button>
        </>
      }
    >
      {loading ? (
        <GlobalModalSkeleton />
      ) : loadError ? (
        <div className="rounded-3xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <AlertCircle size={22} />
          </div>
          <h3 className="mt-4 text-base font-semibold text-gray-950">Chargement impossible</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-600">{loadError}</p>
          <button
            type="button"
            onClick={fetchSaleFormData}
            className="mt-5 inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
          >
            <RefreshCw size={16} />
            Réessayer
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricPill icon={<Users size={14} />} label="Clients" value={clients.length} />
            <MetricPill icon={<Boxes size={14} />} label="Produits" value={products.length} />
            <MetricPill icon={<ReceiptText size={14} />} label="Mode" value="Complet" />
            <MetricPill icon={<Check size={14} />} label="Stock" value="Automatique" />
          </div>

          <SaleForm
            clients={clients}
            products={products}
            onSubmit={handleSubmit}
            formId="global-sale-form"
            hideSubmit
          />
        </div>
      )}
    </Modal>
  );
};

export default GlobalSaleModal;
