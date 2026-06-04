import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';
import { useAppSettings } from '../context/AppSettingsContext';
import { mixHexColors, resolveAppLogo } from '../utils/appBranding';

const Login = () => {
  const [loginId, setLoginId] = useState(''); // téléphone ou email
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lockout, setLockout] = useState(null);
  const [passwordRequestOpen, setPasswordRequestOpen] = useState(false);
  const [passwordRequestReason, setPasswordRequestReason] = useState('');
  const [passwordRequestLoading, setPasswordRequestLoading] = useState(false);
  const [passwordRequestMessage, setPasswordRequestMessage] = useState('');
  const [passwordRequestError, setPasswordRequestError] = useState('');
  const { setAuth } = useContext(AuthContext);
  const { appSettings } = useAppSettings();
  const navigate = useNavigate();
  const branding = appSettings.branding;
  const logoUrl = resolveAppLogo(branding.logoUrl);
  const brandSoft = mixHexColors(branding.primaryColor, 0.88);
  const brandDark = mixHexColors(branding.primaryColor, 0.14, '#000000');

  const isEmail = (value) => typeof value === 'string' && value.includes('@');
  const loginPayload = () => {
    const trimmed = (loginId || '').trim();
    if (!trimmed) return { password };
    const isEmailLogin = isEmail(trimmed);
    return {
      login: trimmed,
      ...(isEmailLogin ? { email: trimmed } : { phone: trimmed }),
      password,
    };
  };

  // Check for existing token on component mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      navigate('/');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data } = await api.post('/users/login', loginPayload());

      // Store token securely (consider using HTTP-only cookies in production)
      localStorage.setItem('token', data.token);

      // Fetch user profile
      const { data: userData } = await api.get('/users/me');

      // Update auth context
      setAuth({
        isAuthenticated: true,
        user: userData,
        isAdmin: userData.isAdmin,
        isLoading: false
      });

      // Redirect based on role
      if (userData.isAdmin) {
        navigate('/');
      } else {
        navigate(`/sales/user/${userData._id}`);
      }
    } catch (err) {
      let errorMessage = 'Identifiants incorrects';

      if (err.response) {
        if (err.response.status === 403) {
          const payload = {
            message: err.response.data?.message || 'Accès restreint. Veuillez contacter un administrateur.',
            accessStart: err.response.data?.accessStart || null,
            accessEnd: err.response.data?.accessEnd || null,
          };
          sessionStorage.setItem('accessRestrictionInfo', JSON.stringify(payload));
          localStorage.removeItem('token');
          navigate('/access-restricted', { state: payload, replace: true });
          return;
        }

        if (err.response.status === 429) {
          errorMessage = 'Trop de tentatives. Veuillez réessayer plus tard.';
          const retryAfter = err.response.headers['retry-after'] || 900; // Default 15 minutes
          setLockout(Date.now() + parseInt(retryAfter, 10) * 1000);
        } else if (err.response.status === 423) {
          const retryAfter = Math.ceil((err.response.data.lockUntil - Date.now()) / 1000);
          errorMessage = `Compte temporairement verrouillé. Réessayez dans ${retryAfter} secondes`;
          setLockout(err.response.data.lockUntil);
        } else if (err.response.data && err.response.data.message) {
          errorMessage = err.response.data.message;
        }
      }

      setError(errorMessage);
      localStorage.removeItem('token');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordUpdateRequest = async (e) => {
    e.preventDefault();
    const login = loginId.trim();
    const reason = passwordRequestReason.trim();

    setPasswordRequestError('');
    setPasswordRequestMessage('');

    if (!login) {
      setPasswordRequestError('Entrez votre téléphone ou email avant d’envoyer la demande.');
      return;
    }

    if (!reason) {
      setPasswordRequestError('Ajoutez la raison pour aider l’admin à comprendre le blocage.');
      return;
    }

    try {
      setPasswordRequestLoading(true);
      const { data } = await api.post('/users/password-update-request', {
        login,
        reason,
      });
      setPasswordRequestMessage(data?.message || 'Demande envoyée à un administrateur.');
      setPasswordRequestReason('');
    } catch (err) {
      setPasswordRequestError(err.response?.data?.message || 'Impossible d’envoyer la demande pour le moment.');
    } finally {
      setPasswordRequestLoading(false);
    }
  };

  // Calculate lockout time remaining
  const getLockoutTime = () => {
    if (!lockout) return null;

    const seconds = Math.ceil((lockout - Date.now()) / 1000);
    if (seconds <= 0) {
      setLockout(null);
      return null;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const lockoutTime = getLockoutTime();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--ms-bg)] p-4">
      <div className="w-full max-w-md rounded-lg border border-[var(--ms-border)] bg-[var(--ms-white)] p-8 shadow-[var(--ms-shadow)]">
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl shadow-sm"
            style={{ backgroundColor: brandSoft }}
          >
            <img
              src={logoUrl}
              alt={branding.shortName || branding.appName}
              className="h-12 w-12 rounded-2xl object-contain bg-white p-1.5 shadow-sm"
            />
          </div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em]" style={{ color: branding.primaryColor }}>
            {branding.appName}
          </p>
          <h2 className="text-3xl font-semibold text-gray-900 mb-2">{branding.loginTitle}</h2>
          <p className="text-gray-600">{branding.loginSubtitle}</p>
          {branding.supportPhone && (
            <p className="mt-3 text-xs text-gray-500">
              Assistance: <span style={{ color: brandDark }}>{branding.supportPhone}</span>
            </p>
          )}
        </div>

        {lockoutTime && (
          <div className="mb-6 p-4 rounded-xl border border-[var(--ms-warning)]/30 bg-[#FFF8DF] text-center">
            <div className="text-[#6B4A00] font-medium text-sm">Compte temporairement verrouille</div>
            <div className="text-2xl font-semibold text-[#6B4A00] mt-1">{lockoutTime}</div>
            <p className="text-xs text-[#6B4A00]/70 mt-1">Suite a plusieurs tentatives echouees</p>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="loginId" className="form-label mb-2 block">Telephone ou email</label>
            <div className="relative">
              <input
                id="loginId"
                type="text"
                inputMode={isEmail(loginId) ? 'email' : 'tel'}
                autoComplete="username"
                value={loginId}
                onChange={(e) => setLoginId(e.target.value)}
                className="form-control pr-11"
                placeholder="07 00 00 00 00 ou exemple@societe.com"
                required
                disabled={!!lockoutTime}
              />
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                  />
                </svg>
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Entrez votre numéro de téléphone ou votre adresse email
            </p>
          </div>

          <div>
            <label htmlFor="password" className="form-label mb-2 block">Mot de passe</label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="form-control pr-11"
                placeholder="••••••••"
                required
                disabled={!!lockoutTime}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                disabled={!!lockoutTime}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {showPassword ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] px-4 py-3 text-sm text-[var(--ms-danger)]">
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            className="ms-button ms-button-primary w-full justify-center"
            disabled={isLoading || !!lockoutTime}
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5 text-white"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Connexion en cours...
              </>
            ) : (
              <>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                {lockoutTime ? 'Compte verrouillé' : 'Se connecter'}
              </>
            )}
          </button>

          <div className="text-center pt-4 border-t border-[var(--ms-border)]">
            <p className="text-sm text-[var(--ms-text-muted)]">
              Vous avez oublie votre mot de passe?{' '}
              <button
                type="button"
                className="font-semibold text-[var(--ms-blue)] hover:text-[var(--ms-blue-dark)] transition-colors"
                onClick={() => {
                  setPasswordRequestOpen((current) => !current);
                  setPasswordRequestError('');
                  setPasswordRequestMessage('');
                }}
              >
                Demander une mise a jour
              </button>
            </p>
          </div>

          {passwordRequestOpen && (
            <div className="rounded-lg border border-[var(--ms-border)] bg-[var(--ms-bg-subtle)] p-4 text-left">
              <div className="mb-3">
                <p className="text-sm font-semibold text-[var(--ms-text)]">Demande de mise a jour du mot de passe</p>
                <p className="mt-1 text-xs text-[var(--ms-text-muted)]">
                  Utilisez le meme telephone ou email que votre compte, puis expliquez pourquoi vous ne pouvez pas vous connecter.
                </p>
              </div>
              <div className="space-y-3">
                <textarea
                  value={passwordRequestReason}
                  onChange={(e) => setPasswordRequestReason(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  className="form-control resize-none"
                  placeholder="Ex: mot de passe oublie, telephone change, compte verrouille..."
                />
                {passwordRequestError && (
                  <div className="rounded-lg border border-[var(--ms-danger)]/20 bg-[#FDF3F4] px-3 py-2 text-sm text-[var(--ms-danger)]">
                    {passwordRequestError}
                  </div>
                )}
                {passwordRequestMessage && (
                  <div className="rounded-lg border border-[var(--ms-success)]/20 bg-[#F1FAF1] px-3 py-2 text-sm text-[var(--ms-success)]">
                    {passwordRequestMessage}
                  </div>
                )}
                <button
                  type="button"
                  onClick={handlePasswordUpdateRequest}
                  disabled={passwordRequestLoading}
                  className="ms-button ms-button-primary w-full justify-center"
                >
                  {passwordRequestLoading ? 'Envoi en cours...' : 'Envoyer la demande'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
