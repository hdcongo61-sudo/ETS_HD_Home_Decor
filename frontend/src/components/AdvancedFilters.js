import React, { useState, useMemo } from 'react';
import { X, Filter, Download, Search, ChevronDown } from 'lucide-react';

/**
 * AdvancedFilters - Composant de filtres avancés réutilisable
 *
 * @param {Object} props
 * @param {Array} props.filterConfig - Configuration des filtres disponibles
 * @param {Function} props.onFilterChange - Callback quand les filtres changent
 * @param {Function} props.onExport - Callback pour l'export
 * @param {Object} props.initialFilters - Valeurs initiales des filtres
 * @param {Boolean} props.showExport - Afficher le bouton export
 * @param {Array} props.exportFormats - Formats d'export disponibles ['excel', 'pdf', 'csv']
 */
const AdvancedFilters = ({
  filterConfig = [],
  onFilterChange,
  onExport,
  initialFilters = {},
  showExport = true,
  exportFormats = ['excel', 'pdf', 'csv'],
  loading = false,
  resultCount = 0,
}) => {
  const [filters, setFilters] = useState(initialFilters);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Compter les filtres actifs
  const activeFilterCount = useMemo(() => {
    return Object.values(filters).filter(v => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.trim() !== '';
      if (typeof v === 'number') return v !== 0;
      return v !== null && v !== undefined;
    }).length;
  }, [filters]);

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  const handleReset = () => {
    setFilters(initialFilters);
    onFilterChange?.(initialFilters);
  };

  const handleExport = (format) => {
    onExport?.(format, filters);
    setShowExportMenu(false);
  };

  // Rendu d'un filtre selon son type
  const renderFilter = (config) => {
    const { key, type, label, placeholder, options, icon: Icon, min, max, step } = config;
    const value = filters[key] || '';

    switch (type) {
      case 'text':
      case 'search':
        return (
          <div key={key} className="flex flex-col gap-2">
            <label className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>
              {Icon && <Icon className="inline h-3.5 w-3.5 mr-1" />}
              {label}
            </label>
            <div className="relative">
              <input
                type="text"
                value={value}
                onChange={(e) => handleFilterChange(key, e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-[var(--radiusMedium)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] px-3 py-2 text-sm focus:border-[var(--ms-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue-soft)]"
              />
              {type === 'search' && (
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--colorNeutralForeground3)]" />
              )}
            </div>
          </div>
        );

      case 'select':
        return (
          <div key={key} className="flex flex-col gap-2">
            <label className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>
              {Icon && <Icon className="inline h-3.5 w-3.5 mr-1" />}
              {label}
            </label>
            <select
              value={value}
              onChange={(e) => handleFilterChange(key, e.target.value)}
              className="w-full rounded-[var(--radiusMedium)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] px-3 py-2 text-sm focus:border-[var(--ms-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue-soft)]"
            >
              <option value="">{placeholder || 'Tous'}</option>
              {options?.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        );

      case 'multiselect':
        return (
          <div key={key} className="flex flex-col gap-2">
            <label className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>
              {Icon && <Icon className="inline h-3.5 w-3.5 mr-1" />}
              {label}
            </label>
            <div className="flex flex-wrap gap-2">
              {options?.map((opt) => {
                const isSelected = Array.isArray(value) && value.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      const current = Array.isArray(value) ? value : [];
                      const newValue = isSelected
                        ? current.filter(v => v !== opt.value)
                        : [...current, opt.value];
                      handleFilterChange(key, newValue);
                    }}
                    className={`px-3 py-1.5 rounded-[var(--radiusMedium)] text-sm font-medium transition-colors ${
                      isSelected
                        ? 'bg-[var(--ms-blue)] text-white'
                        : 'border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] text-[var(--colorNeutralForeground2)] hover:border-[var(--ms-blue)]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>
        );

      case 'date':
        return (
          <div key={key} className="flex flex-col gap-2">
            <label className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>
              {Icon && <Icon className="inline h-3.5 w-3.5 mr-1" />}
              {label}
            </label>
            <input
              type="date"
              value={value}
              onChange={(e) => handleFilterChange(key, e.target.value)}
              className="w-full rounded-[var(--radiusMedium)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] px-3 py-2 text-sm focus:border-[var(--ms-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue-soft)]"
            />
          </div>
        );

      case 'dateRange':
        return (
          <div key={key} className="flex flex-col gap-2">
            <label className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>
              {Icon && <Icon className="inline h-3.5 w-3.5 mr-1" />}
              {label}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date"
                value={value?.start || ''}
                onChange={(e) => handleFilterChange(key, { ...value, start: e.target.value })}
                placeholder="Début"
                className="w-full rounded-[var(--radiusMedium)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] px-3 py-2 text-sm focus:border-[var(--ms-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue-soft)]"
              />
              <input
                type="date"
                value={value?.end || ''}
                onChange={(e) => handleFilterChange(key, { ...value, end: e.target.value })}
                placeholder="Fin"
                className="w-full rounded-[var(--radiusMedium)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] px-3 py-2 text-sm focus:border-[var(--ms-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue-soft)]"
              />
            </div>
          </div>
        );

      case 'number':
      case 'amount':
        return (
          <div key={key} className="flex flex-col gap-2">
            <label className="fui-caption1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>
              {Icon && <Icon className="inline h-3.5 w-3.5 mr-1" />}
              {label}
            </label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                value={value?.min || ''}
                onChange={(e) => handleFilterChange(key, { ...value, min: e.target.value })}
                placeholder="Min"
                min={min}
                max={max}
                step={step}
                className="w-full rounded-[var(--radiusMedium)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] px-3 py-2 text-sm focus:border-[var(--ms-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue-soft)]"
              />
              <input
                type="number"
                value={value?.max || ''}
                onChange={(e) => handleFilterChange(key, { ...value, max: e.target.value })}
                placeholder="Max"
                min={min}
                max={max}
                step={step}
                className="w-full rounded-[var(--radiusMedium)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] px-3 py-2 text-sm focus:border-[var(--ms-blue)] focus:outline-none focus:ring-2 focus:ring-[var(--ms-blue-soft)]"
              />
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Filtres rapides (toujours visibles)
  const quickFilters = filterConfig.filter(f => f.quick);
  // Filtres avancés (dans le panneau expansible)
  const advancedFilters = filterConfig.filter(f => !f.quick);

  return (
    <div className="fluent-card-filled p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5" style={{ color: 'var(--colorBrandForeground1)' }} />
          <h3 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>
            Filtres
          </h3>
          {activeFilterCount > 0 && (
            <span
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: 'var(--ms-blue)', color: 'white' }}
            >
              {activeFilterCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={handleReset}
              className="ms-button ms-button-secondary ms-button-sm"
            >
              <X className="h-4 w-4" />
              Réinitialiser
            </button>
          )}

          {showExport && exportFormats.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu(!showExportMenu)}
                className="ms-button ms-button-primary ms-button-sm"
                disabled={loading || resultCount === 0}
              >
                <Download className="h-4 w-4" />
                Exporter
                <ChevronDown className="h-3.5 w-3.5" />
              </button>

              {showExportMenu && (
                <div
                  className="absolute right-0 top-full mt-2 z-10 min-w-[160px] rounded-[var(--radiusMedium)] border border-[var(--colorNeutralStroke2)] bg-[var(--colorNeutralBackground1)] shadow-lg"
                  style={{ boxShadow: 'var(--ms-shadow)' }}
                >
                  {exportFormats.includes('excel') && (
                    <button
                      type="button"
                      onClick={() => handleExport('excel')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--colorNeutralBackground2)] flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Excel (.xlsx)
                    </button>
                  )}
                  {exportFormats.includes('pdf') && (
                    <button
                      type="button"
                      onClick={() => handleExport('pdf')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--colorNeutralBackground2)] flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      PDF
                    </button>
                  )}
                  {exportFormats.includes('csv') && (
                    <button
                      type="button"
                      onClick={() => handleExport('csv')}
                      className="w-full px-4 py-2 text-left text-sm hover:bg-[var(--colorNeutralBackground2)] flex items-center gap-2"
                    >
                      <Download className="h-4 w-4" />
                      CSV
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Résultat count */}
      {resultCount > 0 && (
        <p className="fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
          {resultCount.toLocaleString('fr-FR')} résultat{resultCount > 1 ? 's' : ''}
          {activeFilterCount > 0 && ` avec ${activeFilterCount} filtre${activeFilterCount > 1 ? 's' : ''} actif${activeFilterCount > 1 ? 's' : ''}`}
        </p>
      )}

      {/* Quick filters (always visible) */}
      {quickFilters.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {quickFilters.map(renderFilter)}
        </div>
      )}

      {/* Advanced filters toggle */}
      {advancedFilters.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2 text-sm font-medium"
            style={{ color: 'var(--colorBrandForeground1)' }}
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            />
            Filtres avancés ({advancedFilters.length})
          </button>

          {isExpanded && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 pt-2 border-t">
              {advancedFilters.map(renderFilter)}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdvancedFilters;
