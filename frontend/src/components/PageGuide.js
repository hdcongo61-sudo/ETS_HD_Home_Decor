import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { HelpCircle, Lightbulb } from 'lucide-react';
import Modal from './Modal';
import { matchGuide } from '../guides/pageGuides';

/**
 * PageGuide — aide contextuelle globale (une seule instance dans le shell).
 *
 * Affiche un bouton d'aide flottant (en haut à droite, sous la barre de
 * navigation) sur chaque page authentifiée disposant d'un guide. Le guide
 * correspondant à l'URL courante s'ouvre dans une modale : description,
 * étapes numérotées et conseils.
 */
const PageGuide = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [guide, setGuide] = useState(null);

  useEffect(() => {
    setGuide(matchGuide(location.pathname));
    setOpen(false);
  }, [location.pathname]);

  if (!guide) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Guide : ${guide.label}`}
        title={`Guide : ${guide.label}`}
        className="fixed z-40 flex h-9 w-9 items-center justify-center rounded-full shadow-[var(--shadow8)] transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]"
        style={{
          top: 'calc(var(--app-nav-offset, 0px) + 12px)',
          right: 'calc(1rem + env(safe-area-inset-right, 0px))',
          background: 'var(--ms-blue)',
          color: '#fff',
        }}
      >
        <HelpCircle size={18} />
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Guide — ${guide.label}`}
        subtitle={guide.description}
        icon={<HelpCircle size={20} style={{ color: 'var(--ms-blue)' }} />}
        size="md"
      >
        <ol className="mb-4 space-y-3">
          {(guide.steps || []).map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full fui-caption1-strong"
                style={{ background: 'var(--ms-blue-soft)', color: 'var(--ms-blue-dark)' }}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span className="fui-body1" style={{ color: 'var(--colorNeutralForeground1)' }}>
                {step}
              </span>
            </li>
          ))}
        </ol>

        {(guide.tips || []).length > 0 && (
          <div
            className="rounded-[var(--radiusLarge)] p-4"
            style={{ background: 'var(--colorStatusWarningBackground1)', border: '1px solid var(--colorStatusWarningStroke1)' }}
          >
            <p className="fui-body1-strong mb-2 flex items-center gap-2" style={{ color: 'var(--colorStatusWarningForeground1)' }}>
              <Lightbulb size={15} /> Conseils
            </p>
            <ul className="space-y-1.5">
              {(guide.tips || []).map((tip, index) => (
                <li key={index} className="fui-body2" style={{ color: 'var(--colorNeutralForeground2)' }}>
                  • {tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
};

export default PageGuide;
