import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useAppSettings } from '../context/AppSettingsContext';
import { getCompanyIdentity, getLogoDataUrl } from '../utils/appBranding';

const formatAmount = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR').replace(/\s/g, '.')} CFA`;

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return new Date().toLocaleDateString('fr-FR');
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
};

const sanitizeFilename = (value) =>
  String(value || 'client')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const ExportSalesPdf = ({ sale }) => {
  const { appSettings } = useAppSettings();
  const company = getCompanyIdentity(appSettings.branding);

  const generatePDF = async () => {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 16;
    const client = sale.client || {};
    const sellerName = sale.user?.name || 'Non spécifié';
    const logoDataUrl = await getLogoDataUrl(company.logoUrl);
    const saleDate = formatDate(sale.saleDate);
    const totalPaid = (sale.payments || []).reduce(
      (sum, payment) => sum + (Number(payment.amount) || 0),
      0
    );
    const balance = Math.max((Number(sale.totalAmount) || 0) - totalPaid, 0);

    doc.setFillColor(248, 249, 251);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    // Header — tenant (shop) identity from settings
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, 12, pageWidth - margin * 2, 34, 5, 5, 'F');
    const hasLogo = Boolean(logoDataUrl);
    if (hasLogo) {
      try { doc.addImage(logoDataUrl, 'PNG', margin + 5, 18, 20, 20); } catch { /* ignore bad image */ }
    }
    const headerX = hasLogo ? margin + 31 : margin + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(17, 24, 39);
    doc.text(company.name, headerX, 24);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    let companyLineY = 30;
    if (company.address) { doc.text(company.address, headerX, companyLineY); companyLineY += 5; }
    const contactBits = [company.phone && `Tel: ${company.phone}`, company.email].filter(Boolean).join('   ');
    if (contactBits) { doc.text(contactBits, headerX, companyLineY); }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(17, 24, 39);
    doc.text('FACTURE', pageWidth - margin - 5, 27, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(saleDate, pageWidth - margin - 5, 34, { align: 'right' });

    // Client and sale context. No reference is printed.
    const infoY = 56;
    const cardWidth = (pageWidth - margin * 2 - 8) / 2;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(margin, infoY, cardWidth, 39, 5, 5, 'F');
    doc.roundedRect(margin + cardWidth + 8, infoY, cardWidth, 39, 5, 5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('CLIENT(E)', margin + 6, infoY + 9);
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(client.name || 'Non spécifié', margin + 6, infoY + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    if (client.phone) doc.text(client.phone, margin + 6, infoY + 26);
    if (client.email) doc.text(client.email, margin + 6, infoY + 33);

    const rightCardX = margin + cardWidth + 8;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('VENTE', rightCardX + 6, infoY + 9);
    doc.setFontSize(12);
    doc.setTextColor(17, 24, 39);
    doc.text(`Vendeur: ${sellerName}`, rightCardX + 6, infoY + 18);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(`Date: ${saleDate}`, rightCardX + 6, infoY + 26);
    doc.text(`Statut: ${balance <= 0 ? 'Payée' : 'Solde restant'}`, rightCardX + 6, infoY + 33);

    // Tableau des produits
    const headers = [['Produit', 'Prix unitaire', 'Quantité', 'Total']];
    const data = (sale.products || []).map(item => [
      item.product?.name || 'Produit supprimé',
      formatAmount(item.priceAtSale),
      item.quantity,
      formatAmount((Number(item.priceAtSale) || 0) * (Number(item.quantity) || 0))
    ]);

    autoTable(doc, {
      startY: 106,
      head: headers,
      body: data,
      theme: 'plain',
      margin: { left: margin, right: margin },
      headStyles: {
        fillColor: [17, 24, 39],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        cellPadding: 3,
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [31, 41, 55],
        cellPadding: 3,
        lineColor: [229, 231, 235],
        lineWidth: 0.1,
      },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 38, halign: 'right' },
        2: { cellWidth: 25, halign: 'center' },
        3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
      }
    });

    // Totals
    const finalY = doc.lastAutoTable.finalY + 10;
    const totalBoxX = pageWidth - margin - 72;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(totalBoxX, finalY, 72, balance > 0 ? 34 : 25, 5, 5, 'F');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Total', totalBoxX + 6, finalY + 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text(formatAmount(sale.totalAmount), totalBoxX + 66, finalY + 8, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text('Payé', totalBoxX + 6, finalY + 17);
    doc.text(formatAmount(totalPaid), totalBoxX + 66, finalY + 17, { align: 'right' });
    if (balance > 0) {
      doc.setTextColor(190, 18, 60);
      doc.text('Solde', totalBoxX + 6, finalY + 26);
      doc.text(formatAmount(balance), totalBoxX + 66, finalY + 26, { align: 'right' });
    }

    // Section signature
    const signatureY = Math.max(finalY + 48, 220);
    doc.setFontSize(10);
    doc.setTextColor(55, 65, 81);

    doc.text('Signature Client(e)', margin, signatureY);
    doc.setDrawColor(156, 163, 175);
    doc.setLineWidth(0.3);
    doc.line(margin, signatureY + 10, margin + 58, signatureY + 10);

    doc.text('Signature vendeur', pageWidth - margin - 58, signatureY);
    doc.line(pageWidth - margin - 58, signatureY + 10, pageWidth - margin, signatureY + 10);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(sellerName || `Responsable ${company.name}`, pageWidth - margin - 58, signatureY + 16);

    // Pied de page
    const footerY = pageHeight - 18;
    doc.setDrawColor(229, 231, 235);
    doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text('Merci pour votre confiance.', pageWidth / 2, footerY, { align: 'center' });
    if (company.footerText) {
      doc.text(company.footerText, pageWidth / 2, footerY + 5, { align: 'center' });
    }

    doc.save(`facture-${sanitizeFilename(client.name)}-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  return (
    <button
      onClick={generatePDF}
      className="inline-flex min-h-[44px] items-center justify-center rounded-2xl bg-gray-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800"
    >
      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="font-semibold">Télécharger la facture</span>
    </button>
  );
};

export default ExportSalesPdf;
