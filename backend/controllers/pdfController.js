const PDFDocument = require('pdfkit');
const Client = require('../models/clientModel');
const Sale = require('../models/saleModel');

exports.exportClientsPdf = async (req, res) => {
  try {
    const clients = await Client.find().lean();

    const clientsWithTotal = await Promise.all(
      clients.map(async (c) => {
        const sales = await Sale.find({ client: c._id }).lean();
        const totalSpent = sales.reduce((sum, s) => {
          const val = parseFloat(s?.totalAmount ?? 0);
          return sum + (isNaN(val) ? 0 : val);
        }, 0);
        return { ...c, totalSpent: isNaN(totalSpent) ? 0 : totalSpent };
      })
    );

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=Rapport_Clients.pdf');
    doc.pipe(res);

    // === HEADER ===
    try {
      doc.image('./public/logo.png', 50, 45, { width: 60 });
    } catch {
      console.warn('⚠️ Logo manquant');
    }

    doc
      .fillColor('#333')
      .fontSize(20)
      .text('ETS HD Home Decor', 120, 50)
      .fontSize(10)
      .text('61 Rue Lénine, Moungali – Brazzaville', 120, 70)
      .text('Tel: +242 069 822 930   Email: hdcongo61@gmail.com', 120, 85)
      .moveDown(1.5);

    // === TITLE ===
    doc
      .fontSize(16)
      .fillColor('#000')
      .text('📋 Rapport Détail des Clients', { align: 'center' })
      .moveDown(1.5);

    // === TABLE HEADER ===
    const y0 = doc.y || 120;
    doc
      .fontSize(11)
      .fillColor('#000')
      .text('Nom', 50, y0)
      .text('Téléphone', 170, y0)
      .text('Email', 270, y0)
      .text('Total Dépensé', 410, y0, { width: 80, align: 'right' })
      .text('Adresse', 510, y0)
      .moveDown(0.5);
    doc.moveTo(50, doc.y).lineTo(560, doc.y).stroke('#999').moveDown(0.3);

    // === TABLE BODY ===
    clientsWithTotal.forEach((c) => {
      if (doc.y > 740) {
        doc.addPage();
        doc.y = 100;
      }

      const name = String(c?.name ?? '-');
      const phone = String(c?.phone ?? '-');
      const email = String(c?.email ?? '-');
      const address = String(c?.address ?? '-');
      const total = isNaN(c?.totalSpent) ? 0 : Number(c.totalSpent);
      const formattedTotal = `${total.toLocaleString('fr-FR')} CFA`;

      doc
        .fontSize(10)
        .fillColor('#222')
        .text(name, 50)
        .text(phone, 170)
        .text(email, 270, { width: 130 })
        .text(String(formattedTotal), 410, { width: 80, align: 'right' })
        .text(address, 510)
        .moveDown(0.2);
    });

    // === SUMMARY ===
    const totalClients = clientsWithTotal.length || 0;
    const totalRevenue = clientsWithTotal.reduce(
      (sum, c) => sum + (isNaN(c?.totalSpent) ? 0 : c.totalSpent),
      0
    );

    doc.moveDown(2);
    doc
      .fontSize(11)
      .fillColor('#000')
      .text(`🧾 Total Clients: ${String(totalClients)}`, 50)
      .text(`💰 Dépense Totale: ${totalRevenue.toLocaleString('fr-FR')} CFA`, 50)
      .moveDown(0.5)
      .fontSize(9)
      .fillColor('#666')
      .text(`Généré le: ${new Date().toLocaleString('fr-FR')}`, 50, doc.y + 10);

    doc.end();
  } catch (error) {
    console.error('Erreur export PDF:', error);
    res.status(500).json({ message: 'Erreur lors de la génération du PDF' });
  }
};
