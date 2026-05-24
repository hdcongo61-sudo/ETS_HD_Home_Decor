// components/GlobalSaleModal.js
import React, { useCallback, useEffect, useState } from 'react';
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
      subtitle="Même formulaire que la page ventes: date, type, paiement, rappel et livraison."
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={closeModal}
            className="min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition-colors touch-manipulation"
          >
            Annuler
          </button>
          <button
            type="submit"
            form="global-sale-form"
            disabled={isSubmitting || loading}
            className={`min-h-[44px] w-full sm:w-auto px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 touch-manipulation ${
              isSubmitting || loading
                ? 'bg-gray-400 cursor-not-allowed text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {isSubmitting ? 'Enregistrement…' : 'Enregistrer la vente'}
          </button>
        </>
      }
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <span className="ml-3 text-sm text-gray-600">Chargement du formulaire…</span>
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{loadError}</p>
          <button
            type="button"
            onClick={fetchSaleFormData}
            className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
          >
            Réessayer
          </button>
        </div>
      ) : (
        <SaleForm
          clients={clients}
          products={products}
          onSubmit={handleSubmit}
          formId="global-sale-form"
          hideSubmit
        />
      )}
    </Modal>
  );
};

export default GlobalSaleModal;
