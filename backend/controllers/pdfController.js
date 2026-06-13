const PDFDocument = require('pdfkit');
const Client = require('../models/clientModel');
const Sale = require('../models/saleModel');
const AppSettings = require('../models/appSettingsModel');

// Load the current tenant's company identity for document headers.
const loadCompany = async (req) => {
  try {
    const filter = req.tenantId ? { tenantId: req.tenantId } : { key: 'main', tenantId: null };
    const settings = await AppSettings.findOne(filter).lean();
    const b = settings?.branding || {};
    return {
      name: b.appName || 'Ma Boutique',
      address: b.address || '',
      phone: b.supportPhone || '',
      email: b.supportEmail || '',
      logoUrl: b.logoUrl || '',
    };
  } catch {
    return { name: 'Ma Boutique', address: '', phone: '', email: '', logoUrl: '' };
  }
};

// Fetch a remote (or data) logo URL into a Buffer for pdfkit.
const loadLogoBuffer = async (logoUrl) => {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const arrayBuf = await res.arrayBuffer();
    return Buffer.from(arrayBuf);
  } catch {
    return null;
  }
};

exports.exportClientsPdf = async (req, res) => {
  try {
    const company = await loadCompany(req);
    const logoBuffer = await loadLogoBuffer(company.logoUrl);
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

    // === HEADER — tenant (shop) identity ===
    if (logoBuffer) {
      try { doc.image(logoBuffer, 50, 45, { width: 60 }); } catch { /* ignore bad image */ }
    }

    const headerX = logoBuffer ? 120 : 50;
    const contactLine = [company.phone && `Tel: ${company.phone}`, company.email && `Email: ${company.email}`]
      .filter(Boolean).join('   ');
    doc
      .fillColor('#333')
      .fontSize(20)
      .text(company.name, headerX, 50)
      .fontSize(10);
    let hy = 70;
    if (company.address) { doc.text(company.address, headerX, hy); hy += 15; }
    if (contactLine) { doc.text(contactLine, headerX, hy); }
    doc.moveDown(1.5);

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
