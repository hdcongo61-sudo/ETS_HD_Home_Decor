const jwt = require('jsonwebtoken');

const generateToken = (id, tenantId = null) => {
  const payload = { id };
  if (tenantId) payload.tenantId = tenantId.toString();
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

module.exports = generateToken;
