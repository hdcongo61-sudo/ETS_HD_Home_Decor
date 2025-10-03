import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import AuthContext from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [lockout, setLockout] = useState(null);
  const { setAuth } = useContext(AuthContext);
  const navigate = useNavigate();

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
      const { data } = await api.post('/users/login', { email, password });

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
      navigate(userData.isAdmin ? '/' : '/');
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200/80 p-8">
        <div className="text-center mb-8">
          <div className="mx-auto mb-5 w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-sm">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <h2 className="text-3xl font-semibold text-gray-900 mb-2">Connexion</h2>
          <p className="text-gray-600">Accédez à votre espace professionnel</p>
        </div>

        {lockoutTime && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-100 rounded-xl text-center">
            <div className="text-yellow-700 font-medium text-sm">
              Compte temporairement verrouillé
            </div>
            <div className="text-2xl font-semibold text-yellow-800 mt-1">
              {lockoutTime}
            </div>
            <p className="text-xs text-yellow-600 mt-1">
              Suite à plusieurs tentatives échouées
            </p>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Adresse Email
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                placeholder="exemple@societe.com"
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
                    d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
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
            <div className="flex items-center text-red-600 text-sm p-3 bg-red-50 rounded-xl border border-red-100">
              <svg
                className="w-4 h-4 mr-2 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            className={`w-full flex items-center justify-center gap-2 py-4 px-4 text-white rounded-xl transition-all duration-200 font-medium ${lockoutTime
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 active:scale-[0.98]'
              }`}
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
                    d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a 3 0 013-3h7a3 3 0 013 3v1"
                  />
                </svg>
                {lockoutTime ? 'Compte verrouillé' : 'Se connecter'}
              </>
            )}
          </button>

          <div className="text-center pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              Vous avez oublié votre mot de passe?{' '}
              <button
                type="button"
                className="font-medium text-blue-600 hover:text-blue-800 transition-colors"
                onClick={() => alert("Veuillez contacter l'administrateur pour réinitialiser votre mot de passe.")}
              >
                Réinitialiser
              </button>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
