import React, { useEffect, useRef, useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Loader2, Smartphone } from 'lucide-react';

/**
 * Mobile-money subscription payment form (PawaPay).
 *
 * Used in Settings → Abonnement (active shops) and on the access-restricted
 * page (suspended/expired shops paying to reactivate).
 *
 * Props:
 *   suggestedAmount — prefill the amount (e.g. tenant.monthlyPrice)
 *   onPaid          — called once a payment is confirmed COMPLETED
 */
const PawaPaySubscriptionForm = ({ suggestedAmount = null, onPaid = null }) => {
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({
    providerId: '',
    phoneNumber: '',
    amount: suggestedAmount ? String(suggestedAmount) : '',
    months: '1',
  });
  const [submitting, setSubmitting] = useState(false);
  const [awaiting, setAwaiting] = useState(false);
  const pollRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    api
      .get('/tenants/payment/pawapay/config')
      .then(({ data }) => {
        if (!mounted) return;
        setConfig(data);
        setForm((f) => ({
          ...f,
          amount: f.amount || (data.suggestedAmount ? String(data.suggestedAmount) : ''),
        }));
      })
      .catch(() => {
        if (mounted) setConfig({ enabled: false, providers: [], suggestedAmount: 0 });
      });
    return () => {
      mounted = false;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPoll = (depositId) => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await api.get(`/tenants/payment/pawapay/${depositId}`);
        if (data.status === 'completed') {
          stopPoll();
          setSubmitting(false);
          setAwaiting(false);
          toast.success('Paiement reçu. Votre abonnement est activé.');
          if (onPaid) onPaid();
        } else if (data.status === 'failed') {
          stopPoll();
          setSubmitting(false);
          setAwaiting(false);
          toast.error(data.failureReason || 'Le paiement a échoué. Réessayez.');
        }
      } catch {
        // Transient error — keep polling a few more times.
      }
    }, 5000);
  };

  const submit = async () => {
    if (!form.providerId) {
      toast.error('Choisissez un opérateur mobile money.');
      return;
    }
    const phone = (form.phoneNumber || '').replace(/[\s\-().]/g, '');
    if (!/^\+?[0-9]{8,15}$/.test(phone)) {
      toast.error('Numéro de téléphone invalide (format international, ex: +225 07 00 00 00 00).');
      return;
    }
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Montant invalide.');
      return;
    }
    const months = Number(form.months);
    if (!Number.isInteger(months) || months < 1 || months > 12) {
      toast.error('Nombre de mois invalide (1-12).');
      return;
    }
    try {
      setSubmitting(true);
      setAwaiting(false);
      const { data } = await api.post('/tenants/payment/pawapay/initiate', {
        providerId: form.providerId,
        phoneNumber: phone,
        amount,
        months,
      });
      if (data.success) {
        setAwaiting(true);
        toast.success('Demande envoyée. Validez le paiement sur votre téléphone.');
        startPoll(data.depositId);
      } else {
        setSubmitting(false);
        toast.error(data.message || 'Paiement refuse par l operateur.');
      }
    } catch (err) {
      setSubmitting(false);
      toast.error(err.response?.data?.message || 'Impossible d initier le paiement mobile money.');
    }
  };

  if (!config) {
    return (
      <p className="fui-caption1 py-3 text-center" style={{ color: 'var(--colorNeutralForeground3)' }}>
        Chargement…
      </p>
    );
  }

  if (!config.enabled || !Array.isArray(config.providers) || config.providers.length === 0) {
    return (
      <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
        Le paiement par mobile money n'est pas encore activé. Contactez le support ou réglez votre abonnement en espèces.
      </p>
    );
  }

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="form-label mb-1 block">Opérateur</label>
          <select
            value={form.providerId}
            onChange={(e) => setForm((f) => ({ ...f, providerId: e.target.value }))}
            className="form-control"
          >
            <option value="">Choisir…</option>
            {config.providers.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label mb-1 block">Numéro mobile money</label>
          <input
            type="tel"
            inputMode="tel"
            value={form.phoneNumber}
            onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
            className="form-control"
            placeholder="+242 06 000 00 00"
          />
        </div>
        <div>
          <label className="form-label mb-1 block">Nombre de mois</label>
          <select
            value={form.months}
            onChange={(e) => {
              const months = Number(e.target.value);
              const baseAmount = config.suggestedAmount || 0;
              setForm((f) => ({
                ...f,
                months: e.target.value,
                amount: baseAmount > 0 ? String(baseAmount * months) : f.amount,
              }));
            }}
            className="form-control"
          >
            {[1, 2, 3, 6, 12].map((m) => (
              <option key={m} value={m}>{m} mois</option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label mb-1 block">Montant (F CFA)</label>
          <input
            type="number"
            min="1"
            step="1"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            className="form-control"
            placeholder="Ex: 15000"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="ms-button ms-button-primary ms-button-md justify-center disabled:opacity-60"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> En attente du paiement…
            </>
          ) : (
            <>
              <Smartphone className="h-4 w-4" /> Payer par mobile money
            </>
          )}
        </button>
        {awaiting && (
          <span className="fui-caption1 flex items-center gap-2" style={{ color: 'var(--colorStatusWarningForeground1)' }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            En attente de validation sur votre téléphone… vérification automatique.
          </span>
        )}
      </div>
    </div>
  );
};

export default PawaPaySubscriptionForm;
