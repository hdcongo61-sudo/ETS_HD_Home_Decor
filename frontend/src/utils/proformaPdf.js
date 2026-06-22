import { getLogoDataUrl } from './appBranding';

const formatAmount = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR').replace(/\s/g, '.')} CFA`;

const formatDate = (value) => {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('fr-FR');
};

const sanitizeFilename = (value) =>
  String(value || 'client')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

export const generateProformaPdf = async ({
  client,
  items,
  note,
  validUntil,
  sellerName,
  company,
  reference: providedReference,
  issueDate: providedIssueDate,
}) => {
  const [jsPDFModule, autoTableModule] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default;
  const autoTable = autoTableModule.default || autoTableModule;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 16;
  const issueDate = providedIssueDate ? new Date(providedIssueDate) : new Date();
  const reference =
    providedReference ||
    `PRO-${issueDate.toISOString().slice(0, 10).replace(/-/g, '')}-${String(
      issueDate.getTime()
    ).slice(-6)}`;
  const total = items.reduce(
    (sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.price) || 0),
    0
  );
  const logoDataUrl = await getLogoDataUrl(company.logoUrl);

  doc.setFillColor(248, 249, 251);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, 12, pageWidth - margin * 2, 36, 5, 5, 'F');

  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, 'PNG', margin + 5, 19, 20, 20);
    } catch {
      // Continue with a text-only header when the configured logo is invalid.
    }
  }

  const headerX = logoDataUrl ? margin + 31 : margin + 6;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39);
  doc.text(company.name, headerX, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  if (company.address) doc.text(company.address, headerX, 31);
  const contacts = [company.phone && `Tel: ${company.phone}`, company.email]
    .filter(Boolean)
    .join('   ');
  if (contacts) doc.text(contacts, headerX, company.address ? 37 : 31);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(17, 24, 39);
  doc.text('FACTURE PROFORMA', pageWidth - margin - 5, 26, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(reference, pageWidth - margin - 5, 34, { align: 'right' });
  doc.text(formatDate(issueDate), pageWidth - margin - 5, 40, { align: 'right' });

  const infoY = 58;
  const cardWidth = (pageWidth - margin * 2 - 8) / 2;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, infoY, cardWidth, 40, 5, 5, 'F');
  doc.roundedRect(margin + cardWidth + 8, infoY, cardWidth, 40, 5, 5, 'F');

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
  if (client.phone) doc.text(client.phone, margin + 6, infoY + 27);
  if (client.email) doc.text(client.email, margin + 6, infoY + 34);

  const contextX = margin + cardWidth + 14;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text('CONDITIONS', contextX, infoY + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(17, 24, 39);
  doc.text(`Émise le : ${formatDate(issueDate)}`, contextX, infoY + 18);
  doc.text(`Valable jusqu'au : ${formatDate(validUntil)}`, contextX, infoY + 26);
  doc.text(`Établie par : ${sellerName || 'Non spécifié'}`, contextX, infoY + 34);

  autoTable(doc, {
    startY: 109,
    head: [['Produit', 'Prix unitaire', 'Quantité', 'Total']],
    body: items.map((item) => [
      item.name,
      formatAmount(item.price),
      item.quantity,
      formatAmount((Number(item.price) || 0) * (Number(item.quantity) || 0)),
    ]),
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
      3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' },
    },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  const totalX = pageWidth - margin - 72;
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(totalX, finalY, 72, 20, 5, 5, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(17, 24, 39);
  doc.text('TOTAL PROFORMA', totalX + 6, finalY + 8);
  doc.setFontSize(13);
  doc.text(formatAmount(total), totalX + 66, finalY + 15, { align: 'right' });

  if (note) {
    const noteY = Math.min(finalY + 32, pageHeight - 55);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(55, 65, 81);
    doc.text('NOTE', margin, noteY);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(107, 114, 128);
    doc.text(doc.splitTextToSize(note, pageWidth - margin * 2), margin, noteY + 6);
  }

  const footerY = pageHeight - 18;
  doc.setDrawColor(229, 231, 235);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);
  doc.setFontSize(8);
  doc.setTextColor(107, 114, 128);
  doc.text(
    'Ce document est une proposition commerciale et ne constitue pas une vente enregistrée.',
    pageWidth / 2,
    footerY,
    { align: 'center' }
  );
  if (company.footerText) {
    doc.text(company.footerText, pageWidth / 2, footerY + 5, { align: 'center' });
  }

  doc.save(
    `proforma-${sanitizeFilename(client.name)}-${issueDate.toISOString().split('T')[0]}.pdf`
  );
};
