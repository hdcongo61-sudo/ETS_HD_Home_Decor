const excel = require('exceljs');
const Sale = require('../models/saleModel');
const asyncHandler = require('express-async-handler');

const generateSalesReport = asyncHandler(async (req, res) => {
  try {
    const { period, startDate, endDate, status } = req.query;

    // Déterminer la période
    let filter = {};
    if (period === 'custom' && startDate && endDate) {
      // Validation des dates personnalisées
      const start = new Date(startDate);
      const end = new Date(endDate);

      if (start > end) {
        return res.status(400).json({
          message: 'La date de début doit être avant la date de fin'
        });
      }

      const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
      if (diffDays > 365) {
        return res.status(400).json({
          message: 'La période ne peut pas dépasser 1 an'
        });
      }

      filter.createdAt = {
        $gte: start,
        $lte: end
      };
    } else {
      const now = new Date();
      switch (period) {
        case 'daily':
          const startOfDay = new Date(now);
          startOfDay.setHours(0, 0, 0, 0);

          const endOfDay = new Date(now);
          endOfDay.setHours(23, 59, 59, 999);

          filter.createdAt = {
            $gte: startOfDay,
            $lte: endOfDay
          };
          break;
        case 'weekly':
          const startWeek = new Date(now);
          startWeek.setDate(now.getDate() - now.getDay());
          startWeek.setHours(0, 0, 0, 0);

          const endWeek = new Date(startWeek);
          endWeek.setDate(startWeek.getDate() + 6);
          endWeek.setHours(23, 59, 59, 999);

          filter.createdAt = {
            $gte: startWeek,
            $lte: endWeek
          };
          break;
        case 'monthly':
          const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          const endMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          endMonth.setHours(23, 59, 59, 999);

          filter.createdAt = {
            $gte: startMonth,
            $lte: endMonth
          };
          break;
        default:
          return res.status(400).json({ message: 'Période invalide' });
      }
    }

    // Filtrer par statut si spécifié
    const validStatuses = ['pending', 'partially_paid', 'completed', 'cancelled'];
    if (status && status !== 'all' && validStatuses.includes(status)) {
      filter.status = status;
    }

    // Récupérer les données avec les paiements
    const sales = await Sale.find(filter)
      .populate('client', 'name')
      .populate('products.product', 'name price')
      .populate({
        path: 'payments.user',
        select: 'name role'
      })
      .sort({ createdAt: -1 });

    // Créer le fichier Excel
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Ventes');

    // Entêtes avec colonnes supplémentaires
    worksheet.columns = [
      { header: 'ID Vente', key: 'saleId', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Client', key: 'client', width: 25 },
      { header: 'Produit', key: 'product', width: 30 },
      { header: 'Quantité', key: 'quantity', width: 10 },
      { header: 'Prix Unitaire', key: 'unitPrice', width: 15 },
      { header: 'Total Produit', key: 'totalProduct', width: 15 },
      { header: 'Statut', key: 'status', width: 20 },
      { header: 'Total Vente', key: 'totalSale', width: 15 },
      { header: 'Total Payé', key: 'totalPaid', width: 15 },
      { header: 'Solde Restant', key: 'balance', width: 15 },
      { header: 'Dernier Paiement', key: 'lastPayment', width: 20 },
      { header: 'Méthode Paiement', key: 'paymentMethod', width: 20 },
      { header: 'Vendeur', key: 'seller', width: 25 }
    ];

    // Ajout des données
    sales.forEach(sale => {
      // Calculer les totaux pour la vente
      const totalSale = sale.totalAmount;
      const totalPaid = sale.payments.reduce((sum, payment) => sum + payment.amount, 0);
      const balance = totalSale - totalPaid;

      // Déterminer le statut
      let statusText;
      if (sale.status === 'cancelled') {
        statusText = 'Annulée';
      } else if (totalPaid >= totalSale) {
        statusText = 'Payée';
      } else if (totalPaid > 0) {
        statusText = 'Partiellement payée';
      } else {
        statusText = 'En attente';
      }

      // Dernier paiement (si existe)
      let lastPaymentDate = '';
      let paymentMethod = '';
      if (sale.payments.length > 0) {
        const lastPayment = sale.payments[sale.payments.length - 1];
        lastPaymentDate = lastPayment.paymentDate.toLocaleDateString();
        paymentMethod = lastPayment.method === 'MobileMoney'
          ? 'Mobile Money'
          : lastPayment.method;
      }

      // Ajouter une ligne par produit
      sale.products.forEach((item, index) => {
        const rowData = {
          saleId: index === 0 ? sale._id.toString() : '', // Afficher l'ID seulement sur la première ligne
          date: sale.createdAt.toLocaleDateString('fr-FR'),
          client: sale.client?.name || 'N/A',
          product: item.product?.name || 'Produit supprimé',
          quantity: item.quantity,
          unitPrice: item.priceAtSale,
          totalProduct: item.quantity * item.priceAtSale,
          status: index === 0 ? statusText : '', // Statut seulement sur première ligne
          totalSale: index === 0 ? totalSale : '', // Total vente sur première ligne
          totalPaid: index === 0 ? totalPaid : '', // Total payé sur première ligne
          balance: index === 0 ? balance : '', // Solde sur première ligne
          lastPayment: index === 0 ? lastPaymentDate : '',
          paymentMethod: index === 0 ? paymentMethod : '',
          seller: sale.user?.name || 'N/A'
        };

        worksheet.addRow(rowData);
      });

      // Ajouter une ligne de séparation après chaque vente
      worksheet.addRow([]);
    });

    // Formatage des montants
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) { // Skip header row
        row.eachCell((cell, colNumber) => {
          const columnKey = worksheet.getColumn(colNumber).key;

          // Formatage des montants
          if (['unitPrice', 'totalProduct', 'totalSale', 'totalPaid', 'balance'].includes(columnKey)) {
            if (cell.value) {
              cell.value = Number(cell.value);
              cell.numFmt = '#,##0.00 "CFA"';
            }
          }

          // Centrer les quantités
          if (columnKey === 'quantity') {
            cell.alignment = { horizontal: 'center' };
          }
        });
      }
    });

    // Style des en-têtes
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2C3E50' } // Dark blue
      };
      cell.font = {
        bold: true,
        color: { argb: 'FFFFFFFF' } // White
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' }
      };
    });

    // Geler la première ligne (en-têtes)
    worksheet.views = [
      { state: 'frozen', ySplit: 1 }
    ];

    // Générer le nom de fichier
    let filename = `ventes_${period}`;
    if (period === 'custom' && startDate && endDate) {
      filename = `ventes_${startDate.replace(/-/g, '')}_${endDate.replace(/-/g, '')}`;
    }
    if (status && status !== 'all') {
      filename += `_${status}`;
    }

    // Envoyer le fichier
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.error('Erreur génération rapport:', error);
    res.status(500).json({
      message: 'Erreur lors de la génération du rapport',
      error: error.message
    });
  }
});

module.exports = { generateSalesReport };