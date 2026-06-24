import React, { useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';
import { AlertCircle, Plus, Trash2 } from 'lucide-react';
import api from '../services/api';
import { FormActionsSticky } from './FormLayout';
import { getSaleTypeText } from '../utils/saleUtils';
import AuthContext from '../context/AuthContext';

const SECTION_TITLE = 'text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ms-text-muted)]';
const cfa = (v) => `${Number(v || 0).toLocaleString('fr-FR')} CFA`;

// Compact read-only stat tile used in the edit-sale summary strip.
const SummaryTile = ({ label, value, valueColor, hint, hintColor, accent }) => (
    <div
        className="rounded-xl border border-[var(--ms-border)] bg-[var(--ms-white)] px-3 py-2.5"
        style={accent ? { boxShadow: `inset 3px 0 0 0 ${accent}` } : undefined}
    >
        <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">{label}</p>
        <p className="mt-0.5 truncate text-sm font-bold" style={{ color: valueColor || 'var(--ms-text-strong)' }}>{value}</p>
        {hint && <p className="truncate text-[11px]" style={{ color: hintColor || 'var(--ms-text-muted)' }}>{hint}</p>}
    </div>
);

const normalizeCollection = (value, nestedKeys = []) => {
    if (Array.isArray(value)) return value;
    for (const key of nestedKeys) {
        if (Array.isArray(value?.[key])) {
            return value[key];
        }
    }
    return [];
};

const toDateTimeLocalValue = (value) => {
    if (!value) return '';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';

    const pad = (part) => String(part).padStart(2, '0');

    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const EditSaleForm = ({ sale, clients, onUpdate, onCancel }) => {
    const { auth } = useContext(AuthContext);
    const manualSaleDateEnabled = Boolean(auth?.user?.isAdmin) && Boolean(auth?.user?.adminPreferences?.manualSaleDateEnabled);
    const [products, setProducts] = useState([]);
    const [selectedProducts, setSelectedProducts] = useState([]);
    const [modificationNote, setModificationNote] = useState('');
    const [saleDate, setSaleDate] = useState('');
    const [errors, setErrors] = useState([]);
    const [formError, setFormError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [stockInfos, setStockInfos] = useState({});
    const [productSearchTerms, setProductSearchTerms] = useState([]);

    useEffect(() => {
        const fetchProducts = async () => {
            try {
                const response = await api.get('/products');
                const normalizedProducts = normalizeCollection(response.data, ['products', 'data']);
                setProducts(normalizedProducts);
                const stockData = {};
                normalizedProducts.forEach(product => {
                    stockData[product._id] = {
                        stock: product.stock,
                        costPrice: product.costPrice
                    };
                });
                setStockInfos(stockData);
            } catch (error) {
                setFormError('Échec du chargement des produits');
                console.error('Error fetching products:', error);
            }
        };

        fetchProducts();

        if (sale) {
            const prefilledProducts = sale.products.map(p => ({
                product: p.product._id,
                quantity: p.quantity,
                price: p.priceAtSale,
                originalQuantity: p.quantity
            }));
            setSelectedProducts(prefilledProducts);
            setProductSearchTerms(prefilledProducts.map(() => ''));
            setErrors(prefilledProducts.map(() => null));
            setSaleDate(toDateTimeLocalValue(sale.saleDate || sale.createdAt));
        }
    }, [sale]);

    const getFilteredProducts = (searchTerm, selectedProductId = '') => {
        const safeTerm = (searchTerm || '').toLowerCase();
        return products.filter((product) => {
            const containerValue = (product.container || '').toLowerCase();
            const hasStock = Number(product.stock) > 0;
            const isCurrentSelection = product._id === selectedProductId;
            return (
                (
                    product.name.toLowerCase().includes(safeTerm) ||
                    containerValue.includes(safeTerm)
                ) &&
                (hasStock || isCurrentSelection)
            );
        });
    };

    const validateForm = () => {
        const newErrors = selectedProducts.map((item) => {
            if (!item.product) return 'Sélectionnez un produit';
            const product = products.find(p => p._id === item.product);
            if (!product) return 'Produit invalide';
            if (item.quantity === '' || item.quantity === null) return "Quantité requise";
            const quantityValue = Number(item.quantity);
            if (!Number.isFinite(quantityValue)) return "Quantité invalide";
            if (quantityValue <= 0) return "Quantité doit être positive";
            const availableStock = (stockInfos[item.product]?.stock || 0) + (item.originalQuantity || 0);
            if (quantityValue > availableStock) return `Stock insuffisant (max: ${availableStock})`;
            const priceValue = Number(item.price);
            if (!Number.isFinite(priceValue) || priceValue <= 0) return "Prix doit être positif";
            if (priceValue < (stockInfos[item.product]?.costPrice || 0)) {
                return `Prix trop bas (min: ${stockInfos[item.product]?.costPrice} CFA)`;
            }
            return null;
        });
        setErrors(newErrors);
        return newErrors.every(error => !error);
    };

    const handleProductChange = (index, productId) => {
        const newProducts = [...selectedProducts];
        const product = products.find(p => p._id === productId);
        newProducts[index] = {
            product: productId,
            quantity: newProducts[index]?.quantity ?? '',
            price: product?.price || newProducts[index].price || 0,
            originalQuantity: newProducts[index].originalQuantity || 0
        };
        setSelectedProducts(newProducts);
        const newSearchTerms = [...productSearchTerms];
        newSearchTerms[index] = '';
        setProductSearchTerms(newSearchTerms);
    };

    const handleQuantityChange = (index, quantity) => {
        const newProducts = [...selectedProducts];
        if (quantity === '') {
            newProducts[index].quantity = '';
        } else {
            const numQuantity = parseInt(quantity, 10);
            if (Number.isNaN(numQuantity)) {
                newProducts[index].quantity = '';
            } else {
                newProducts[index].quantity = Math.max(1, numQuantity);
            }
        }
        setSelectedProducts(newProducts);
    };

    const handlePriceChange = (index, price) => {
        const newProducts = [...selectedProducts];
        const numericPrice = Math.max(0, parseFloat(price) || 0);
        newProducts[index].price = numericPrice;
        setSelectedProducts(newProducts);
    };

    const addProduct = () => {
        setSelectedProducts([
            ...selectedProducts,
            { product: '', quantity: '', price: 0, originalQuantity: 0 }
        ]);
        setProductSearchTerms([...productSearchTerms, '']);
        setErrors([...errors, null]);
    };

    const removeProduct = (index) => {
        setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
        setProductSearchTerms(productSearchTerms.filter((_, i) => i !== index));
        setErrors(errors.filter((_, i) => i !== index));
    };

    const calculateTotal = () => {
        return selectedProducts.reduce((total, item) => {
            const quantity = Number(item.quantity);
            const price = Number(item.price);
            const safeQuantity = Number.isFinite(quantity) && quantity > 0 ? quantity : 0;
            const safePrice = Number.isFinite(price) ? price : 0;
            return total + safeQuantity * safePrice;
        }, 0).toFixed(0);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setFormError('');
        if (!validateForm()) {
            setFormError('Corrigez les erreurs dans le formulaire');
            setIsSubmitting(false);
            return;
        }
        if (!modificationNote.trim()) {
            setFormError('Une note explicative est obligatoire pour les modifications');
            setIsSubmitting(false);
            return;
        }
        try {
            await onUpdate({
                products: selectedProducts.map(item => ({
                    product: item.product,
                    quantity: Number(item.quantity),
                    price: Number(item.price) || 0
                })),
                note: modificationNote.trim(),
                saleDate: manualSaleDateEnabled ? saleDate : undefined
            });
        } catch (error) {
            setFormError(error.response?.data?.message || 'Erreur lors de la mise à jour de la vente');
            setIsSubmitting(false);
        }
    };

    const saleRef = sale?._id ? `#${sale._id.slice(-6).toUpperCase()}` : '';
    const originalTotal = Number(sale?.totalAmount || 0);
    const newTotal = Number(calculateTotal());
    const totalDelta = newTotal - originalTotal;
    const saleDateLabel = new Date(sale.saleDate || sale.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            {formError && (
                <div
                    role="alert"
                    className="flex items-start gap-2.5 rounded-[var(--radiusLarge)] border px-4 py-3 text-sm"
                    style={{ background: 'var(--colorStatusDangerBackground1)', borderColor: 'var(--colorStatusDangerStroke1)', color: 'var(--colorStatusDangerForeground1)' }}
                >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{formError}</span>
                </div>
            )}

            {/* Récapitulatif */}
            <section className="space-y-2.5">
                <h4 className={SECTION_TITLE}>Récapitulatif — Vente {saleRef}</h4>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                    <SummaryTile label="Client" value={sale.client?.name || '—'} />
                    <SummaryTile label="Date de vente" value={saleDateLabel} />
                    <SummaryTile label="Type de vente" value={getSaleTypeText(sale.saleType)} hint="Non modifiable" />
                    <SummaryTile label="Montant original" value={cfa(originalTotal)} />
                    <SummaryTile
                        label="Nouveau total"
                        value={cfa(newTotal)}
                        valueColor="var(--colorBrandForeground1)"
                        accent="var(--colorBrandForeground1)"
                        hint={totalDelta !== 0 ? `${totalDelta > 0 ? '+' : ''}${cfa(totalDelta)} vs original` : 'Inchangé'}
                        hintColor={totalDelta > 0 ? 'var(--ms-success)' : totalDelta < 0 ? 'var(--ms-danger)' : undefined}
                    />
                </div>
            </section>

            {/* Raison de la modification */}
            <section className="space-y-2">
                <h4 className={SECTION_TITLE}>Raison de la modification <span style={{ color: 'var(--ms-danger)' }}>*</span></h4>
                <textarea
                    value={modificationNote}
                    onChange={(e) => setModificationNote(e.target.value)}
                    className="form-control min-h-[110px] resize-y"
                    placeholder="Expliquez pourquoi vous modifiez cette vente (quantités, prix, produits…)"
                    required
                    aria-describedby="modification-note-hint"
                />
                <p id="modification-note-hint" className="form-help">Cette note sera enregistrée dans l’historique de la vente.</p>
            </section>

            {manualSaleDateEnabled && (
                <section className="space-y-2">
                    <h4 className={SECTION_TITLE}>Date réelle de la vente</h4>
                    <input
                        type="datetime-local"
                        value={saleDate}
                        onChange={(e) => setSaleDate(e.target.value)}
                        className="form-control"
                        required
                    />
                    <p className="form-help">
                        Ajustez cette date si la vente a d'abord été notée sur papier puis saisie plus tard dans l'application.
                    </p>
                </section>
            )}

            {/* Lignes de produits */}
            <section className="space-y-3">
                <div className="flex items-center justify-between">
                    <h4 className={SECTION_TITLE}>Lignes de produits</h4>
                    <span className="text-xs text-[var(--ms-text-muted)]">{selectedProducts.length} ligne(s)</span>
                </div>

                <div className="space-y-3">
                    {selectedProducts.map((item, index) => {
                        const selectedProduct = products.find((p) => p._id === item.product);
                        const lineTotal = (Number(item.quantity) || 0) * (Number(item.price) || 0);
                        const hasError = !!errors[index];
                        return (
                            <div
                                key={index}
                                className="rounded-[var(--radiusLarge)] border p-4 space-y-3 transition-colors"
                                style={hasError
                                    ? { borderColor: 'var(--colorStatusDangerStroke1)', background: 'var(--colorStatusDangerBackground1)' }
                                    : { borderColor: 'var(--ms-border)', background: 'var(--ms-bg-subtle)' }}
                            >
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ms-text-muted)]">Article {index + 1}</span>
                                    <div className="flex items-center gap-3">
                                        {lineTotal > 0 && (
                                            <span className="text-xs font-semibold tabular-nums text-[var(--ms-text)]">{cfa(lineTotal)}</span>
                                        )}
                                        {selectedProducts.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeProduct(index)}
                                                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-[var(--ms-danger)] transition-colors hover:bg-[#FDF3F4]"
                                                aria-label={`Supprimer la ligne ${index + 1}`}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                                <span className="hidden sm:inline">Retirer</span>
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <input
                                    type="text"
                                    placeholder="Filtrer par nom ou conteneur…"
                                    className="form-control"
                                    value={productSearchTerms[index] || ''}
                                    onChange={(e) => {
                                        const newTerms = [...productSearchTerms];
                                        newTerms[index] = e.target.value;
                                        setProductSearchTerms(newTerms);
                                    }}
                                    aria-label={`Filtrer les produits pour la ligne ${index + 1}`}
                                />

                                <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                                    <div className="md:col-span-6">
                                        <label className="form-label mb-1 block">Produit</label>
                                        <select
                                            className="form-control"
                                            value={item.product}
                                            onChange={(e) => handleProductChange(index, e.target.value)}
                                            aria-invalid={hasError}
                                            aria-describedby={hasError ? `product-error-${index}` : undefined}
                                        >
                                            <option value="">Sélectionner un produit</option>
                                            {getFilteredProducts(productSearchTerms[index] || '', item.product).map(product => (
                                                <option key={product._id} value={product._id}>
                                                    {product.name} — {product.container?.trim() || 'Non défini'} (Stock: {product.stock})
                                                </option>
                                            ))}
                                        </select>
                                        {selectedProduct && (
                                            <p className="form-help mt-1">Revient à {cfa(selectedProduct.costPrice || 0)}</p>
                                        )}
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="form-label mb-1 block">Quantité</label>
                                        <input
                                            type="number"
                                            inputMode="numeric"
                                            min="1"
                                            step="1"
                                            className="form-control"
                                            value={item.quantity}
                                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                                            aria-invalid={hasError}
                                        />
                                    </div>

                                    <div className="md:col-span-4">
                                        <label className="form-label mb-1 block">Prix unitaire (CFA)</label>
                                        <input
                                            type="number"
                                            inputMode="decimal"
                                            className="form-control"
                                            value={item.price || ''}
                                            onChange={(e) => handlePriceChange(index, e.target.value)}
                                            placeholder="0"
                                            step="1"
                                            min={stockInfos[item.product]?.costPrice || 0}
                                        />
                                    </div>
                                </div>

                                {hasError && (
                                    <p id={`product-error-${index}`} className="flex items-center gap-2 text-sm text-[var(--ms-danger)]" role="alert">
                                        <AlertCircle className="h-4 w-4 shrink-0" />
                                        {errors[index]}
                                    </p>
                                )}
                            </div>
                        );
                    })}
                </div>

                <button
                    type="button"
                    onClick={addProduct}
                    className="form-button-secondary flex w-full items-center justify-center gap-2 text-sm"
                >
                    <Plus className="h-4 w-4" />
                    Ajouter un produit
                </button>
            </section>

            {/* Total */}
            <div
                className="flex items-center justify-between rounded-[var(--radiusLarge)] border px-5 py-4"
                style={{ borderColor: 'var(--ms-border)', background: 'var(--ms-bg-subtle)' }}
            >
                <div className="min-w-0">
                    <span className="font-semibold text-[var(--ms-text)]">Nouveau total</span>
                    {totalDelta !== 0 && (
                        <span className="ml-2 text-xs font-semibold" style={{ color: totalDelta > 0 ? 'var(--ms-success)' : 'var(--ms-danger)' }}>
                            {totalDelta > 0 ? '+' : ''}{cfa(totalDelta)} vs original
                        </span>
                    )}
                </div>
                <span className="text-xl font-bold tabular-nums text-[var(--ms-text-strong)]">{cfa(newTotal)}</span>
            </div>

            <FormActionsSticky>
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={isSubmitting}
                    className="ms-button ms-button-secondary ms-button-md"
                >
                    Annuler
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="ms-button ms-button-primary ms-button-md"
                >
                    {isSubmitting ? (
                        <>
                            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Enregistrement…
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            Enregistrer les modifications
                        </>
                    )}
                </button>
            </FormActionsSticky>
        </form>
    );
};

EditSaleForm.propTypes = {
    sale: PropTypes.object.isRequired,
    clients: PropTypes.array,
    onUpdate: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired
};

export default EditSaleForm;
