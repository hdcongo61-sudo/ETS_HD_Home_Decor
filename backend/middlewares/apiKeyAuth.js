const crypto = require('crypto');
const Tenant = require('../models/tenantModel');

const sha256 = (value) => crypto.createHash('sha256').update(String(value || '')).digest('hex');

// Authentifie une requête d'API publique via l'en-tête X-API-Key (clé brute),
// résout la boutique correspondante et pose req.tenantId pour que
// tenantGuardPlugin isole automatiquement toutes les requêtes.
const apiKeyAuth = async (req, res, next) => {
  try {
    const key = String(req.headers['x-api-key'] || req.query.api_key || '').trim();
    if (!key || key.length < 16) {
      return res.status(401).json({ message: 'Clé API requise (en-tête X-API-Key).' });
    }

    const tenant = await Tenant.findOne({ apiKeyHash: sha256(key) }).select('_id name status plan');
    if (!tenant) {
      return res.status(401).json({ message: 'Clé API invalide.' });
    }
    if (tenant.status === 'suspended' || tenant.status === 'expired') {
      return res.status(403).json({ message: 'Boutique suspendue ou expirée.' });
    }

    req.tenantId = tenant._id;
    req.tenant = tenant;
    req.isPublicApi = true;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = apiKeyAuth;
