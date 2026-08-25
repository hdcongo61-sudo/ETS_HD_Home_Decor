import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Workspace } from '../components/business';
import AdvancedFilters from '../components/AdvancedFilters';
import {
  SALES_FILTERS,
  PRODUCTS_FILTERS,
  EXPENSES_FILTERS,
  CLIENTS_FILTERS,
  EMPLOYEES_FILTERS,
  BANK_FILTERS,
  DOCUMENTS_FILTERS,
  populateDynamicOptions,
} from '../config/filterConfigs';
import {
  ShoppingCart,
  Package,
  Receipt,
  Users,
  UserCog,
  Landmark,
  FileText,
  ArrowLeft,
  Filter,
  Sparkles,
  Info,
} from 'lucide-react';
import api from '../services/api';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const FILTER_PAGES = [
  {
    id: 'sales',
    title: 'Ventes',
    icon: ShoppingCart,
    config: SALES_FILTERS,
    endpoint: '/sales',
    color: 'var(--colorStatusSuccessForeground1)',
    description: 'Filtrez vos ventes par période, statut, montant, mode de paiement et plus',
  },
  {
    id: 'products',
    title: 'Produits',
    icon: Package,
    config: PRODUCTS_FILTERS,
    endpoint: '/products',
    color: 'var(--ms-blue)',
    description: 'Trouvez vos produits par catégorie, stock, prix, fournisseur',
  },
  {
    id: 'expenses',
    title: 'Dépenses',
    icon: Receipt,
    config: EXPENSES_FILTERS,
    endpoint: '/expenses',
    color: 'var(--colorStatusDangerForeground1)',
    description: 'Analysez vos dépenses par catégorie, période et montant',
  },
  {
    id: 'clients',
    title: 'Clients',
    icon: Users,
    config: CLIENTS_FILTERS,
    endpoint: '/clients',
    color: 'var(--colorStatusSuccessForeground1)',
    description: 'Segmentez vos clients par achats, fidélité et dépenses',
  },
  {
    id: 'employees',
    title: 'Employés',
    icon: UserCog,
    config: EMPLOYEES_FILTERS,
    endpoint: '/employees',
    color: 'var(--colorBrandForeground1)',
    description: 'Filtrez vos employés par poste, salaire et date d\'embauche',
  },
  {
    id: 'bank',
    title: 'Banque',
    icon: Landmark,
    config: BANK_FILTERS,
    endpoint: '/bank',
    color: 'var(--colorStatusWarningForeground1)',
    description: 'Suivez vos transactions bancaires par type et période',
  },
  {
    id: 'documents',
    title: 'Documents',
    icon: FileText,
    config: DOCUMENTS_FILTERS,
    endpoint: '/documents',
    color: 'var(--colorNeutralForeground2)',
    description: 'Organisez vos documents par type et date',
  },
];

const UltimateFiltersPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('sales');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [users, setUsers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const activeConfig = FILTER_PAGES.find(p => p.id === activeTab);

  // Charger les options dynamiques
  useEffect(() => {
    const loadDynamicOptions = async () => {
      try {
        // Charger les utilisateurs
        const usersRes = await api.get('/users');
        setUsers(usersRes.data.map(u => ({ value: u._id, label: u.name })));

        // Charger les catégories de produits
        const productsRes = await api.get('/products');
        const uniqueCategories = [...new Set(productsRes.data.map(p => p.category).filter(Boolean))];
        setCategories(uniqueCategories.map(c => ({ value: c, label: c })));

        // Charger les fournisseurs
        const uniqueSuppliers = [...new Set(productsRes.data.map(p => p.supplierName).filter(Boolean))];
        setSuppliers(uniqueSuppliers.map(s => ({ value: s, label: s })));
      } catch (err) {
        console.error('Error loading dynamic options:', err);
      }
    };

    loadDynamicOptions();
  }, []);

  // Configuration avec options dynamiques
  const filterConfig = useMemo(() => {
    if (!activeConfig) return [];

    const dynamicOptions = {
      createdBy: users,
      category: categories,
      supplier: suppliers,
      position: [
        { value: 'manager', label: 'Manager' },
        { value: 'vendeur', label: 'Vendeur' },
        { value: 'caissier', label: 'Caissier' },
        { value: 'magasinier', label: 'Magasinier' },
      ],
    };

    return populateDynamicOptions(activeConfig.config, dynamicOptions);
  }, [activeConfig, users, categories, suppliers]);

  // Charger les données
  const loadData = async (appliedFilters) => {
    if (!activeConfig) return;

    setLoading(true);
    try {
      const params = buildQueryParams(appliedFilters);
      const response = await api.get(activeConfig.endpoint, { params });
      setData(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Error loading data:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Construire les query params
  const buildQueryParams = (filters) => {
    const params = {};

    if (filters.search) params.search = filters.search;

    if (filters.dateRange?.start) params.startDate = filters.dateRange.start;
    if (filters.dateRange?.end) params.endDate = filters.dateRange.end;

    if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
    if (filters.deliveryStatus) params.deliveryStatus = filters.deliveryStatus;
    if (filters.category) params.category = filters.category;
    if (filters.stockStatus) params.stockStatus = filters.stockStatus;
    if (filters.type) params.type = filters.type;

    if (filters.amountRange?.min) params.minAmount = filters.amountRange.min;
    if (filters.amountRange?.max) params.maxAmount = filters.amountRange.max;

    if (filters.priceRange?.min) params.minPrice = filters.priceRange.min;
    if (filters.priceRange?.max) params.maxPrice = filters.priceRange.max;

    if (filters.createdBy) params.createdBy = filters.createdBy;

    if (filters.paymentMethod && Array.isArray(filters.paymentMethod)) {
      params.paymentMethod = filters.paymentMethod.join(',');
    }

    return params;
  };

  // Gérer le changement de filtres
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    loadData(newFilters);
  };

  // Export Excel
  const exportToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(
      data.map((item, index) => {
        const baseData = {
          '#': index + 1,
          'ID': item._id || '',
        };

        switch (activeTab) {
          case 'sales':
            return {
              ...baseData,
              'Référence': item.reference || '',
              'Date': new Date(item.createdAt).toLocaleDateString('fr-FR'),
              'Client': item.client?.name || 'Client inconnu',
              'Montant total': item.totalAmount || 0,
              'Encaissé': item.amountPaid || 0,
              'Reste': (item.totalAmount || 0) - (item.amountPaid || 0),
              'Statut paiement': item.paymentStatus || '',
            };
          case 'products':
            return {
              ...baseData,
              'Nom': item.name || '',
              'Catégorie': item.category || '',
              'Prix': item.price || 0,
              'Stock': item.stock || 0,
              'Fournisseur': item.supplierName || '',
            };
          case 'expenses':
            return {
              ...baseData,
              'Description': item.description || '',
              'Date': new Date(item.date).toLocaleDateString('fr-FR'),
              'Montant': item.amount || 0,
              'Catégorie': item.category || '',
            };
          case 'clients':
            return {
              ...baseData,
              'Nom': item.name || '',
              'Téléphone': item.phone || '',
              'Total dépensé': item.totalSpent || 0,
              'Achats': item.totalPurchases || 0,
            };
          case 'employees':
            return {
              ...baseData,
              'Nom': item.name || '',
              'Poste': item.position || '',
              'Salaire': item.salary || 0,
              'Date embauche': item.hireDate ? new Date(item.hireDate).toLocaleDateString('fr-FR') : '',
            };
          default:
            return baseData;
        }
      })
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, activeConfig.title);

    const fileName = `${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Export PDF
  const exportToPDF = () => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text(`Rapport ${activeConfig.title}`, 14, 22);

    doc.setFontSize(10);
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);
    doc.text(`${data.length} résultat${data.length > 1 ? 's' : ''}`, 14, 36);

    let tableData = [];
    let headers = [];

    switch (activeTab) {
      case 'sales':
        headers = ['Référence', 'Date', 'Client', 'Montant', 'Encaissé', 'Reste'];
        tableData = data.map(item => [
          item.reference || '',
          new Date(item.createdAt).toLocaleDateString('fr-FR'),
          item.client?.name || 'Client inconnu',
          (item.totalAmount || 0).toLocaleString('fr-FR') + ' CFA',
          (item.amountPaid || 0).toLocaleString('fr-FR') + ' CFA',
          ((item.totalAmount || 0) - (item.amountPaid || 0)).toLocaleString('fr-FR') + ' CFA',
        ]);
        break;
      case 'products':
        headers = ['Nom', 'Catégorie', 'Prix', 'Stock'];
        tableData = data.map(item => [
          item.name || '',
          item.category || '',
          (item.price || 0).toLocaleString('fr-FR') + ' CFA',
          item.stock || 0,
        ]);
        break;
      case 'expenses':
        headers = ['Description', 'Date', 'Montant', 'Catégorie'];
        tableData = data.map(item => [
          item.description || '',
          new Date(item.date).toLocaleDateString('fr-FR'),
          (item.amount || 0).toLocaleString('fr-FR') + ' CFA',
          item.category || '',
        ]);
        break;
      default:
        headers = ['Données'];
        tableData = data.map((item, i) => [`Item ${i + 1}`]);
    }

    doc.autoTable({
      head: [headers],
      body: tableData,
      startY: 42,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    const fileName = `${activeTab}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // Export CSV
  const exportToCSV = () => {
    let headers = [];
    let rows = [];

    switch (activeTab) {
      case 'sales':
        headers = ['Référence', 'Date', 'Client', 'Montant Total', 'Encaissé', 'Reste', 'Statut'];
        rows = data.map(item => [
          item.reference || '',
          new Date(item.createdAt).toLocaleDateString('fr-FR'),
          item.client?.name || 'Client inconnu',
          item.totalAmount || 0,
          item.amountPaid || 0,
          (item.totalAmount || 0) - (item.amountPaid || 0),
          item.paymentStatus || '',
        ]);
        break;
      case 'products':
        headers = ['Nom', 'Catégorie', 'Prix', 'Stock', 'Fournisseur'];
        rows = data.map(item => [
          item.name || '',
          item.category || '',
          item.price || 0,
          item.stock || 0,
          item.supplierName || '',
        ]);
        break;
      default:
        headers = ['ID'];
        rows = data.map(item => [item._id || '']);
    }

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${activeTab}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Gérer l'export
  const handleExport = (format) => {
    switch (format) {
      case 'excel':
        exportToExcel();
        break;
      case 'pdf':
        exportToPDF();
        break;
      case 'csv':
        exportToCSV();
        break;
      default:
        console.error('Unknown export format:', format);
    }
  };

  // Charger les données au montage et changement d'onglet
  useEffect(() => {
    setFilters({});
    setData([]);
    loadData({});
  }, [activeTab]);

  return (
    <Workspace>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="ms-button ms-button-secondary ms-button-sm shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Retour</span>
            </button>
            <div className="flex items-center gap-3 min-w-0">
              <span
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]"
                style={{ background: 'var(--ms-blue-soft)', color: 'var(--colorBrandForeground1)' }}
              >
                <Sparkles className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <h1 className="fui-title3 truncate" style={{ color: 'var(--colorNeutralForeground1)' }}>
                  Filtres Ultimes
                </h1>
                <p className="fui-caption1 hidden sm:block" style={{ color: 'var(--colorNeutralForeground3)' }}>
                  Filtrage avancé et export pour toutes vos données
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Info banner */}
        <div
          className="flex items-start gap-3 rounded-[var(--radiusLarge)] border p-3 sm:p-4"
          style={{
            background: 'var(--ms-blue-soft)',
            borderColor: 'var(--colorBrandStroke1)',
          }}
        >
          <Info className="h-5 w-5 shrink-0 mt-0.5" style={{ color: 'var(--colorBrandForeground1)' }} />
          <div className="min-w-0">
            <p className="fui-body1-strong" style={{ color: 'var(--colorBrandForeground1)' }}>
              Système de filtres avancés
            </p>
            <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground2)' }}>
              Utilisez les filtres rapides pour une recherche immédiate, ou dépliez les filtres avancés pour affiner davantage.
              Exportez vos résultats en Excel, PDF ou CSV en un clic.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="fluent-card-filled p-4">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5" style={{ color: 'var(--colorBrandForeground1)' }} />
            <h2 className="fui-subtitle2" style={{ color: 'var(--colorNeutralForeground1)' }}>
              Sélectionnez une catégorie
            </h2>
          </div>

          {/* Mobile: Scroll horizontal avec chips compacts */}
          <div className="sm:hidden">
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
              {FILTER_PAGES.map((page) => {
                const Icon = page.icon;
                const isActive = activeTab === page.id;
                return (
                  <button
                    key={page.id}
                    onClick={() => setActiveTab(page.id)}
                    className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 transition-all ${
                      isActive
                        ? 'border-[var(--ms-blue)] bg-[var(--ms-blue)] text-white'
                        : 'border-[var(--colorNeutralStroke2)] hover:border-[var(--colorNeutralStroke1)] hover:bg-[var(--colorNeutralBackground2)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" style={{ color: isActive ? 'white' : page.color }} />
                    <span className="fui-caption1-strong whitespace-nowrap">
                      {page.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tablet et Desktop: Grille */}
          <div className="hidden sm:grid grid-cols-3 gap-3 lg:grid-cols-4 xl:grid-cols-7">
            {FILTER_PAGES.map((page) => {
              const Icon = page.icon;
              const isActive = activeTab === page.id;
              return (
                <button
                  key={page.id}
                  onClick={() => setActiveTab(page.id)}
                  className={`flex flex-col items-center gap-2 rounded-[var(--radiusLarge)] border p-4 transition-all ${
                    isActive
                      ? 'border-[var(--ms-blue)] bg-[var(--ms-blue-soft)]'
                      : 'border-[var(--colorNeutralStroke2)] hover:border-[var(--colorNeutralStroke1)] hover:bg-[var(--colorNeutralBackground2)]'
                  }`}
                >
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-[var(--radiusMedium)]"
                    style={{
                      background: isActive ? 'var(--ms-blue)' : page.color + '20',
                      color: isActive ? 'white' : page.color,
                    }}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span
                    className="fui-caption1-strong text-center"
                    style={{ color: isActive ? 'var(--colorBrandForeground1)' : 'var(--colorNeutralForeground2)' }}
                  >
                    {page.title}
                  </span>
                </button>
              );
            })}
          </div>

          {activeConfig && (
            <p className="mt-3 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
              {activeConfig.description}
            </p>
          )}
        </div>

        {/* Filters */}
        {activeConfig && (
          <AdvancedFilters
            filterConfig={filterConfig}
            onFilterChange={handleFilterChange}
            onExport={handleExport}
            initialFilters={{}}
            showExport={true}
            exportFormats={['excel', 'pdf', 'csv']}
            loading={loading}
            resultCount={data.length}
          />
        )}

        {/* Results */}
        <div className="fluent-card-filled p-3 sm:p-4">
          <h3 className="fui-subtitle2 mb-4" style={{ color: 'var(--colorNeutralForeground1)' }}>
            Résultats ({data.length})
          </h3>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-solid border-current border-r-transparent" style={{ color: 'var(--ms-blue)' }}></div>
              <p className="mt-4 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                Chargement...
              </p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div
                className="flex h-16 w-16 items-center justify-center rounded-full"
                style={{ background: 'var(--colorNeutralBackground3)' }}
              >
                <Package className="h-8 w-8" style={{ color: 'var(--colorNeutralForeground3)' }} />
              </div>
              <p className="mt-4 fui-body1-strong" style={{ color: 'var(--colorNeutralForeground2)' }}>
                Aucun résultat trouvé
              </p>
              <p className="mt-1 fui-caption1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                Essayez d'ajuster vos filtres
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="space-y-2">
                {data.slice(0, 20).map((item, index) => (
                  <div
                    key={item._id || index}
                    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4 rounded-[var(--radiusMedium)] border p-3 hover:bg-[var(--colorNeutralBackground2)]"
                    style={{ borderColor: 'var(--colorNeutralStroke2)' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="fui-body1-strong truncate">
                        {item.name || item.reference || item.description || item._id}
                      </p>
                      {(item.category || item.client?.name) && (
                        <p className="fui-caption1 truncate" style={{ color: 'var(--colorNeutralForeground3)' }}>
                          {item.category || item.client?.name}
                        </p>
                      )}
                      {/* Afficher info encaissement pour les ventes */}
                      {activeTab === 'sales' && item.amountPaid !== undefined && (
                        <p className="fui-caption1 mt-1" style={{ color: 'var(--colorNeutralForeground3)' }}>
                          Encaissé: <span style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
                            {(item.amountPaid || 0).toLocaleString('fr-FR')} CFA
                          </span>
                          {item.totalAmount > item.amountPaid && (
                            <span style={{ color: 'var(--colorStatusWarningForeground1)' }}>
                              {' · Reste: '}{((item.totalAmount || 0) - (item.amountPaid || 0)).toLocaleString('fr-FR')} CFA
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                    {(item.totalAmount || item.price || item.amount) && (
                      <p className="fui-body1-strong tabular-nums sm:text-right" style={{ color: 'var(--colorStatusSuccessForeground1)' }}>
                        {(item.totalAmount || item.price || item.amount || 0).toLocaleString('fr-FR')} CFA
                      </p>
                    )}
                  </div>
                ))}
                {data.length > 20 && (
                  <p className="fui-caption1 text-center pt-2 px-2" style={{ color: 'var(--colorNeutralForeground3)' }}>
                    {data.length - 20} résultats supplémentaires non affichés (utilisez l'export pour tout voir)
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Workspace>
  );
};

export default UltimateFiltersPage;
