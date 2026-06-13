import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { Building2, User, Mail, Phone, Lock, ArrowRight, CheckCircle2 } from 'lucide-react';

const PLANS = [
  { id: 'trial', label: 'Essai gratuit', price: 'Gratuit pendant 14 jours', features: ['Jusqu\'à 3 utilisateurs', '500 produits', 'Toutes les fonctions'] },
];

const TenantRegister = () => {
  const navigate = useNavigate();
  const { setAuth } = useContext(AuthContext);

  const [form, setForm] = useState({
    shopName: '',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    password: '',
    confirmPassword: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.shopName.trim() || !form.ownerName.trim() || !form.ownerEmail.trim() || !form.password) {
      setError('Tous les champs obligatoires doivent être remplis.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Les mots de passe ne correspondent pas.');
      return;
    }
    if (form.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await api.post('/tenants/register', {
        shopName: form.shopName.trim(),
        ownerName: form.ownerName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerPhone: form.ownerPhone.trim(),
        password: form.password,
      });

      // Store token and set auth state
      localStorage.setItem('token', data.token);
      localStorage.setItem('tenantId', data.tenant._id);

      setAuth({
        isAuthenticated: true,
        user: { ...data.user, isAdmin: true },
        isAdmin: true,
        isSuperAdmin: false,
        tenantId: data.tenant._id,
        isLoading: false,
      });

      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || 'Erreur lors de la création du compte.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: 'var(--colorNeutralBackground2)' }}>
      {/* Header */}
      <div className="text-center mb-8 max-w-md">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: 'var(--colorBrandBackground)' }}>
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <span className="fui-subtitle1" style={{ color: 'var(--colorNeutralForeground1)' }}>HD Gestion</span>
        </div>
        <h1 className="fui-title2 mb-2" style={{ color: 'var(--colorNeutralForeground1)' }}>
          Créez votre boutique
        </h1>
        <p className="fui-body1" style={{ color: 'var(--colorNeutralForeground3)' }}>
          14 jours d'essai gratuit — aucune carte bancaire requise.
        </p>
      </div>

      <div className="w-full max-w-md">
        {/* Features strip */}
        <div className="fluent-card-filled p-4 mb-5">
          <div className="grid grid-cols-3 gap-2 text-center">
            {['Ventes & Stock', 'Clients & Paie', 'Analytics'].map((f) => (
              <div key={f} className="flex flex-col items-center gap-1">
                <CheckCircle2 size={16} style={{ color: 'var(--colorStatusSuccessForeground1)' }} />
                <span className="fui-caption1" style={{ color: 'var(--colorNeutralForeground2)' }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Form */}
        <div className="fluent-card-filled p-6">
          {error && (
            <div className="rounded-[var(--radiusLarge)] px-4 py-3 mb-5 fui-body1"
              style={{ background: 'var(--colorStatusDangerBackground1)', color: 'var(--colorStatusDangerForeground1)', border: '1px solid var(--colorStatusDangerStroke1)' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Shop name */}
            <div>
              <label className="form-label block mb-1.5">Nom de la boutique *</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <input
                  type="text"
                  name="shopName"
                  value={form.shopName}
                  onChange={handleChange}
                  className="form-control pl-9"
                  placeholder="Ex : Boutique Omar"
                  required
                  autoFocus
                />
              </div>
            </div>

            {/* Owner name */}
            <div>
              <label className="form-label block mb-1.5">Votre nom *</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <input
                  type="text"
                  name="ownerName"
                  value={form.ownerName}
                  onChange={handleChange}
                  className="form-control pl-9"
                  placeholder="Prénom et nom"
                  required
                />
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="form-label block mb-1.5">Email *</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <input
                  type="email"
                  name="ownerEmail"
                  value={form.ownerEmail}
                  onChange={handleChange}
                  className="form-control pl-9"
                  placeholder="vous@example.com"
                  required
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="form-label block mb-1.5">Téléphone (optionnel)</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <input
                  type="tel"
                  name="ownerPhone"
                  value={form.ownerPhone}
                  onChange={handleChange}
                  className="form-control pl-9"
                  placeholder="+221 77 000 00 00"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="form-label block mb-1.5">Mot de passe *</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <input
                  type="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className="form-control pl-9"
                  placeholder="Minimum 6 caractères"
                  required
                />
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className="form-label block mb-1.5">Confirmer le mot de passe *</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--colorNeutralForeground3)' }} />
                <input
                  type="password"
                  name="confirmPassword"
                  value={form.confirmPassword}
                  onChange={handleChange}
                  className="form-control pl-9"
                  placeholder="Répétez le mot de passe"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="ms-button ms-button-primary ms-button-md w-full flex items-center justify-center gap-2 mt-2"
            >
              {submitting ? 'Création en cours...' : (
                <>
                  Créer ma boutique
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="fui-caption1 text-center mt-5" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Déjà un compte ?{' '}
            <Link to="/login" style={{ color: 'var(--colorBrandForeground1)' }}>
              Se connecter
            </Link>
          </p>
        </div>

        <p className="fui-caption1 text-center mt-4" style={{ color: 'var(--colorNeutralForeground3)' }}>
          En créant un compte, vous acceptez nos conditions d'utilisation.
        </p>
      </div>
    </div>
  );
};

export default TenantRegister;
