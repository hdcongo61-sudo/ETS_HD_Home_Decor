import api from './api';

/**
 * API client for product variants and attribute definitions.
 * Supports fashion collections, size matrices, and configurable attributes.
 */

// ── Attribute Definitions (Taille, Couleur, etc.) ──
export const attributeApi = {
  // List all attributes for this tenant
  list: () => api.get('/attribute-definitions'),

  // Create new attribute (e.g., Taille with options S, M, L, XL)
  create: (data) => api.post('/attribute-definitions', data),

  // Update attribute
  update: (id, data) => api.put(`/attribute-definitions/${id}`, data),

  // Delete attribute
  delete: (id) => api.delete(`/attribute-definitions/${id}`),
};

// ── Product Variants ──
export const variantApi = {
  // List variants for a product
  list: (productId) => api.get('/variants', { params: { productId } }),

  // Create new variant
  create: (data) => api.post('/variants', data),

  // Update variant
  update: (id, data) => api.put(`/variants/${id}`, data),

  // Delete variant
  delete: (id) => api.delete(`/variants/${id}`),

  // Bulk create variants (generate all combinations)
  bulkCreate: async (productId, optionSets) => {
    // optionSets example: { color: ['Rouge', 'Bleu'], size: ['S', 'M', 'L'] }
    const keys = Object.keys(optionSets);
    const values = Object.values(optionSets);

    // Generate all combinations
    const combinations = values.reduce(
      (acc, curr) => acc.flatMap(a => curr.map(b => [...a, b])),
      [[]]
    );

    // Create variants for each combination
    const results = [];
    for (const combo of combinations) {
      const optionValues = {};
      keys.forEach((key, idx) => {
        optionValues[key] = combo[idx];
      });

      try {
        const result = await api.post('/variants', {
          productId,
          optionValues,
          status: 'active',
        });
        results.push(result.data);
      } catch (error) {
        console.error('Failed to create variant:', optionValues, error);
      }
    }

    return results;
  },
};

const variantServices = { attributeApi, variantApi };

export default variantServices;
