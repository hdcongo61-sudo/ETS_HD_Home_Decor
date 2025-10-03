import React, { useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const formatDateTime = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const AccessRestricted = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const restrictionInfo = useMemo(() => {
    if (location.state) {
      return location.state;
    }

    const stored = sessionStorage.getItem('accessRestrictionInfo');
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to parse access restriction info', error);
      return null;
    }
  }, [location.state]);

  useEffect(() => {
    return () => {
      sessionStorage.removeItem('accessRestrictionInfo');
    };
  }, []);

  const message = restrictionInfo?.message || 'Accès temporairement restreint.';
  const accessStart = formatDateTime(restrictionInfo?.accessStart);
  const accessEnd = formatDateTime(restrictionInfo?.accessEnd);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-lg w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center space-y-6">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 flex items-center justify-center">
          <svg className="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.293 17.293a1 1 0 01-.083-1.32l6.41-9.015a1 1 0 011.64 0l6.41 9.015a1 1 0 01-.083 1.32A1 1 0 0118.41 18H5.59a1 1 0 01-.297-.707z" />
          </svg>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-semibold text-gray-900">Accès restreint</h1>
          <p className="text-gray-600 leading-relaxed">{message}</p>
        </div>

        {(accessStart || accessEnd) && (
          <div className="bg-gray-50 rounded-xl border border-gray-100 p-4 text-left text-sm text-gray-600 space-y-2">
            {accessStart && (
              <div>
                <span className="font-medium text-gray-800">Accès autorisé à partir de&nbsp;:</span>
                <br />
                <span>{accessStart}</span>
              </div>
            )}
            {accessEnd && (
              <div>
                <span className="font-medium text-gray-800">Accès disponible jusqu'au&nbsp;:</span>
                <br />
                <span>{accessEnd}</span>
              </div>
            )}
          </div>
        )}

        <div className="space-y-3 text-sm text-gray-500">
          <p>Pour toute question, veuillez contacter un administrateur afin d'obtenir une autorisation ou davantage d'informations.</p>
          <p className="italic">Votre accès sera automatiquement rétabli dès que la période autorisée commencera.</p>
        </div>

        <button
          onClick={() => navigate('/login', { replace: true })}
          className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Retour à la connexion
        </button>
      </div>
    </div>
  );
};

export default AccessRestricted;
