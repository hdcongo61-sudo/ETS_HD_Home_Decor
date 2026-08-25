// Exemple d'utilisation d'AdvancedFilters dans la page Sales

import React, { useState, useEffect, useMemo } from 'react';
import AdvancedFilters from '../components/AdvancedFilters';
import { SALES_FILTERS, populateDynamicOptions } from '../config/filterConfigs';
import api from '../services/api';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

const SalesWithFilters = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [users, setUsers] = useState([]);

  // Charger les utilisateurs pour le filtre dynamique
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await api.get('/users');
        setUsers(response.data.map(u => ({
          value: u._id,
          label: u.name
        })));
      } catch (err) {
        console.error('Error loading users:', err);
      }
    };
    loadUsers();
  }, []);

  // Configuration des filtres avec options dynamiques
  const filterConfig = useMemo(() => {
    return populateDynamicOptions(SALES_FILTERS, {
      createdBy: users
    });
  }, [users]);

  // Charger les ventes avec filtres
  const loadSales = async (appliedFilters) => {
    setLoading(true);
    try {
      // Construire les query params à partir des filtres
      const params = buildQueryParams(appliedFilters);
      const response = await api.get('/sales', { params });
      setSales(response.data);
    } catch (err) {
      console.error('Error loading sales:', err);
    } finally {
      setLoading(false);
    }
  };

  // Construire les query params pour l'API
  const buildQueryParams = (filters) => {
    const params = {};

    if (filters.search) {
      params.search = filters.search;
    }

    if (filters.dateRange?.start) {
      params.startDate = filters.dateRange.start;
    }
    if (filters.dateRange?.end) {
      params.endDate = filters.dateRange.end;
    }

    if (filters.paymentStatus) {
      params.paymentStatus = filters.paymentStatus;
    }

    if (filters.deliveryStatus) {
      params.deliveryStatus = filters.deliveryStatus;
    }

    if (filters.amountRange?.min) {
      params.minAmount = filters.amountRange.min;
    }
    if (filters.amountRange?.max) {
      params.maxAmount = filters.amountRange.max;
    }

    if (filters.createdBy) {
      params.createdBy = filters.createdBy;
    }

    if (filters.paymentMethod && Array.isArray(filters.paymentMethod) && filters.paymentMethod.length > 0) {
      params.paymentMethod = filters.paymentMethod.join(',');
    }

    if (filters.profitRange?.min) {
      params.minProfit = filters.profitRange.min;
    }
    if (filters.profitRange?.max) {
      params.maxProfit = filters.profitRange.max;
    }

    return params;
  };

  // Gérer le changement de filtres
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    loadSales(newFilters);
  };

  // Export Excel
  const exportToExcel = (filteredSales) => {
    const worksheet = XLSX.utils.json_to_sheet(
      filteredSales.map(sale => ({
        'Référence': sale.reference || '',
        'Date': new Date(sale.createdAt).toLocaleDateString('fr-FR'),
        'Client': sale.client?.name || 'Client inconnu',
        'Montant': sale.totalAmount || 0,
        'Statut paiement': sale.paymentStatus || '',
        'Statut livraison': sale.deliveryStatus || '',
        'Mode paiement': sale.paymentMethod || '',
        'Marge': sale.profit || 0,
        'Créé par': sale.createdBy?.name || '',
      }))
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Ventes');

    const fileName = `ventes_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Export PDF
  const exportToPDF = (filteredSales) => {
    const doc = new jsPDF();

    // Titre
    doc.setFontSize(18);
    doc.text('Rapport des Ventes', 14, 22);

    // Date d'export
    doc.setFontSize(10);
    doc.text(`Exporté le ${new Date().toLocaleDateString('fr-FR')}`, 14, 30);

    // Tableau
    const tableData = filteredSales.map(sale => [
      sale.reference || '',
      new Date(sale.createdAt).toLocaleDateString('fr-FR'),
      sale.client?.name || 'Client inconnu',
      (sale.totalAmount || 0).toLocaleString('fr-FR') + ' CFA',
      sale.paymentStatus || '',
      sale.deliveryStatus || '',
    ]);

    doc.autoTable({
      head: [['Référence', 'Date', 'Client', 'Montant', 'Paiement', 'Livraison']],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [41, 128, 185] },
    });

    const fileName = `ventes_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  };

  // Export CSV
  const exportToCSV = (filteredSales) => {
    const headers = ['Référence', 'Date', 'Client', 'Montant', 'Statut paiement', 'Statut livraison', 'Mode paiement', 'Marge'];
    const rows = filteredSales.map(sale => [
      sale.reference || '',
      new Date(sale.createdAt).toLocaleDateString('fr-FR'),
      sale.client?.name || 'Client inconnu',
      sale.totalAmount || 0,
      sale.paymentStatus || '',
      sale.deliveryStatus || '',
      sale.paymentMethod || '',
      sale.profit || 0,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

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

  // Gérer l'export
  const handleExport = (format, appliedFilters) => {
    // Filtrer les ventes selon les filtres appliqués côté client
    // (ou utiliser les données déjà filtrées depuis le serveur)
    const filteredSales = sales;

    switch (format) {
      case 'excel':
        exportToExcel(filteredSales);
        break;
      case 'pdf':
        exportToPDF(filteredSales);
        break;
      case 'csv':
        exportToCSV(filteredSales);
        break;
      default:
        console.error('Unknown export format:', format);
    }
  };

  // Charger les ventes au montage
  useEffect(() => {
    loadSales({});
  }, []);

  return (
    <div className="space-y-6">
      {/* Filtres avancés */}
      <AdvancedFilters
        filterConfig={filterConfig}
        onFilterChange={handleFilterChange}
        onExport={handleExport}
        initialFilters={{}}
        showExport={true}
        exportFormats={['excel', 'pdf', 'csv']}
        loading={loading}
        resultCount={sales.length}
      />

      {/* Liste des ventes */}
      <div className="fluent-card-filled p-4">
        {loading ? (
          <div className="text-center py-8">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-2 text-sm text-gray-600">Chargement...</p>
          </div>
        ) : sales.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">Aucune vente trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Votre tableau de ventes ici */}
            <table className="min-w-full">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sales.map(sale => (
                  <tr key={sale._id}>
                    <td>{sale.reference}</td>
                    <td>{new Date(sale.createdAt).toLocaleDateString('fr-FR')}</td>
                    <td>{sale.client?.name || 'Client inconnu'}</td>
                    <td>{(sale.totalAmount || 0).toLocaleString('fr-FR')} CFA</td>
                    <td>{sale.paymentStatus}</td>
                    <td>
                      <button>Voir</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesWithFilters;
