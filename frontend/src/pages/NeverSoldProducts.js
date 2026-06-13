import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import api from '../services/api';
import {
  PieChart, Pie, Cell, Tooltip, Legend,
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import useResponsiveTable from '../hooks/useResponsiveTable';
import { productEditPath, productPath } from '../utils/paths';
import {
  ProductActionButton,
  ProductHero,
  ProductMetricCard,
  ProductPageShell,
} from '../components/ProductAnalyticsUI';
import { Workspace } from '../components/business';
import { Download, FileText, PackageCheck, PackageX, Percent, Wallet } from 'lucide-react';
import { useAppSettings } from '../context/AppSettingsContext';
import { getCompanyIdentity, getLogoDataUrl } from '../utils/appBranding';

const NeverSoldProducts = () => {
  const { appSettings } = useAppSettings();
  const company = getCompanyIdentity(appSettings.branding);
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const tableRef = useRef(null);

  useResponsiveTable(tableRef, [filteredData]);

  // Charger les données
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await api.get('/products/never-sold');
        const neverSold = res.data.products || [];

        setData(neverSold);
        setFilteredData(neverSold);
        setStats({
          total: res.data.count,
          stockValue: res.data.stockValue,
          totalProducts: res.data.totalProducts,
          totalStockValue: res.data.totalStockValue,
          categoryDistribution: res.data.categoryDistribution || []
        });
      } catch (err) {
        console.error(err);
        setError('Erreur lors du chargement des données.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Recherche + Filtre
  useEffect(() => {
    const filtered = data.filter(
      (p) =>
        (!filterCategory || p.category === filterCategory) &&
        (!search || p.name.toLowerCase().includes(search.toLowerCase()))
    );
    setFilteredData(filtered);
  }, [search, filterCategory, data]);

  const exportToExcel = () => {
    import('xlsx').then((xlsx) => {
      const ws = xlsx.utils.json_to_sheet(filteredData);
      const wb = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(wb, ws, 'Produits Jamais Vendus');
      xlsx.writeFile(wb, 'produits_jamais_vendus.xlsx');
    });
  };

  // === EXPORT PDF avec logo ===
const exportToPDF = async () => {
  const [{ jsPDF }, autoTable] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'A4',
  });

  // 🔹 Logo de la boutique (depuis ses paramètres)
  const logoImg = await getLogoDataUrl(company.logoUrl);
  if (logoImg) {
    try { doc.addImage(logoImg, 'PNG', 40, 25, 70, 70); } catch { /* ignore */ }
  }

  // Titre principal — nom de la boutique
  doc.setFontSize(18);
  doc.setTextColor(50, 50, 50);
  doc.text((company.name || '').toUpperCase(), 130, 55);
  doc.setFontSize(14);
  doc.setTextColor(90, 90, 90);
  doc.text('Rapport - Produits Jamais Vendus', 130, 75);

  // Date
  doc.setFontSize(10);
  doc.setTextColor(120, 120, 120);
  doc.text(`Généré le : ${new Date().toLocaleString()}`, 130, 90);

  // Ligne de séparation
  doc.setDrawColor(180);
  doc.line(40, 100, 800, 100);

  // Données du tableau
  const tableColumn = ['#', 'Nom', 'Catégorie', 'Prix (CFA)', 'Stock', 'Valeur de Stock'];
  const tableRows = filteredData.map((p, i) => [
    i + 1,
    p.name,
    p.category || 'Non catégorisé',
    (p.price || 0).toLocaleString(),
    p.stock || 0,
    ((p.price || 0) * (p.stock || 0)).toLocaleString(),
  ]);

  autoTable.default(doc, {
    head: [tableColumn],
    body: tableRows,
    startY: 120,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [245, 247, 255] },
    margin: { left: 40, right: 40 },
  });

  // Calcul total
  const totalStockValue = filteredData.reduce(
    (sum, p) => sum + (p.price || 0) * (p.stock || 0),
    0
  );

  // Résumé final
  doc.setFontSize(12);
  doc.setTextColor(30, 30, 30);
  doc.text(
    `Valeur totale du stock des produits jamais vendus : ${totalStockValue.toLocaleString()} CFA`,
    40,
    doc.lastAutoTable.finalY + 30
  );

  // Pied de page — identité de la boutique
  doc.setFontSize(9);
  doc.setTextColor(130, 130, 130);
  const footerParts = [
    (company.name || '').toUpperCase(),
    company.address,
    company.phone && `Tél : ${company.phone}`,
  ].filter(Boolean);
  doc.text(footerParts.join(' — '), 40, 550);

  // Sauvegarde
  const pdfName = `Produits_Jamais_Vendus_${new Date().toLocaleDateString()}.pdf`;
  doc.save(pdfName);
};


  if (loading)
    return (
      <div className="flex justify-center items-center h-72">
        <div className="animate-spin rounded-full h-14 w-14 border-t-4 border-indigo-500"></div>
      </div>
    );

  if (error)
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl shadow">
        {error}
      </div>
    );

  return (
    <motion.div
      className="contents"
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
    <Workspace>
      <ProductPageShell>
      <ProductHero
        eyebrow="Inventaire dormant"
        title="Produits jamais vendus"
        description="Analyse des articles sans ventes depuis leur ajout."
        onBack={() => navigate('/product-dashboard')}
      />

      {/* Barre résumé */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ProductMetricCard label="Produits Jamais Vendus" title="Produits jamais vendus" value={stats.total} tone="violet" icon={PackageX} />
        <ProductMetricCard title="Valeur du stock" value={`${(stats.stockValue || 0).toLocaleString()} CFA`} tone="emerald" icon={Wallet} />
        <ProductMetricCard title="% produits" value={stats.totalProducts ? ((stats.total / stats.totalProducts) * 100).toFixed(1) + '%' : '0%'} tone="sky" icon={Percent} />
        <ProductMetricCard title="% valeur totale" value={stats.totalStockValue ? ((stats.stockValue / stats.totalStockValue) * 100).toFixed(1) + '%' : '0%'} tone="amber" icon={PackageCheck} />
      </div>

      {/* Filtres et exports */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex gap-3 w-full md:w-1/2">
          <input
            type="text"
            placeholder="🔍 Rechercher un produit..."
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-400"
          />
          <select
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border rounded-xl shadow-sm"
          >
            <option value="">Toutes les catégories</option>
            {Array.from(new Set(data.map(p => p.category || 'Non catégorisé'))).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-3">
          <ProductActionButton onClick={exportToExcel} variant="primary" icon={Download}>
            Excel
          </ProductActionButton>
          <ProductActionButton onClick={exportToPDF} icon={FileText}>
            PDF
          </ProductActionButton>
        </div>
      </div>

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
        <ChartCard title="Répartition par Catégorie">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats.categoryDistribution}
                dataKey="count"
                nameKey="category"
                outerRadius={100}
                label={({ name, percent }) =>
                  `${name}: ${(percent * 100).toFixed(0)}%`
                }
              >
                {stats.categoryDistribution.map((_, i) => (
                  <Cell
                    key={i}
                    fill={['#6366F1', '#22C55E', '#F59E0B', '#A855F7'][i % 4]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Top 10 Valeur de Stock Immobilisée">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={filteredData.slice(0, 10)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(v) => [`${v.toLocaleString()} CFA`, 'Valeur']} />
              <Bar
                dataKey={(p) => (p.stock || 0) * (p.price || 0)}
                name="Valeur du Stock"
                fill="#8B5CF6"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tableau principal */}
      <div className="bg-white rounded-2xl shadow border border-gray-100 overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h3 className="text-xl font-semibold text-gray-800">
            Liste des Produits Jamais Vendus
          </h3>
          <span className="text-sm text-gray-500">
            {filteredData.length} produit(s)
          </span>
        </div>

        {filteredData.length > 0 ? (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table ref={tableRef} className="min-w-full divide-y divide-gray-100 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Produit', 'Catégorie', 'Fournisseur', 'Prix', 'Stock', 'Actions'].map(h => (
                      <th key={h} className="px-6 py-3 text-left font-medium text-gray-600 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredData.map((product, i) => (
                    <motion.tr
                      key={product._id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      className="hover:bg-indigo-50 transition-colors"
                    >
                      <td className="px-6 py-3 font-medium text-gray-800">
                        {product.name}
                      </td>
                      <td className="px-6 py-3 text-gray-600">
                        {product.category || 'Non catégorisé'}
                      </td>
                      <td className="px-6 py-3 text-gray-600">
                        {product.supplierName || '—'}
                      </td>
                      <td className="px-6 py-3 text-gray-700 font-medium">
                        {product.price?.toLocaleString()} CFA
                      </td>
                      <td className="px-6 py-3 text-gray-700">{product.stock}</td>
                      <td className="px-6 py-3 flex gap-3">
                        <button
                          onClick={() => navigate(productPath(product))}
                          className="text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Voir
                        </button>
                        <button
                          onClick={() => navigate(productEditPath(product))}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          Modifier
                        </button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden space-y-4">
              {filteredData.map((product, i) => (
              <motion.div
                key={product._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="bg-white rounded-2xl shadow border border-gray-100 p-4"
              >
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-base font-semibold text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.category || 'Non catégorisé'}</p>
                    </div>
                    <span className="text-xs text-gray-500">
                      {product.price?.toLocaleString()} CFA
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Fournisseur : <span className="text-gray-800">{product.supplierName || '—'}</span>
                  </p>
                  <div className="flex items-center justify-between mt-3 text-sm">
                    <span className="text-gray-600">Stock : {product.stock}</span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(productPath(product))}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Voir
                      </button>
                      <button
                        onClick={() => navigate(productEditPath(product))}
                        className="text-green-600 hover:text-green-800 font-medium"
                      >
                        Modifier
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">
              🎉 Tous les produits ont été vendus au moins une fois !
            </p>
          </div>
        )}
      </div>

      {/* Message analytique */}
      {stats.totalProducts && (
        <div className="bg-indigo-50 border border-indigo-100 text-indigo-700 p-4 rounded-xl shadow-sm mt-8">
          {stats.total / stats.totalProducts > 0.3
            ? '⚠️ Plus de 30% de vos produits n’ont jamais été vendus. Pensez à une promotion ou une mise en avant visuelle.'
            : '✅ Excellent ! Moins de 30% de vos produits n’ont jamais été vendus.'}
        </div>
      )}
      </ProductPageShell>
    </Workspace>
    </motion.div>
  );
};

/* --- Composants réutilisables --- */
const ChartCard = ({ title, children }) => (
  <motion.div
    className="bg-white rounded-2xl shadow-md p-6 border border-gray-100"
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.4 }}
  >
    <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
    {children}
  </motion.div>
);

export default NeverSoldProducts;
