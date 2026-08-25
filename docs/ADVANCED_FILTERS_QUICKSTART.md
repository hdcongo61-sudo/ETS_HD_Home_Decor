# Quick Start - Advanced Filters Integration

Ce guide vous montre comment intégrer rapidement les filtres avancés dans vos pages existantes.

## 🚀 En 5 minutes

### 1. Importez le composant et la config

```javascript
import AdvancedFilters from '../components/AdvancedFilters';
import { SALES_FILTERS } from '../config/filterConfigs';
```

### 2. Ajoutez l'état des filtres

```javascript
const [filters, setFilters] = useState({});
const [data, setData] = useState([]);
const [loading, setLoading] = useState(false);
```

### 3. Gérez les changements de filtres

```javascript
const handleFilterChange = (newFilters) => {
  setFilters(newFilters);
  // Rechargez vos données avec les nouveaux filtres
  loadData(newFilters);
};
```

### 4. Ajoutez le composant dans votre JSX

```javascript
return (
  <div className="space-y-6">
    <AdvancedFilters
      filterConfig={SALES_FILTERS}
      onFilterChange={handleFilterChange}
      onExport={handleExport}
      resultCount={data.length}
    />
    
    {/* Votre contenu (tableau, cartes, etc.) */}
  </div>
);
```

### 5. Implémentez l'export (optionnel)

```javascript
const handleExport = (format) => {
  if (format === 'excel') {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Export');
    XLSX.writeFile(workbook, `export_${Date.now()}.xlsx`);
  }
};
```

## 📋 Configurations disponibles

```javascript
import {
  SALES_FILTERS,      // Ventes
  PRODUCTS_FILTERS,   // Produits
  EXPENSES_FILTERS,   // Dépenses
  CLIENTS_FILTERS,    // Clients
  EMPLOYEES_FILTERS,  // Employés
  BANK_FILTERS,       // Transactions bancaires
  DOCUMENTS_FILTERS,  // Documents
} from '../config/filterConfigs';
```

## 🎨 Personnalisation

### Modifier une config existante

```javascript
const myFilters = SALES_FILTERS.filter(f => f.key !== 'deliveryStatus');
```

### Ajouter des options dynamiques

```javascript
import { populateDynamicOptions } from '../config/filterConfigs';

const filterConfig = populateDynamicOptions(SALES_FILTERS, {
  createdBy: users.map(u => ({ value: u._id, label: u.name }))
});
```

### Créer une config personnalisée

```javascript
const CUSTOM_FILTERS = [
  {
    key: 'search',
    type: 'search',
    label: 'Rechercher',
    placeholder: 'Tapez...',
    icon: Search,
    quick: true,
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
];
```

## 🔧 Props du composant

| Prop | Requis | Type | Description |
|------|--------|------|-------------|
| `filterConfig` | ✅ | Array | Configuration des filtres |
| `onFilterChange` | ✅ | Function | Callback changement filtres |
| `onExport` | ❌ | Function | Callback export |
| `initialFilters` | ❌ | Object | Valeurs initiales |
| `showExport` | ❌ | Boolean | Afficher bouton export |
| `exportFormats` | ❌ | Array | Formats disponibles |
| `loading` | ❌ | Boolean | État chargement |
| `resultCount` | ❌ | Number | Nombre de résultats |

## 📦 Types de filtres supportés

- **search** - Recherche textuelle avec icône
- **text** - Champ texte simple
- **select** - Liste déroulante
- **multiselect** - Sélection multiple (boutons)
- **date** - Sélecteur de date
- **dateRange** - Plage de dates (début/fin)
- **number** - Plage numérique
- **amount** - Plage de montant (CFA)

## 💡 Exemples complets

Voir `frontend/src/examples/SalesWithFilters.example.js` pour un exemple complet avec :
- Chargement des données
- Filtrage
- Export Excel/PDF/CSV
- Gestion des options dynamiques

## 🎯 Bonnes pratiques

1. **Filtres rapides vs avancés** : Mettez les filtres les plus utilisés en `quick: true`
2. **Options dynamiques** : Chargez-les au montage du composant
3. **Debounce search** : Ajoutez un délai pour la recherche textuelle
4. **Pagination** : Limitez les résultats côté serveur (100-500 max)
5. **Export** : Pour >10k lignes, utilisez export côté serveur

## 🐛 Troubleshooting

**Filtres ne s'affichent pas ?**
- Vérifiez que `filterConfig` est un tableau non vide
- Vérifiez que chaque filtre a `key`, `type`, et `label`

**Export ne fonctionne pas ?**
- Vérifiez que `onExport` est défini
- Vérifiez que XLSX/jsPDF sont installés

**Options dynamiques vides ?**
- Utilisez `populateDynamicOptions()` avec les données chargées
- Vérifiez que les données sont au format `{ value, label }`

## 📚 Documentation complète

Voir [ADVANCED_FILTERS_SYSTEM.md](./ADVANCED_FILTERS_SYSTEM.md) pour :
- Architecture détaillée
- Intégration backend
- Exemples d'export
- Performance optimization
- API complète
