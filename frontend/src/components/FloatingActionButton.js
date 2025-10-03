// components/FloatingActionButton.js
import React, { useState } from 'react';
import { useModal } from '../context/ModalContext';

const FloatingActionButton = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { openModal } = useModal();

  const actions = [
    {
      label: 'Nouvelle Vente',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      ),
      onClick: () => openModal('sale'),
      color: 'bg-blue-500 hover:bg-blue-600'
    },
    {
      label: 'Ajouter Paiement',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      onClick: () => openModal('payment'),
      color: 'bg-green-500 hover:bg-green-600'
    }
  ];

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Menu des actions */}
      {isMenuOpen && (
        <div className="absolute bottom-16 right-0 mb-2 space-y-2">
          {actions.map((action, index) => (
            <div
              key={action.label}
              className="flex items-center justify-end space-x-2 transition-all duration-300"
              style={{
                opacity: isMenuOpen ? 1 : 0,
                transform: `translateY(${isMenuOpen ? 0 : 20}px)`,
                transitionDelay: isMenuOpen ? `${index * 100}ms` : '0ms'
              }}
            >
              <span className="bg-gray-800 text-white text-sm px-3 py-1 rounded-lg whitespace-nowrap">
                {action.label}
              </span>
              <button
                onClick={action.onClick}
                className={`${action.color} text-white w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all transform hover:scale-110`}
              >
                {action.icon}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Bouton principal */}
      <button
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        className="w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-full flex items-center justify-center shadow-2xl transition-all transform hover:scale-110"
      >
        <svg 
          className={`w-6 h-6 transition-transform duration-300 ${isMenuOpen ? 'rotate-45' : 'rotate-0'}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </button>
    </div>
  );
};

export default FloatingActionButton;