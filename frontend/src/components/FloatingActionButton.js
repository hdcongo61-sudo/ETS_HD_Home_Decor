// components/FloatingActionButton.js
import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, CreditCard, Receipt, Users, Package, ChevronUp } from 'lucide-react';
import { useModal } from '../context/ModalContext';
import { Button } from './business';

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
      onClick: () => {
        navigate('/sales');
        setIsExpanded(false);
      },
      accent: 'text-blue-600',
      bg: 'bg-white hover:bg-blue-50 border border-gray-200',
    },
    {
      label: 'Clients',
      icon: Users,
      onClick: () => {
        navigate('/clients');
        setIsExpanded(false);
      },
      accent: 'text-emerald-600',
      bg: 'bg-white hover:bg-emerald-50 border border-gray-200',
    },
    {
      label: 'Produits',
      icon: Package,
      onClick: () => {
        navigate('/products');
        setIsExpanded(false);
      },
      accent: 'text-amber-600',
      bg: 'bg-white hover:bg-amber-50 border border-gray-200',
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
      {/* Backdrop when expanded (mobile-friendly) */}
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
          <div className="flex flex-col items-end gap-2 transition-all duration-200">
            {/* Primary: New Sale (in speed-dial too for consistency) */}
            <button
              type="button"
              onClick={handleNewSale}
              className="flex items-center gap-3 rounded-lg bg-[var(--ms-blue)] hover:bg-[var(--ms-blue-dark)] text-white shadow-[var(--ms-shadow)] hover:shadow-[var(--ms-shadow-lg)] hover:scale-[1.02] active:scale-[0.98] transition-all px-4 py-3 min-w-[180px] justify-end"
            >
              <span className="text-sm font-medium">Nouvelle vente</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <ShoppingCart className="w-5 h-5" strokeWidth={2} />
              </span>
            </button>
            {/* Payment */}
            <button
              type="button"
              onClick={handleNewPayment}
              className="flex items-center gap-3 rounded-lg bg-[var(--ms-success)] hover:bg-[#0B6310] text-white shadow-[var(--ms-shadow)] hover:shadow-[var(--ms-shadow-lg)] hover:scale-[1.02] active:scale-[0.98] transition-all px-4 py-3 min-w-[180px] justify-end"
            >
              <span className="text-sm font-medium">Ajouter paiement</span>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
                <CreditCard className="w-5 h-5" strokeWidth={2} />
              </span>
            </button>
            {/* Divider / label */}
            <div className="w-full border-t border-[var(--ms-border)] pt-2 mt-1">
              <p className="text-[10px] uppercase tracking-wider text-[var(--ms-text-muted)] font-medium mb-2 text-right">Acces rapide</p>
            </div>
            {/* Quick links */}
            {quickLinks.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.onClick}
                  className={`flex items-center gap-3 rounded-lg bg-[var(--ms-white)] hover:bg-[var(--ms-bg-subtle)] border border-[var(--ms-border)] shadow-[var(--ms-shadow-sm)] hover:shadow-[var(--ms-shadow)] hover:scale-[1.02] active:scale-[0.98] transition-all px-4 py-2.5 min-w-[160px] justify-end`}
                >
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.accent}`}>
                    <Icon className="w-4 h-4" strokeWidth={2} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main FAB: one tap = New Sale */}
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex h-[22px] w-[21px] items-center justify-center rounded-md bg-[var(--ms-bg-subtle)] hover:bg-[var(--ms-surface-muted)] text-[var(--ms-text-muted)] shadow-sm border border-[var(--ms-border)] md:border-0"
            aria-label={isExpanded ? 'Fermer le menu' : 'Plus d\'actions'}
          >
            <ChevronUp
              className={`w-5 h-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
              strokeWidth={2}
            />
          </button>
          <button
            type="button"
            onClick={handleNewSale}
            className="flex h-[34px] w-[38px] items-center justify-center rounded-lg bg-[var(--ms-blue)] text-white shadow-[var(--ms-shadow)] hover:shadow-[var(--ms-shadow-lg)] hover:scale-105 active:scale-95 transition-all duration-200 ring-4 ring-[var(--ms-blue)]/15"
            aria-label="Nouvelle vente"
          >
            <ShoppingCart className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <span className="text-[10px] font-medium text-gray-500 hidden md:block">Nouvelle vente</span>
        </div>
      </div>
    </>
  );
};

export default FloatingActionButton;
