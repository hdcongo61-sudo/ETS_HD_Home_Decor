import React, { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { ArrowRight, Check, FileText, Package, Plus, RefreshCw, Search, Trash2, UserRound, X } from 'lucide-react';
import api from '../services/api';
import { formatCfa } from '../utils/format';

const STATUS = {
  draft: { label: 'Brouillon', cls: 'bg-gray-100 text-gray-700' },
  sent: { label: 'Envoyé', cls: 'bg-blue-100 text-blue-700' },
  accepted: { label: 'Accepté', cls: 'bg-green-100 text-green-700' },
  rejected: { label: 'Rejeté', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: 'Annulé', cls: 'bg-gray-100 text-gray-500' },
  converted: { label: 'Converti', cls: 'bg-violet-100 text-violet-700' },
  expired: { label: 'Expiré', cls: 'bg-amber-100 text-amber-700' },
};

const normalize = (value, keys = []) => {
  if (Array.isArray(value)) return value;
  for (const key of keys) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
};

const emptyLine = () => ({ product: '', quantity: 1, price: 0 });

const Devis = () => {
  const [devis, setDevis] = useState([]);
  const [clients, setClients] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState([]);
  const [form, setForm] = useState({
    client: '',
    note: '',
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    lines: [emptyLine()],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [devisRes, clientsRes, productsRes] = await Promise.all([
        api.get('/devis'),
        api.get('/clients'),
        api.get('/products'),
      ]);
      setDevis(normalize(devisRes.data, ['devis', 'data']));
      setClients(normalize(clientsRes.data, ['clients', 'data']));
      setProducts(normalize(productsRes.data, ['products', 'data']));
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les devis');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const total = useMemo(
    () =>
      form.lines.reduce(
        (sum, line) => sum + (Number(line.quantity) || 0) * (Number(line.price) || 0),
        0
      ),
    [form.lines]
  );

  const updateLine = (index, field, value) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[index] = { ...lines[index], [field]: value };
      return { ...prev, lines };
    });
  };

  const addLine = () => setForm((prev) => ({ ...prev, lines: [...prev.lines, emptyLine()] }));
  const removeLine = (index) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.length > 1 ? prev.lines.filter((_, i) => i !== index) : prev.lines,
    }));
    setProductSearch((current) => current.filter((_, i) => i !== index));
  };
  const updateProductSearch = (index, value) => {
    setProductSearch((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
    const selectedProduct = products.find((product) => product._id === form.lines[index]?.product);
    if (selectedProduct && value !== selectedProduct.name) {
      updateLine(index, 'product', '');
    }
  };

  const filteredClients = clients.filter((client) =>
    String(client.name || '').toLowerCase().includes(clientSearch.trim().toLowerCase())
    || String(client.phone || '').toLowerCase().includes(clientSearch.trim().toLowerCase())
  );
  const selectedClient = clients.find((client) => client._id === form.client);
  const setLineProduct = (index, product) => {
    setForm((prev) => {
      const lines = [...prev.lines];
      lines[index] = {
        ...lines[index],
        product: product._id,
        price: Number(product.price) || 0,
      };
      return { ...prev, lines };
    });
    setProductSearch((current) => {
      const next = [...current];
      next[index] = '';
      return next;
    });
  };

  const goToStep = (step) => {
    if (step > activeStep) {
      if (activeStep === 0 && !form.client) {
        toast.error('Sélectionnez un client avant de continuer.');
        return;
      }
      if (activeStep === 1 && !form.lines.some((line) => line.product)) {
        toast.error('Ajoutez au moins un produit avant de continuer.');
        return;
      }
      if (activeStep === 1 && form.lines.some((line) =>
        line.product && (
          !Number.isFinite(Number(line.quantity))
          || Number(line.quantity) < 1
          || !Number.isFinite(Number(line.price))
          || Number(line.price) < 0
        )
      )) {
        toast.error('Vérifiez les quantités et les prix des produits.');
        return;
      }
    }
    setActiveStep(step);
  };

  const resetForm = () => {
    setForm({
      client: '',
      note: '',
      validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      lines: [emptyLine()],
    });
    setActiveStep(0);
    setClientSearch('');
    setProductSearch([]);
  };

  const submitDevis = async (e) => {
    e.preventDefault();
    if (!form.client) {
      toast.error('Sélectionnez un client');
      return;
    }
    const lines = form.lines
      .filter((line) => line.product)
      .map((line) => ({
        product: line.product,
        quantity: Number(line.quantity),
        price: Number(line.price) || 0,
      }));
    if (lines.length === 0) {
      toast.error('Ajoutez au moins un produit');
      return;
    }
    if (!form.validUntil || new Date(`${form.validUntil}T00:00:00`) < new Date(new Date().toDateString())) {
      toast.error('Choisissez une date de validité à partir d’aujourd’hui.');
      return;
    }
    if (lines.some((line) => !Number.isFinite(line.quantity) || line.quantity < 1 || !Number.isFinite(line.price) || line.price < 0)) {
      toast.error('Vérifiez les quantités et les prix des produits.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/devis', {
        client: form.client,
        validUntil: form.validUntil,
        note: form.note,
        products: lines,
      });
      toast.success('Devis créé');
      resetForm();
      setShowForm(false);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de création');
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (id, status) => {
    try {
      await api.put(`/devis/${id}/status`, { status });
      toast.success('Statut mis à jour');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de mise à jour');
    }
  };

  const convert = async (id) => {
    try {
      const { data } = await api.post(`/devis/${id}/convert`);
      toast.success(`Proforma ${data.proforma?.reference || ''} créée`);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de conversion');
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/devis/${id}`);
      toast.success('Devis supprimé');
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Erreur de suppression');
    }
  };

  const inputBase =
    'form-control w-full rounded-[var(--radiusMedium)] border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400';

  const statusOf = (d) => (d.derivedExpired && ['draft', 'sent'].includes(d.status) ? 'expired' : d.status);
  const steps = [
    { label: 'Client', description: 'Choisir le destinataire' },
    { label: 'Produits', description: 'Composer le devis' },
    { label: 'Validité', description: 'Ajouter les conditions' },
    { label: 'Vérification', description: 'Relire avant création' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]"
          style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}
        >
          <FileText className="h-5 w-5" />
        </span>
        <div>
          <h1 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>
            Devis
          </h1>
          <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Pipeline devis → proforma → vente.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={load} className="ms-button ms-button-secondary min-h-[44px]">
          <RefreshCw className="h-4 w-4" /> Actualiser
        </button>
        <button type="button" onClick={() => {
          if (showForm) resetForm();
          setShowForm((v) => !v);
        }} className="ms-button ms-button-primary min-h-[44px]">
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? 'Fermer' : 'Nouveau devis'}
        </button>
      </div>

      {error && <p className="text-sm text-[var(--ms-danger)]">{error}</p>}

      {showForm && (
        <form onSubmit={submitDevis} className="fluent-card-filled overflow-hidden">
          <div className="border-b border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] px-5 py-4 sm:px-6">
            <h2 className="text-lg font-semibold text-[var(--ms-text-strong)]">Nouveau devis</h2>
            <p className="mt-0.5 text-sm text-[var(--ms-text-muted)]">
              Préparez une proposition commerciale sans enregistrer de vente ni modifier le stock.
            </p>
            <ol className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Étapes de création du devis">
              {steps.map((step, index) => {
                const isCurrent = activeStep === index;
                const isComplete = index < activeStep;
                return (
                  <li key={step.label} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => index < activeStep && setActiveStep(index)}
                      disabled={index > activeStep}
                      aria-current={isCurrent ? 'step' : undefined}
                      className={`flex min-h-[48px] w-full items-center gap-2 rounded-[var(--radiusMedium)] border px-2.5 py-2 text-left transition-colors ${
                        isComplete
                          ? 'border-[var(--colorStatusSuccessStroke1)] bg-[var(--colorStatusSuccessBackground1)]'
                          : isCurrent
                            ? 'border-[var(--colorBrandStroke1)] bg-[var(--ms-blue-soft)]'
                            : 'border-[var(--ms-border)] bg-[var(--ms-white)]'
                      } ${index < activeStep ? 'cursor-pointer' : 'cursor-default'}`}
                    >
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isComplete ? 'bg-[var(--colorStatusSuccessForeground1)] text-white' : isCurrent ? 'bg-[var(--ms-blue)] text-white' : 'bg-[var(--colorNeutralBackground3)] text-[var(--colorNeutralForeground3)]'
                      }`}>
                        {isComplete ? <Check size={14} aria-hidden="true" /> : index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-semibold">{step.label}</span>
                        <span className="hidden truncate text-[11px] text-[var(--ms-text-muted)] lg:block">{step.description}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="space-y-5 p-5 sm:p-6">
            {activeStep === 0 && (
              <section className="space-y-4" aria-labelledby="devis-step-client">
                <h3 id="devis-step-client" tabIndex={-1} className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-strong)]">Choisir le client</h3>
                <p className="text-sm text-[var(--ms-text-muted)]">Sélectionnez le client à qui vous adressez cette proposition.</p>
                <label className="relative block">
                  <span className="sr-only">Rechercher un client par nom ou téléphone</span>
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ms-text-muted)]" aria-hidden="true" />
                  <input
                    type="search"
                    value={clientSearch}
                    onChange={(e) => setClientSearch(e.target.value)}
                    className={`${inputBase} min-h-[44px] pl-10`}
                    placeholder="Rechercher un client par nom ou téléphone…"
                  />
                </label>
                {filteredClients.length > 0 ? (
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Clients disponibles">
                    {filteredClients.map((client) => {
                      const selected = form.client === client._id;
                      return (
                        <button
                          key={client._id}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setForm((current) => ({ ...current, client: client._id }))}
                          className={`flex min-h-[68px] items-center gap-3 rounded-[var(--radiusLarge)] border p-3 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--ms-blue)] ${
                            selected ? 'border-[var(--ms-blue)] bg-[var(--ms-blue-soft)]' : 'border-[var(--ms-border)] bg-[var(--ms-white)] hover:bg-[var(--ms-bg-subtle)]'
                          }`}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--colorNeutralBackground3)] text-[var(--colorNeutralForeground2)]">
                            <UserRound size={18} aria-hidden="true" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-[var(--ms-text-strong)]">{client.name}</span>
                            <span className="block truncate text-xs text-[var(--ms-text-muted)]">{client.phone || client.email || 'Client'}</span>
                          </span>
                          {selected && <Check size={18} className="shrink-0 text-[var(--ms-blue)]" aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="rounded-[var(--radiusLarge)] border border-dashed border-[var(--ms-border-strong)] p-5 text-center text-sm text-[var(--ms-text-muted)]">
                    {clients.length ? 'Aucun client ne correspond à la recherche.' : 'Aucun client disponible.'}
                  </p>
                )}
                <div className="flex justify-end">
                  <button type="button" onClick={() => goToStep(1)} className="ms-button ms-button-primary min-h-[44px]">
                    Continuer vers les produits <ArrowRight size={16} aria-hidden="true" />
                  </button>
                </div>
              </section>
            )}

            {activeStep === 1 && (
              <section className="space-y-4" aria-labelledby="devis-step-products">
                <div>
                  <h3 id="devis-step-products" tabIndex={-1} className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-strong)]">Ajouter les produits</h3>
                  <p className="mt-1 text-sm text-[var(--ms-text-muted)]">Les prix sont préremplis depuis le catalogue. Vous pouvez les adapter pour cette proposition ; aucun stock ne sera réservé par le devis.</p>
                </div>
                <div className="space-y-4">
                  {form.lines.map((line, index) => {
                    const selectedProduct = products.find((product) => product._id === line.product);
                    const query = productSearch[index] || '';
                    const matches = query.trim()
                      ? products.filter((product) => String(product.name || '').toLowerCase().includes(query.trim().toLowerCase())).slice(0, 30)
                      : [];
                    return (
                      <div key={index} className="space-y-3 rounded-[20px] border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Article {index + 1}</span>
                          {form.lines.length > 1 && (
                            <button type="button" onClick={() => removeLine(index)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[var(--ms-danger)] transition-colors hover:bg-[#FDF3F4]" aria-label={`Retirer l’article ${index + 1}`}>
                              <Trash2 size={15} aria-hidden="true" /> Retirer
                            </button>
                          )}
                        </div>
                        <label className="relative block">
                          <span className="sr-only">Rechercher un produit pour l’article {index + 1}</span>
                          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ms-text-muted)]" aria-hidden="true" />
                          <input
                            type="search"
                            value={selectedProduct && !query ? selectedProduct.name : query}
                            onChange={(e) => updateProductSearch(index, e.target.value)}
                            className={`${inputBase} min-h-[44px] pl-10`}
                            placeholder="Rechercher un produit…"
                            aria-label={`Rechercher un produit pour l’article ${index + 1}`}
                          />
                        </label>
                        {query.trim() && (
                          <div className="max-h-64 overflow-y-auto rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)]" role="listbox" aria-label={`Résultats produit ${index + 1}`}>
                            {matches.length ? matches.map((product) => (
                              <button
                                key={product._id}
                                type="button"
                                role="option"
                                aria-selected={line.product === product._id}
                                onClick={() => setLineProduct(index, product)}
                                className="flex min-h-[56px] w-full items-center gap-3 border-b border-[var(--ms-border)] px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-[var(--ms-bg-subtle)]"
                              >
                                <img src={product.image || '/placeholder.png'} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-[var(--ms-border)] object-cover" loading="lazy" />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-semibold text-[var(--ms-text-strong)]">{product.name}</span>
                                  <span className="block text-xs text-[var(--ms-text-muted)]">Catalogue : {formatCfa(Number(product.price) || 0)} · Stock : {product.stock ?? '—'}</span>
                                </span>
                                {line.product === product._id && <Check size={16} className="text-[var(--ms-blue)]" aria-hidden="true" />}
                              </button>
                            )) : <p className="p-3 text-sm text-[var(--ms-text-muted)]">Aucun produit trouvé.</p>}
                          </div>
                        )}
                        {selectedProduct && (
                          <div className="flex items-center gap-3 rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-3">
                            <img src={selectedProduct.image || '/placeholder.png'} alt="" className="h-12 w-12 rounded-md border border-[var(--ms-border)] object-cover" />
                            <div className="min-w-0 text-sm">
                              <p className="truncate font-medium text-[var(--ms-text-strong)]">{selectedProduct.name}</p>
                              <p className="text-xs text-[var(--ms-text-muted)]">Prix catalogue : {formatCfa(Number(selectedProduct.price) || 0)}</p>
                            </div>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-[var(--ms-text-muted)]">Quantité</span>
                            <input type="number" min="1" inputMode="numeric" className={inputBase} value={line.quantity} onChange={(e) => updateLine(index, 'quantity', e.target.value)} aria-label={`Quantité article ${index + 1}`} />
                          </label>
                          <label className="block">
                            <span className="mb-1 block text-xs font-medium text-[var(--ms-text-muted)]">Prix unitaire (CFA)</span>
                            <input type="number" min="0" step="0.01" inputMode="decimal" className={inputBase} value={line.price} onChange={(e) => updateLine(index, 'price', e.target.value)} aria-label={`Prix unitaire article ${index + 1}`} />
                          </label>
                        </div>
                        <p className="text-right text-sm font-semibold tabular-nums text-[var(--ms-text-strong)]">Total de la ligne : {formatCfa((Number(line.quantity) || 0) * (Number(line.price) || 0))}</p>
                      </div>
                    );
                  })}
                </div>
                <button type="button" onClick={() => {
                  addLine();
                  setProductSearch((current) => [...current, '']);
                }} className="ms-button ms-button-secondary min-h-[44px] w-full justify-center">
                  <Plus size={16} aria-hidden="true" /> Ajouter un produit
                </button>
                <div className="flex items-center justify-between rounded-[var(--radiusLarge)] bg-[var(--ms-blue-soft)] p-4">
                  <span className="text-sm font-medium text-[var(--ms-text-strong)]">Total estimé du devis</span>
                  <strong className="text-lg tabular-nums text-[var(--ms-text-strong)]">{formatCfa(total)}</strong>
                </div>
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setActiveStep(0)} className="ms-button ms-button-secondary min-h-[44px]">Retour</button>
                  <button type="button" onClick={() => goToStep(2)} className="ms-button ms-button-primary min-h-[44px]">Continuer vers la validité <ArrowRight size={16} aria-hidden="true" /></button>
                </div>
              </section>
            )}

            {activeStep === 2 && (
              <section className="space-y-4" aria-labelledby="devis-step-terms">
                <div>
                  <h3 id="devis-step-terms" tabIndex={-1} className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-strong)]">Validité et note</h3>
                  <p className="mt-1 text-sm text-[var(--ms-text-muted)]">Définissez la date limite de cette proposition et ajoutez une précision si nécessaire.</p>
                </div>
                <label className="block max-w-sm">
                  <span className="mb-1 block text-sm font-medium text-[var(--ms-text-strong)]">Valable jusqu’au</span>
                  <input type="date" min={new Date().toISOString().slice(0, 10)} className={inputBase} value={form.validUntil} onChange={(e) => setForm((current) => ({ ...current, validUntil: e.target.value }))} required />
                </label>
                <label className="block">
                  <span className="mb-1 block text-sm font-medium text-[var(--ms-text-strong)]">Note (facultative)</span>
                  <textarea maxLength={1000} className={`${inputBase} min-h-[100px] resize-y`} value={form.note} onChange={(e) => setForm((current) => ({ ...current, note: e.target.value }))} placeholder="Conditions, délai ou précision pour le client…" />
                </label>
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setActiveStep(1)} className="ms-button ms-button-secondary min-h-[44px]">Retour</button>
                  <button type="button" onClick={() => goToStep(3)} className="ms-button ms-button-primary min-h-[44px]">Vérifier le devis <ArrowRight size={16} aria-hidden="true" /></button>
                </div>
              </section>
            )}

            {activeStep === 3 && (
              <section className="space-y-4" aria-labelledby="devis-step-review">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 id="devis-step-review" tabIndex={-1} className="text-sm font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-strong)]">Vérification finale</h3>
                    <p className="mt-1 text-sm text-[var(--ms-text-muted)]">Relisez les informations avant d’enregistrer le devis.</p>
                  </div>
                  <button type="button" onClick={() => setActiveStep(0)} className="ms-button ms-button-secondary min-h-[40px]">Modifier</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--ms-text-muted)]">Client</p>
                    <p className="mt-1 font-semibold text-[var(--ms-text-strong)]">{selectedClient?.name || '—'}</p>
                    {selectedClient?.phone && <p className="mt-0.5 text-sm text-[var(--ms-text-muted)]">{selectedClient.phone}</p>}
                  </div>
                  <div className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--ms-text-muted)]">Validité</p>
                    <p className="mt-1 font-semibold text-[var(--ms-text-strong)]">{form.validUntil ? new Date(`${form.validUntil}T00:00:00`).toLocaleDateString('fr-FR') : '—'}</p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-[var(--radiusLarge)] border border-[var(--ms-border)]">
                  <div className="flex items-center gap-2 bg-[var(--ms-bg-subtle)] px-4 py-3">
                    <Package size={16} aria-hidden="true" />
                    <h4 className="text-sm font-semibold text-[var(--ms-text-strong)]">Produits du devis</h4>
                  </div>
                  <ul className="divide-y divide-[var(--ms-border)]">
                    {form.lines.filter((line) => line.product).map((line, index) => {
                      const product = products.find((item) => item._id === line.product);
                      return (
                        <li key={`${line.product}-${index}`} className="flex items-center justify-between gap-3 p-3 text-sm">
                          <span className="min-w-0">
                            <strong className="block truncate text-[var(--ms-text-strong)]">{product?.name || 'Produit'}</strong>
                            <span className="text-[var(--ms-text-muted)]">{line.quantity} × {formatCfa(Number(line.price) || 0)}</span>
                          </span>
                          <strong className="shrink-0 tabular-nums text-[var(--ms-text-strong)]">{formatCfa((Number(line.quantity) || 0) * (Number(line.price) || 0))}</strong>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex items-center justify-between border-t border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4">
                    <span className="font-semibold text-[var(--ms-text-strong)]">Total estimé</span>
                    <strong className="text-lg tabular-nums text-[var(--ms-text-strong)]">{formatCfa(total)}</strong>
                  </div>
                </div>
                {form.note && (
                  <div className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-[var(--ms-text-muted)]">Note</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--ms-text-strong)]">{form.note}</p>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <button type="button" onClick={() => setActiveStep(2)} className="ms-button ms-button-secondary min-h-[44px]">Retour</button>
                  <button type="submit" disabled={saving} className="ms-button ms-button-primary min-h-[44px] justify-center disabled:opacity-60">
                    {saving ? 'Création…' : 'Créer le devis'}
                  </button>
                </div>
              </section>
            )}
          </div>
        </form>
      )}

      {loading ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Chargement…</p>
      ) : devis.length === 0 ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Aucun devis pour le moment.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)]">
          <table className="min-w-full divide-y divide-[var(--ms-border)]">
            <thead className="bg-[var(--ms-bg-subtle)]">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Référence</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Client</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Total</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Statut</th>
                <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Valable jusqu’au</th>
                <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--ms-border)]">
              {devis.map((d) => {
                const status = statusOf(d);
                const st = STATUS[status] || STATUS.draft;
                return (
                  <tr key={d._id}>
                    <td className="px-3 py-2 text-sm font-semibold">{d.reference}</td>
                    <td className="px-3 py-2 text-sm">{d.client?.name || '—'}</td>
                    <td className="px-3 py-2 text-right text-sm tabular-nums">{formatCfa(d.totalAmount)}</td>
                    <td className="px-3 py-2 text-sm">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">{new Date(d.validUntil).toLocaleDateString('fr-FR')}</td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1.5">
                        {d.status === 'draft' && (
                          <button type="button" onClick={() => setStatus(d._id, 'sent')} className="ms-button ms-button-secondary ms-button-sm">Envoyer</button>
                        )}
                        {(d.status === 'draft' || d.status === 'sent') && (
                          <button type="button" onClick={() => setStatus(d._id, 'accepted')} className="ms-button ms-button-secondary ms-button-sm">Accepter</button>
                        )}
                        {d.status === 'sent' && (
                          <button type="button" onClick={() => setStatus(d._id, 'rejected')} className="ms-button ms-button-secondary ms-button-sm">Rejeter</button>
                        )}
                        {d.status === 'accepted' && (
                          <button type="button" onClick={() => convert(d._id)} className="ms-button ms-button-primary ms-button-sm">Convertir</button>
                        )}
                        {d.status !== 'converted' && (
                          <button type="button" onClick={() => remove(d._id)} className="ms-icon-button" aria-label="Supprimer">
                            <Trash2 className="h-4 w-4 text-[var(--ms-danger)]" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Devis;
