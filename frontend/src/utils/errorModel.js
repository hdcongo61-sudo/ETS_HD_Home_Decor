const MESSAGE_BY_STATUS = {
  400: 'La demande contient des informations invalides.',
  401: 'Votre session a expire. Reconnectez-vous pour continuer.',
  403: 'Vous n’avez pas l’autorisation d’effectuer cette action.',
  404: 'La ressource demandée est introuvable.',
  409: 'Cette donnée a changé. Actualisez la page puis réessayez.',
  429: 'Trop de demandes. Patientez quelques instants puis réessayez.',
};

const getErrorType = (error) => {
  const status = error?.response?.status;
  const code = error?.response?.data?.code;
  if (code === 'FEATURE_NOT_IN_PLAN' || status === 403) return 'permission';
  if (status === 401) return 'auth';
  if (status === 409) return 'conflict';
  if (status >= 400 && status < 500) return 'validation';
  if (error?.fromOfflineCache) return 'offline';
  if (!error?.response) return 'network';
  if (status >= 500) return 'server';
  return 'unknown';
};

export const normalizeApiError = (error, fallback = 'Une erreur est survenue.') => {
  const response = error?.response;
  const status = response?.status;
  const data = response?.data || {};
  const message = data.message || data.error || (status ? MESSAGE_BY_STATUS[status] : null) || fallback;

  return {
    type: getErrorType(error),
    code: data.code || error?.code || 'UNKNOWN_ERROR',
    title: data.title || (getErrorType(error) === 'network' ? 'Connexion indisponible' : 'Action impossible'),
    message,
    requestId: data.requestId || response?.headers?.['x-request-id'] || null,
    status: status || null,
    retryable: !status || status >= 500 || status === 409,
  };
};

export const getErrorMessage = (error, fallback) => normalizeApiError(error, fallback).message;

