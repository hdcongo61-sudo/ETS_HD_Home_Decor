import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CalendarClock } from 'lucide-react';
import api from '../services/api';
import { productPath } from '../utils/paths';

// Produits proches de la date d'expiration — administration.
const ExpiringProducts = () => {
  const [products, setProducts] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchExpiring = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/products/expiring', { params: { days } });
      setProducts(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || 'Impossible de charger les produits');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    fetchExpiring();
  }, [fetchExpiring]);

  const formatDate = (value) => (value ? new Date(value).toLocaleDateString('fr-FR') : '—');

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}>
            <CalendarClock className="h-5 w-5" />
          </span>
          <div>
            <h1 className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>Produits proches de l'expiration</h1>
            <p className="fui-caption1 mt-0.5" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Anticipez les pertes : lot, date d'expiration et jours restants.
            </p>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-[var(--colorNeutralForeground2)]">
          Échéance
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-[var(--radiusMedium)] border border-[var(--ms-border)] px-2 py-1.5 text-sm">
            <option value={7}>7 jours</option>
            <option value={30}>30 jours</option>
            <option value={90}>90 jours</option>
            <option value={180}>180 jours</option>
          </select>
        </label>
      </div>

      {loading ? (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>Chargement…</p>
      ) : error ? (
        <p className="text-sm text-[var(--ms-danger)]">{error}</p>
      ) : products.length === 0 ? (
        <div className="fluent-card-filled flex items-center gap-3 p-5">
          <AlertTriangle className="h-5 w-5 text-[var(--ms-success)]" />
          <p className="text-sm text-[var(--colorNeutralForeground2)]">Aucun produit n'expire dans cette fenêtre.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {products.map((product) => (
            <li key={product._id} className="fluent-card-filled flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <Link to={productPath(product)} className="font-semibold text-[var(--colorBrandForeground1)] hover:underline">
                  {product.name}
                </Link>
                <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  {product.batchNumber ? `Lot ${product.batchNumber} · ` : ''}
                  Expire le {formatDate(product.expiryDate)} · Stock {product.stock}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${product.daysLeft <= 7 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                {product.daysLeft} j restant{product.daysLeft > 1 ? 's' : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ExpiringProducts;
