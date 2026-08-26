/**
 * Registre de dépréciation des routes (Phase 8.5).
 *
 * Cartographie publiée : route legacy → date de début, coucher de soleil,
 * remplacement v2. Les adaptateurs restent en place jusqu'à zéro usage.
 */
const DEPRECATIONS = [
  {
    method: 'POST',
    path: '/api/products/import',
    since: '2026-08-26',
    sunset: '2026-12-31',
    replacement: '/api/v2/imports/products',
    note: 'Import Excel legacy remplacé par l\'import en étapes (aperçu, validation par ligne, exécution par lots).',
  },
  {
    method: 'POST',
    path: '/api/products/stock-movement',
    since: '2026-08-26',
    sunset: '2026-12-31',
    replacement: '/api/v2/inventory/adjustments',
    note: 'Ajustement legacy remplacé par le registre d\'inventaire (mouvements append-only + balance atomique).',
  },
];

module.exports = { DEPRECATIONS };
