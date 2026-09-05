// components/BackToTopButton.js
// Bouton flottant « remonter en haut » — mobile uniquement.
import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useModal } from '../context/ModalContext';

const BackToTopButton = () => {
  const [visible, setVisible] = useState(false);
  const { activeModal } = useModal();

  useEffect(() => {
    let ticking = false;
    const update = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setVisible(window.scrollY > 320);
        ticking = false;
      });
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  // Masqué quand une modale globale est ouverte (comme le FAB).
  if (activeModal) return null;

  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Remonter en haut de page"
      title="Remonter en haut"
      className={`fixed left-[calc(1rem+env(safe-area-inset-left,0px))] bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] z-50 flex h-11 w-11 items-center justify-center rounded-full border border-[var(--ms-border)] bg-[var(--ms-white)]/95 text-[var(--ms-text-strong)] shadow-[var(--ms-shadow)] backdrop-blur transition-all duration-300 ease-out will-change-transform md:hidden ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
      }`}
    >
      <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
    </button>
  );
};

export default BackToTopButton;
