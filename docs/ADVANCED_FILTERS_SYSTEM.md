# Advanced Filters System - Ultimate Export & Filtering

**Date:** 2026-08-24  
**Status:** Implemented

## Overview

Système de filtres avancés réutilisable pour toutes les pages (ventes, produits, dépenses, clients, employés, documents, transactions bancaires) avec export intégré en Excel, PDF et CSV.

## Features

### 🎯 Core Features
- ✅ Composant de filtres réutilisable et configurable
- ✅ Support de 7+ types de filtres (text, select, multiselect, date, dateRange, number, amount)
- ✅ Filtres rapides (toujours visibles) et filtres avancés (expansibles)
- ✅ Compteur de filtres actifs
- ✅ Réinitialisation en un clic
- ✅ Export intégré (Excel, PDF, CSV)
- ✅ Design Fluent 2 responsive

### 📊 Export Features
- **Excel (.xlsx)** - Formatage professionnel avec XLSX
- **PDF** - Tableaux avec jsPDF + autoTable
- **CSV** - UTF-8 BOM pour Excel français

### 🔍 Filter Types

| Type | Description | Use Case |
|------|-------------|----------|
| `search` | Champ de recherche avec icône | Recherche globale |
| `text` | Champ texte simple | Saisie libre |
| `select` | Liste déroulante | Choix unique |
| `multiselect` | Boutons multi-sélection | Plusieurs valeurs |
| `date` | Sélecteur de date | Date unique |
| `dateRange` | Deux dates (début/fin) | Période |
| `number` | Plage numérique (min/max) | Quantités |
| `amount` | Plage de montant (min/max) | Prix, montants CFA |

## Architecture

```
frontend/src/
├── components/
│   └── AdvancedFilters.js          # Composant réutilisable
├── config/
│   └── filterConfigs.js            # Configurations prédéfinies
└── examples/
    └── SalesWithFilters.example.js # Exemple d'intégration
```

## Installation

Les dépendances requises sont déjà installées :
- `xlsx` - Export Excel
- `jspdf` + `jspdf-autotable` - Export PDF
- `date-fns` - Manipulation dates
- `lucide-react` - Icônes

## Usage

### 1. Import du composant

```javascript
import AdvancedFilters from '../components/AdvancedFilters';
import { SALES_FILTERS, populateDynamicOptions } from '../config/filterConfigs';
```

### 2. Configuration des filtres

```javascript
const filterConfig = useMemo(() => {
  // Charger les options dynamiques (users, categories, etc.)
  return populateDynamicOptions(SALES_FILTERS, {
    createdBy: users.map(u => ({ value: u._id, label: u.name })),
    category: categories.map(c => ({ value: c, label: c }))
  });
}, [users, categories]);
```

### 3. Intégration du composant

```javascript
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
```

### 4. Gestion des filtres

```javascript
const handleFilterChange = (newFilters) => {
  setFilters(newFilters);
  
  // Construire les query params pour l'API
  const params = buildQueryParams(newFilters);
  
  // Charger les données filtrées
  loadData(params);
};

const buildQueryParams = (filters) => {
  const params = {};
  
  if (filters.search) params.search = filters.search;
  if (filters.dateRange?.start) params.startDate = filters.dateRange.start;
  if (filters.dateRange?.end) params.endDate = filters.dateRange.end;
  if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
  
  // Multiselect: join array values
  if (filters.paymentMethod?.length > 0) {
    params.paymentMethod = filters.paymentMethod.join(',');
  }
  
  // Number/Amount ranges
  if (filters.amountRange?.min) params.minAmount = filters.amountRange.min;
  if (filters.amountRange?.max) params.maxAmount = filters.amountRange.max;
  
  return params;
};
```

### 5. Implémentation de l'export

```javascript
const handleExport = (format, appliedFilters) => {
  const filteredData = data; // Vos données filtrées
  
  switch (format) {
    case 'excel':
      exportToExcel(filteredData);
      break;
    case 'pdf':
      exportToPDF(filteredData);
      break;
    case 'csv':
      exportToCSV(filteredData);
      break;
  }
};

const exportToExcel = (data) => {
  const worksheet = XLSX.utils.json_to_sheet(
    data.map(item => ({
      'Colonne 1': item.field1,
      'Colonne 2': item.field2,
      // ... mapping des colonnes
    }))
  );
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  
  const fileName = `export_${Date.now()}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
