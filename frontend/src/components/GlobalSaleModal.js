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
        <div key={item} className="h-[72px] animate-pulse rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)]" />
      ))}
    </div>
    <div className="space-y-3 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-white)] p-4">
      <div className="h-4 w-36 animate-pulse rounded-full bg-[var(--ms-bg-subtle)]" />
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="h-12 animate-pulse rounded-[var(--radiusMedium)] bg-[var(--ms-bg-subtle)]" />
        ))}
      </div>
      <div className="h-24 animate-pulse rounded-[var(--radiusMedium)] bg-[var(--ms-bg-subtle)]" />
    </div>
  </div>
);

const MetricPill = ({ icon, label, value, tone = 'neutral' }) => {
  const tones = {
    brand:   { bg: 'var(--ms-blue-soft)',                  fg: 'var(--colorBrandForeground1)' },
    success: { bg: 'var(--colorStatusSuccessBackground1)', fg: 'var(--colorStatusSuccessForeground1)' },
    neutral: { bg: 'var(--colorNeutralBackground3)',       fg: 'var(--colorNeutralForeground2)' },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <div className="fluent-card-filled flex items-center gap-3 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radiusMedium)]" style={{ background: t.bg, color: t.fg }}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>{label}</p>
        <p className="fui-body1-strong truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>{value}</p>
      </div>
    </div>
  );
};

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
      suppressGlobal={false}
      icon={<ReceiptText size={20} />}
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            disabled={isSubmitting}
            className="ms-button ms-button-secondary ms-button-md w-full disabled:opacity-60 sm:w-auto"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="global-sale-form"
            disabled={isSubmitting || loading}
            className="ms-button ms-button-primary ms-button-md w-full disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
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
        <div className="fluent-card-filled p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)' }}>
            <AlertCircle size={22} />
          </div>
          <h3 className="fui-subtitle2 mt-4" style={{ color: 'var(--colorNeutralForeground1)' }}>Chargement impossible</h3>
          <p className="fui-body1 mx-auto mt-2 max-w-sm" style={{ color: 'var(--colorNeutralForeground2)' }}>{loadError}</p>
          <button
            type="button"
            onClick={fetchSaleFormData}
            className="ms-button ms-button-primary ms-button-md mx-auto mt-5"
          >
            <RefreshCw size={16} />
            Réessayer
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricPill icon={<Users size={16} />} label="Clients" value={clients.length} tone="brand" />
            <MetricPill icon={<Boxes size={16} />} label="Produits" value={products.length} tone="success" />
            <MetricPill icon={<ReceiptText size={16} />} label="Mode" value="Complet" />
            <MetricPill icon={<Check size={16} />} label="Stock" value="Automatique" />
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
