const errorHandler = (err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(statusCode);
  res.json({
    message: isProduction && statusCode >= 500 ? 'Erreur serveur' : err.message,
    ...(isProduction ? {} : { stack: err.stack }),
  });
};

module.exports = { errorHandler };