```

## Filter Configurations

### Configurations prédéfinies

Le fichier `filterConfigs.js` contient des configurations prêtes à l'emploi :

- **SALES_FILTERS** - Ventes
- **PRODUCTS_FILTERS** - Produits
- **EXPENSES_FILTERS** - Dépenses
- **CLIENTS_FILTERS** - Clients
- **EMPLOYEES_FILTERS** - Employés
- **BANK_FILTERS** - Transactions bancaires
- **DOCUMENTS_FILTERS** - Documents

### Créer une configuration personnalisée

```javascript
export const CUSTOM_FILTERS = [
  {
    key: 'search',           // Clé unique pour identifier le filtre
    type: 'search',          // Type de filtre
    label: 'Rechercher',     // Label affiché
    placeholder: 'Tapez...', // Placeholder du champ
    icon: Search,            // Icône Lucide React
    quick: true,             // true = filtre rapide, false = avancé
  },
  {
    key: 'status',
    type: 'select',
    label: 'Statut',
    icon: Tag,
    quick: true,
    options: [
      { value: 'active', label: 'Actif' },
      { value: 'inactive', label: 'Inactif' },
    ],
  },
  {
    key: 'dateRange',
    type: 'dateRange',
    label: 'Période',
    icon: Calendar,
    quick: true,
  },
  {
    key: 'priceRange',
    type: 'amount',
    label: 'Prix (CFA)',
    icon: DollarSign,
    quick: false,
    min: 0,
    max: 1000000,
    step: 1000,
  },
];
```

## Component API

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `filterConfig` | Array | `[]` | Configuration des filtres |
| `onFilterChange` | Function | - | Callback quand les filtres changent |
| `onExport` | Function | - | Callback pour l'export |
| `initialFilters` | Object | `{}` | Valeurs initiales |
| `showExport` | Boolean | `true` | Afficher le bouton export |
| `exportFormats` | Array | `['excel', 'pdf', 'csv']` | Formats d'export |
| `loading` | Boolean | `false` | État de chargement |
| `resultCount` | Number | `0` | Nombre de résultats |

### Filter Config Object

```javascript
{
  key: 'fieldName',        // Clé unique
  type: 'select',          // Type de filtre
  label: 'Label',          // Label affiché
  placeholder: 'Choisir',  // Placeholder
  icon: IconComponent,     // Icône Lucide React
  quick: true,             // Filtre rapide ou avancé
  options: [               // Pour select/multiselect
    { value: 'val', label: 'Label' }
  ],
  min: 0,                  // Pour number/amount
  max: 1000000,            // Pour number/amount
  step: 1,                 // Pour number/amount
}
```

## Backend Integration

### API Endpoints - Query Parameters

L'intégration backend nécessite l'ajout de support pour les query params :

```javascript
// backend/controllers/saleController.js
exports.getSales = async (req, res) => {
  try {
    const {
      search,
      startDate,
      endDate,
      paymentStatus,
      deliveryStatus,
      minAmount,
      maxAmount,
      createdBy,
      paymentMethod,
      minProfit,
      maxProfit,
    } = req.query;

    let query = { tenantId: req.user.tenantId };

    // Recherche textuelle
    if (search) {
      query.$or = [
        { reference: { $regex: search, $options: 'i' } },
        { 'client.name': { $regex: search, $options: 'i' } },
      ];
    }

    // Plage de dates
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Statuts
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (deliveryStatus) query.deliveryStatus = deliveryStatus;

    // Plages de montants
    if (minAmount || maxAmount) {
      query.totalAmount = {};
      if (minAmount) query.totalAmount.$gte = Number(minAmount);
      if (maxAmount) query.totalAmount.$lte = Number(maxAmount);
    }

    // Créé par
    if (createdBy) query.createdBy = createdBy;

    // Multiselect (comma-separated)
    if (paymentMethod) {
      const methods = paymentMethod.split(',');
      query.paymentMethod = { $in: methods };
    }

    // Plage de profit
    if (minProfit || maxProfit) {
      query.profit = {};
      if (minProfit) query.profit.$gte = Number(minProfit);
      if (maxProfit) query.profit.$lte = Number(maxProfit);
    }

    const sales = await Sale.find(query)
      .populate('client', 'name phone')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    res.json(sales);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
```

### Indexation MongoDB

Pour améliorer les performances des requêtes filtrées :

```javascript
// backend/models/saleModel.js
saleSchema.index({ tenantId: 1, createdAt: -1 });
saleSchema.index({ tenantId: 1, paymentStatus: 1 });
saleSchema.index({ tenantId: 1, deliveryStatus: 1 });
saleSchema.index({ tenantId: 1, totalAmount: 1 });
saleSchema.index({ tenantId: 1, reference: 1 });
saleSchema.index({ tenantId: 1, createdBy: 1 });
```

## Export Implementation Details

### Excel Export (XLSX)

```javascript
import * as XLSX from 'xlsx';

const exportToExcel = (data) => {
  // Préparer les données
  const formattedData = data.map(item => ({
    'Référence': item.reference || '',
    'Date': new Date(item.createdAt).toLocaleDateString('fr-FR'),
    'Client': item.client?.name || 'Client inconnu',
    'Montant': item.totalAmount || 0,
  }));

  // Créer le worksheet
  const worksheet = XLSX.utils.json_to_sheet(formattedData);

  // Styliser les colonnes (largeur)
  worksheet['!cols'] = [
    { wch: 15 }, // Référence
    { wch: 12 }, // Date
    { wch: 25 }, // Client
    { wch: 15 }, // Montant
  ];

  // Créer le workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventes');

  // Télécharger
  const fileName = `ventes_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
```

### PDF Export (jsPDF)

```javascript
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const exportToPDF = (data) => {
  const doc = new jsPDF();

  // En-tête
  doc.setFontSize(18);
  doc.text('Rapport des Ventes', 14, 22);

  doc.setFontSize(10);
  doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);

  // Tableau
  const tableData = data.map(item => [
    item.reference || '',
    new Date(item.createdAt).toLocaleDateString('fr-FR'),
    item.client?.name || 'Client inconnu',
    (item.totalAmount || 0).toLocaleString('fr-FR') + ' CFA',
  ]);

  doc.autoTable({
    head: [['Référence', 'Date', 'Client', 'Montant']],
    body: tableData,
    startY: 35,
    styles: {
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: 255,
      fontStyle: 'bold',
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245],
    },
  });

  // Télécharger
  const fileName = `ventes_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};
```

### CSV Export

```javascript
const exportToCSV = (data) => {
  const headers = ['Référence', 'Date', 'Client', 'Montant'];
  
  const rows = data.map(item => [
    item.reference || '',
    new Date(item.createdAt).toLocaleDateString('fr-FR'),
    item.client?.name || 'Client inconnu',
    item.totalAmount || 0,
  ]);

  // Échapper les guillemets et entourer chaque cellule
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  // UTF-8 BOM pour Excel français
  const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `ventes_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
```

## Responsive Design

### Mobile (< 1024px)
- Filtres rapides en grille 1 colonne
- Boutons empilés verticalement
- Panneau d'export en menu dropdown

### Tablet (768px - 1024px)
- Filtres rapides en grille 2 colonnes
- Boutons côte à côte

### Desktop (≥ 1024px)
- Filtres rapides en grille 3-4 colonnes
- Layout horizontal optimisé

## Performance Optimization

### Client-Side
1. **Debounce search input** - 300ms delay
2. **Memoize filter config** - useMemo sur options dynamiques
3. **Lazy load export libraries** - Import dynamique XLSX/jsPDF

```javascript
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearch) {
    handleFilterChange({ ...filters, search: debouncedSearch });
  }
}, [debouncedSearch]);
```

### Server-Side
1. **Indexes MongoDB** - Sur champs filtrables
2. **Pagination** - Limiter résultats (100-500 max)
3. **Projection** - Ne charger que les champs nécessaires

```javascript
const sales = await Sale.find(query)
  .select('reference createdAt client totalAmount paymentStatus')
  .limit(500)
  .sort({ createdAt: -1 });
```

## Testing

### Manual Testing Checklist

- [ ] Filtres rapides s'affichent correctement
- [ ] Filtres avancés se déplient/replient
- [ ] Compteur de filtres actifs met à jour
- [ ] Réinitialisation efface tous les filtres
- [ ] Recherche textuelle fonctionne
- [ ] Plages de dates fonctionnent
- [ ] Select single fonctionne
- [ ] Multiselect fonctionne
- [ ] Plages de montants fonctionnent
- [ ] Export Excel télécharge
- [ ] Export PDF télécharge
- [ ] Export CSV télécharge (avec BOM UTF-8)
- [ ] Responsive mobile correct
- [ ] Responsive tablette correct
- [ ] Responsive desktop correct

## Future Enhancements

### Phase 2
- [ ] Sauvegarder les filtres favoris dans localStorage
- [ ] Preset filters (ex: "Ventes du mois", "Impayés")
- [ ] URL state management (filtres dans l'URL)
- [ ] Copier lien avec filtres
- [ ] Historique des exports

### Phase 3
- [ ] Export programmé (daily/weekly email)
- [ ] Filtres partagés entre utilisateurs
- [ ] Templates d'export personnalisables
- [ ] Export avec graphiques (PDF/Excel)

## Related Files

- `frontend/src/components/AdvancedFilters.js` - Composant principal
- `frontend/src/config/filterConfigs.js` - Configurations prédéfinies
- `frontend/src/examples/SalesWithFilters.example.js` - Exemple complet

## Notes

- Les filtres sont **client-side** mais peuvent être **server-side** en ajoutant la logique backend
- Export est **client-side** (limite ~10,000 lignes pour performances)
- Pour export de gros volumes (>10k lignes), utiliser export server-side avec streaming
- UTF-8 BOM (`﻿`) requis pour CSV dans Excel français
