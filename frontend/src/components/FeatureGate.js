import React, { useContext, useState } from 'react';
import { Link } from 'react-router-dom';
import { Lock, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import AuthContext from '../context/AuthContext';
import api from '../services/api';
import Modal from './Modal';
import { Button } from './business';
import { featureLabel, featureRequiredPlanLabel, featureRequiredPlanKey } from '../config/features';

// Hook: is the given plan feature available to the current shop?
export const useFeature = (feature) => {
  const { hasFeature } = useContext(AuthContext);
  return typeof hasFeature === 'function' ? hasFeature(feature) : true;
};

// Upgrade prompt — reuses the existing tenant plan-request flow.
export const UpgradeModal = ({ open, onClose, feature }) => {
  const [submitting, setSubmitting] = useState(false);
  const planLabel = featureRequiredPlanLabel(feature);

  const requestUpgrade = async () => {
    try {
      setSubmitting(true);
      await api.post('/tenants/plan-request', {
        requestedPlan: featureRequiredPlanKey(feature),
        note: `Demande d'accès à : ${featureLabel(feature)}`,
      });
      toast.success('Demande envoyée. Notre équipe vous contactera.');
      onClose();
    } catch (e) {
      toast.error(e.response?.data?.message || "Impossible d'envoyer la demande.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      title={`Fonctionnalité ${planLabel}`}
      size="sm"
      icon={<Crown size={20} />}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Plus tard</Button>
          <Button variant="primary" onClick={requestUpgrade} disabled={submitting}>
            {submitting ? 'Envoi…' : `Demander le forfait ${planLabel}`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-[var(--ms-text)]">
          <span className="font-semibold text-[var(--ms-text-strong)]">{featureLabel(feature)}</span> est disponible avec le forfait{' '}
          <span className="font-semibold text-[var(--ms-text-strong)]">{planLabel}</span>.
        </p>
        <p className="text-sm text-[var(--ms-text-muted)]">
          Envoyez une demande de mise à niveau : notre équipe activera la fonctionnalité pour votre boutique.
        </p>
      </div>
    </Modal>
  );
};

// A locked stand-in for a gated action button. Shows a lock + plan badge and
// opens the upgrade prompt on click.
export const LockedFeatureButton = ({ feature, children, className = '', icon = null }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`ms-button ms-button-secondary ms-button-sm ${className}`}
        title={`${featureLabel(feature)} — réservé au forfait ${featureRequiredPlanLabel(feature)}`}
      >
        {icon}
        {children}
        <span
          className="ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ background: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)' }}
        >
          <Lock className="h-3 w-3" /> {featureRequiredPlanLabel(feature)}
        </span>
      </button>
      <UpgradeModal open={open} onClose={() => setOpen(false)} feature={feature} />
    </>
  );
};

// Full-page locked state for route-level gating: explains the feature is not in
// the plan and offers an upgrade request.
export const FeatureLockedView = ({ feature }) => {
  const [open, setOpen] = useState(false);
  const planLabel = featureRequiredPlanLabel(feature);
  return (
    <div className="ms-workspace">
      <div className="mx-auto mt-10 max-w-lg rounded-[var(--radiusXLarge,12px)] border border-[var(--ms-border)] bg-[var(--ms-white)] p-8 text-center shadow-[var(--ms-shadow)]">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: 'var(--colorStatusWarningBackground1)', color: 'var(--colorStatusWarningForeground1)' }}>
          <Lock size={26} />
        </div>
        <h1 className="mt-5 text-xl font-bold text-[var(--ms-text-strong)]">{featureLabel(feature)}</h1>
        <p className="mt-2 text-sm text-[var(--ms-text-muted)]">
          Cette fonctionnalité est disponible avec le forfait <span className="font-semibold text-[var(--ms-text)]">{planLabel}</span>.
          Votre forfait actuel ne l'inclut pas.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-2 sm:flex-row">
          <Button variant="primary" onClick={() => setOpen(true)}>
            <Crown size={16} /> Demander le forfait {planLabel}
          </Button>
          <Link to="/" className="ms-button ms-button-secondary ms-button-md">Retour à l'accueil</Link>
        </div>
      </div>
      <UpgradeModal open={open} onClose={() => setOpen(false)} feature={feature} />
    </div>
  );
};

// Renders children when the feature is available; otherwise renders `locked`
// (default: nothing).
const FeatureGate = ({ feature, children, locked = null }) => {
  const allowed = useFeature(feature);
  return allowed ? children : locked;
};

export default FeatureGate;
