const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (res.statusCode === 200 ? 500 : res.statusCode);
  const isProduction = process.env.NODE_ENV === 'production';
  const requestId = req.requestId || res.getHeader('X-Request-Id') || null;
  const code = err.errorCode || (typeof err.code === 'string' && /^[A-Z][A-Z0-9_]+$/.test(err.code) ? err.code : null) || ({
    400: 'VALIDATION_ERROR',
    401: 'AUTH_REQUIRED',
    403: 'FORBIDDEN',
    404: 'RESOURCE_NOT_FOUND',
    409: 'CONFLICT',
    429: 'RATE_LIMITED',
  }[statusCode] || (statusCode >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'));
  res.status(statusCode);
  res.setHeader('X-Request-Id', requestId || 'unknown');
  res.json({
    code,
    requestId,
    message: isProduction && statusCode >= 500 ? 'Erreur serveur' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

module.exports = { errorHandler };
