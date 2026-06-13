// components/FloatingActionButton.js
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, CreditCard, Receipt, Users, Package, Plus } from 'lucide-react';
import { useModal } from '../context/ModalContext';

const FloatingActionButton = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef(null);
  const { openModal, activeModal } = useModal();
  const navigate = useNavigate();

  const isModalOrFormOpen = Boolean(activeModal);

  const handleNewSale = () => {
    openModal('sale');
    setIsExpanded(false);
  };

  const handleNewPayment = () => {
    openModal('payment');
    setIsExpanded(false);
  };

  const quickLinks = [
    {
      label: 'Ventes',
      icon: Receipt,
      onClick: () => { navigate('/sales'); setIsExpanded(false); },
      chip: { background: 'var(--ms-blue-soft)', color: 'var(--ms-blue)' },
    },
    {
      label: 'Clients',
      icon: Users,
      onClick: () => { navigate('/clients'); setIsExpanded(false); },
      chip: { background: 'var(--colorStatusSuccessBackground1)', color: 'var(--colorStatusSuccessForeground1)' },
    },
    {
      label: 'Produits',
      icon: Package,
      onClick: () => { navigate('/products'); setIsExpanded(false); },
      chip: { background: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)' },
    },
  ];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    };
    if (isExpanded) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isExpanded]);

  if (isModalOrFormOpen) return null;

  return (
    <>
      {/* Backdrop when expanded */}
      {isExpanded && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-40 bg-[rgba(32,31,30,0.2)] backdrop-blur-[2px] transition-opacity"
          onClick={() => setIsExpanded(false)}
        />
      )}

      <div
        ref={containerRef}
        className="fixed z-50 right-[calc(1rem+env(safe-area-inset-right,0px))] bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] flex flex-col items-end gap-3"
      >
        {/* Expandable speed-dial */}
        {isExpanded && (
          <div className="flex flex-col items-end gap-2">
            {/* Primary actions */}
            <button
              type="button"
              onClick={handleNewSale}
              className="flex min-w-[200px] items-center justify-end gap-3 rounded-[var(--radiusLarge)] bg-[var(--ms-blue)] px-4 py-3 text-white shadow-[var(--ms-shadow)] transition-all hover:bg-[var(--ms-blue-dark)] hover:shadow-[var(--ms-shadow-lg)] active:scale-[0.98]"
            >
              <span className="text-sm font-semibold">Nouvelle vente</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radiusMedium)] bg-white/20">
                <ShoppingCart className="h-5 w-5" strokeWidth={2} />
              </span>
            </button>
            <button
              type="button"
              onClick={handleNewPayment}
              className="flex min-w-[200px] items-center justify-end gap-3 rounded-[var(--radiusLarge)] px-4 py-3 text-white shadow-[var(--ms-shadow)] transition-all hover:shadow-[var(--ms-shadow-lg)] active:scale-[0.98]"
              style={{ background: 'var(--ms-success)' }}
            >
              <span className="text-sm font-semibold">Ajouter paiement</span>
              <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radiusMedium)] bg-white/20">
                <CreditCard className="h-5 w-5" strokeWidth={2} />
              </span>
            </button>

            {/* Quick links */}
            <div className="mt-1 w-full border-t border-[var(--ms-border)] pt-2">
              <p className="mb-2 text-right text-[10px] font-semibold uppercase tracking-wider text-[var(--ms-text-muted)]">Accès rapide</p>
            </div>
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className="flex min-w-[170px] items-center justify-end gap-3 rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-white)] px-4 py-2.5 shadow-[var(--ms-shadow-sm)] transition-all hover:bg-[var(--ms-bg-subtle)] hover:shadow-[var(--ms-shadow)] active:scale-[0.98]"
                >
                  <span className="text-sm font-semibold text-[var(--ms-text-strong)]">{item.label}</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radiusMedium)]" style={item.chip}>
                    <Icon className="h-4 w-4" strokeWidth={2} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main FAB cluster */}
        <div className="flex flex-col items-center gap-2">
          {/* More-actions toggle */}
          <button
            type="button"
            onClick={() => setIsExpanded((v) => !v)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--ms-border)] bg-[var(--ms-white)] text-[var(--ms-text-muted)] shadow-[var(--ms-shadow-sm)] transition-all hover:bg-[var(--ms-bg-subtle)] hover:text-[var(--ms-text-strong)]"
            aria-label={isExpanded ? 'Fermer le menu' : "Plus d'actions"}
            aria-expanded={isExpanded}
          >
            <Plus
              className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? 'rotate-45' : ''}`}
              strokeWidth={2.4}
            />
          </button>
          {/* Primary FAB: one tap = New Sale */}
          <button
            type="button"
            onClick={handleNewSale}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ms-blue)] text-white shadow-[var(--ms-shadow-lg)] ring-4 ring-[var(--ms-blue)]/15 transition-all duration-200 hover:bg-[var(--ms-blue-dark)] hover:scale-105 active:scale-95"
            aria-label="Nouvelle vente"
            title="Nouvelle vente"
          >
            <ShoppingCart className="h-6 w-6" strokeWidth={2.4} />
          </button>
        </div>
      </div>
    </>
  );
};

export default FloatingActionButton;
