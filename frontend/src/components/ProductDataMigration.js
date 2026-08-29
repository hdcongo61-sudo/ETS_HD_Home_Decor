import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import { catalogApi } from '../features/catalog/api';
import { Surface } from './business';

/**
 * ProductDataMigration - Tool to update existing products with new values from settings
 *
 * Use case: Admin renamed "Container 1" to "Container A" in settings,
 * this tool updates all products using "Container 1" to use "Container A"
 */
const ProductDataMigration = ({ products, onComplete }) => {
  const [lookups, setLookups] = useState({ categories: [], containers: [], warehouses: [], suppliers: [] });
  const [loading, setLoading] = useState(true);
  const [migrating, setMigrating] = useState(false);
  const [migrations, setMigrations] = useState([]);

  const loadLookups = useCallback(async () => {
    try {
      setLoading(true);
      const [cats, conts, whs, supps] = await Promise.all([
        catalogApi.lookupCategories(),
        catalogApi.lookupContainers(),
        catalogApi.lookupWarehouses(),
        catalogApi.lookupSuppliers(),
      ]);
      setLookups({
        categories: cats.data,
        containers: conts.data,
        warehouses: whs.data,
        suppliers: supps.data,
      });

      // Analyze what needs migration
      analyzeMigrations(products, {
        categories: cats.data.map(c => c.name),
        containers: conts.data.map(c => c.name),
        warehouses: whs.data.map(c => c.name),
        suppliers: supps.data.map(c => c.name),
      });
    } catch (error) {
      toast.error('Erreur lors du chargement des paramètres');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [products]);

  useEffect(() => {
    loadLookups();
  }, [loadLookups]);

  const analyzeMigrations = (products, validValues) => {
    const issues = [];

    // Find products with invalid values - only products with stock > 0
    products.forEach(product => {
      // Skip products with no stock
      if (!product.stock || product.stock <= 0) {
        return;
      }

      if (product.category && !validValues.categories.includes(product.category)) {
        issues.push({
          productId: product._id,
          productName: product.name,
          field: 'category',
          currentValue: product.category,
          stock: product.stock,
          issue: 'Catégorie non trouvée dans les paramètres',
        });
      }
      if (product.container && !validValues.containers.includes(product.container)) {
        issues.push({
          productId: product._id,
          productName: product.name,
          field: 'container',
          currentValue: product.container,
          stock: product.stock,
          issue: 'Conteneur non trouvé dans les paramètres',
        });
      }
      if (product.warehouse && !validValues.warehouses.includes(product.warehouse)) {
        issues.push({
          productId: product._id,
          productName: product.name,
          field: 'warehouse',
          currentValue: product.warehouse,
          stock: product.stock,
          issue: 'Entrepôt non trouvé dans les paramètres',
        });
      }
      if (product.supplierName && !validValues.suppliers.includes(product.supplierName)) {
        issues.push({
          productId: product._id,
          productName: product.name,
          field: 'supplierName',
          currentValue: product.supplierName,
          stock: product.stock,
          issue: 'Fournisseur non trouvé dans les paramètres',
        });
      }
    });

    setMigrations(issues);
  };

  const handleMigrate = async (migration, newValue) => {
    try {
      setMigrating(true);
      const updates = { [migration.field]: newValue };
      await catalogApi.bulkUpdate({
        ids: [migration.productId],
        updates,
      });

      toast.success(`${migration.productName} mis à jour`);

      // Remove from migration list
      setMigrations(prev => prev.filter(m =>
        !(m.productId === migration.productId && m.field === migration.field)
      ));

      onComplete?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Erreur lors de la mise à jour');
    } finally {
      setMigrating(false);
    }
  };

  const getFieldOptions = (field) => {
    switch (field) {
      case 'category': return lookups.categories.map(c => c.name);
      case 'container': return lookups.containers.map(c => c.name);
      case 'warehouse': return lookups.warehouses.map(c => c.name);
      case 'supplierName': return lookups.suppliers.map(c => c.name);
      default: return [];
    }
  };

  const getFieldLabel = (field) => {
    switch (field) {
      case 'category': return 'Catégorie';
      case 'container': return 'Conteneur';
      case 'warehouse': return 'Entrepôt';
      case 'supplierName': return 'Fournisseur';
      default: return field;
    }
  };

  if (loading) {
    return (
      <Surface className="p-4">
        <div className="flex items-center gap-2">
          <RefreshCw size={16} className="animate-spin" />
          <p className="fui-body1">Analyse des données...</p>
        </div>
      </Surface>
    );
  }

  if (migrations.length === 0) {
    return (
      <Surface className="p-4 bg-[var(--colorStatusSuccessBackground1)]">
        <p className="fui-body1" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
          ✓ Tous les produits en stock utilisent des valeurs valides des paramètres
        </p>
      </Surface>
    );
  }

  return (
    <Surface className="p-4 space-y-4">
      <div className="flex items-start gap-3">
        <AlertTriangle size={20} className="text-[var(--colorStatusWarningForeground1)] shrink-0 mt-0.5" />
        <div>
          <p className="fui-body1-strong" style={{ color: 'var(--colorStatusWarningForeground1)' }}>
            {migrations.length} produit(s) utilisent des valeurs obsolètes
          </p>
          <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
            Ces valeurs n'existent plus dans les paramètres. Sélectionnez les nouvelles valeurs à utiliser.
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {migrations.map((migration, index) => (
          <div key={index} className="p-3 rounded-[var(--radiusMedium)] border" style={{ borderColor: 'var(--colorNeutralStroke2)', background: 'var(--colorNeutralBackground1)' }}>
            <div className="flex items-start justify-between mb-2">
              <p className="fui-body2-strong">{migration.productName}</p>
              <span className="fui-caption1 px-2 py-0.5 rounded" style={{ background: 'var(--colorNeutralBackground3)', color: 'var(--colorNeutralForeground2)' }}>
                Stock: {migration.stock}
              </span>
            </div>
            <p className="fui-caption1 mb-3" style={{ color: 'var(--colorNeutralForeground3)' }}>
              {getFieldLabel(migration.field)}: <span className="font-mono text-[var(--colorStatusDangerForeground1)]">{migration.currentValue}</span>
            </p>

            <div className="flex items-center gap-2">
              <select
                className="form-control flex-1"
                onChange={(e) => {
                  if (e.target.value) {
                    handleMigrate(migration, e.target.value);
                  }
                }}
                disabled={migrating}
              >
                <option value="">Choisir une nouvelle valeur...</option>
                {getFieldOptions(migration.field).map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              <ArrowRight size={16} className="text-[var(--colorBrandForeground1)]" />
            </div>
          </div>
        ))}
      </div>
    </Surface>
  );
};

export default ProductDataMigration;
