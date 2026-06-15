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

// Load the full branding (incl. primary color) for the brochure.
const loadBrandingFull = async (req) => {
  try {
    const filter = req.tenantId ? { tenantId: req.tenantId } : { key: 'main', tenantId: null };
    const settings = await AppSettings.findOne(filter).lean();
    const b = settings?.branding || {};
    const color = /^#[0-9a-fA-F]{6}$/.test(b.primaryColor || '') ? b.primaryColor : '#0f6cbd';
    return {
      name: b.appName || 'Ma Boutique',
      shortName: b.shortName || b.appName || 'Boutique',
      tagline: b.tagline || 'Gestion de boutique',
      address: b.address || '',
      phone: b.supportPhone || '',
      email: b.supportEmail || '',
      logoUrl: b.logoUrl || '',
      footer: b.footerText || '',
      color,
    };
  } catch {
    return { name: 'Ma Boutique', shortName: 'Boutique', tagline: 'Gestion de boutique', address: '', phone: '', email: '', logoUrl: '', footer: '', color: '#0f6cbd' };
  }
};

// @desc  Branded one-page presentation brochure (PDF), à l'image de la boutique.
// @route GET /api/export/brochure
exports.generateBrochurePdf = async (req, res) => {
  try {
    const b = await loadBrandingFull(req);
    const logo = await loadLogoBuffer(b.logoUrl);

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Brochure_${String(b.shortName).replace(/[^a-zA-Z0-9]+/g, '_')}.pdf`);
    doc.pipe(res);

    const M = 50;
    const W = doc.page.width - M * 2;
    const color = b.color;

    const sectionTitle = (t) => {
      doc.moveDown(0.7);
      const y = doc.y;
      doc.rect(M, y + 1, 4, 13).fill(color);
      doc.fillColor('#111').font('Helvetica-Bold').fontSize(13).text(t, M + 12, y, { width: W - 12 });
      doc.moveDown(0.35);
      doc.font('Helvetica');
    };
    const bullets = (items) => {
      items.forEach((it) => {
        const y = doc.y;
        doc.fillColor(color).font('Helvetica-Bold').fontSize(10.5).text('•', M + 2, y, { width: 12 });
        doc.fillColor('#222').font('Helvetica').fontSize(10.5).text(it, M + 16, y, { width: W - 16 });
        doc.moveDown(0.25);
      });
    };

    // ── Header ──
    if (logo) { try { doc.image(logo, M, 45, { fit: [56, 56] }); } catch { /* ignore */ } }
    const hx = logo ? M + 70 : M;
    doc.fillColor(color).font('Helvetica-Bold').fontSize(22).text(b.name, hx, 48, { width: M + W - hx });
    doc.fillColor('#555').font('Helvetica').fontSize(11).text(b.tagline, hx, doc.y, { width: M + W - hx });
    const contact = [b.phone && `Tel : ${b.phone}`, b.email, b.address].filter(Boolean).join('   |   ');
    if (contact) doc.fillColor('#777').fontSize(9).text(contact, hx, doc.y + 2, { width: M + W - hx });

    let ry = Math.max(doc.y + 8, 112);
    doc.moveTo(M, ry).lineTo(M + W, ry).lineWidth(2).strokeColor(color).stroke();
    doc.y = ry + 12;

    doc.fillColor('#111').font('Helvetica-Bold').fontSize(15).text('Gerez toute votre boutique depuis votre telephone', M, doc.y, { width: W });
    doc.moveDown(0.2);
    doc.fillColor('#444').font('Helvetica').fontSize(10.5).text(
      'Ventes, stock, clients, caisse, depenses, employes et benefices au meme endroit, avec des analyses qui vous disent quoi faire pour gagner plus.',
      { width: W }
    );

    sectionTitle('Ce que ca change pour vous');
    bullets([
      'Vous savez exactement combien vous gagnez : benefice net en temps reel (ventes - couts - casse - cadeaux).',
      'Votre caisse tombe juste : ouverture/cloture, attendu vs compte, rapport Z.',
      'Vous perdez moins : stock dormant detecte, casse & cadeaux suivis, impayes relances.',
      'Vous fidelisez vos meilleurs clients : VIP, fideles et clients a relancer identifies automatiquement.',
      "Vous avez l'air pro : factures et bulletins de paie PDF a votre nom et a vos couleurs.",
      'Vous gardez le controle : vos vendeurs vendent sans voir vos marges ; rien sans votre validation.',
    ]);

    sectionTitle('Les fonctions cles');
    bullets([
      'Ventes : vente en 2 clics, credit & paiements partiels, livraison, factures PDF.',
      'Produits : catalogue, import Excel, QR code, alertes de rupture, suggestions pour vendre le stock lent.',
      'Caisse : session de caisse, rapport Z, ecarts detectes.',
      'Clients : fiches, historique, segmentation VIP / fideles / a relancer.',
      'Benefices : marge nette, par produit / categorie / conteneur, pertes deduites.',
      'Depenses & Paie : suivi, objectif mensuel, bulletins de paie, avances.',
    ]);

    sectionTitle('Deux profils, un vrai controle');
    doc.fillColor('#222').font('Helvetica').fontSize(10.5).text(
      "L'Administrateur pilote tout et voit les marges et les benefices. Le Vendeur enregistre les ventes et encaisse, mais ne voit ni les couts ni les marges ; les actions sensibles (prix, stock, suppression) passent par la validation de l'admin.",
      { width: W }
    );

    // ── Footer band ──
    doc.moveDown(1.1);
    const fy = doc.y;
    doc.rect(M, fy, W, 34).fill(color);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(11).text(
      'Voir clair   .   Perdre moins   .   Gagner du temps   .   Garder le controle',
      M, fy + 11, { width: W, align: 'center' }
    );

    doc.moveDown(1.4);
    doc.fillColor('#999').font('Helvetica').fontSize(8.5).text(
      b.footer || `Genere le ${new Date().toLocaleDateString('fr-FR')}`,
      M, doc.y, { width: W, align: 'center' }
    );

    doc.end();
  } catch (error) {
    console.error('Erreur brochure PDF:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Erreur lors de la generation de la brochure' });
  }
};

// ── Super-admin documents (flyer / guide / formation), platform-branded ──
const DOC_SPECS = require('./docContent');
const PlatformConfig = require('../models/platformConfigModel');
const PLATFORM = { name: 'HD Gestion', site: 'www.hdgestion.co', color: '#0f6cbd' };
const DOC_TYPES = ['flyer', 'guide', 'formation'];

// Returns the effective spec for a doc type: stored override if present and
// non-empty, otherwise the hardcoded default. `edited` flags an override.
const loadDocSpec = async (type) => {
  const fallback = DOC_SPECS[type];
  if (!fallback) return { spec: null, edited: false };
  try {
    const cfg = await PlatformConfig.findOne({ singleton: 'main' }).lean();
    const stored = cfg && cfg.docs && cfg.docs[type];
    if (stored && Array.isArray(stored.sections)) return { spec: stored, edited: true };
  } catch (_) { /* fall back to default */ }
  return { spec: fallback, edited: false };
};

// Normalises a posted spec to the supported shape (drops unknown fields).
const sanitizeSpec = (raw) => {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    title: String(s.title || '').trim(),
    subtitle: String(s.subtitle || '').trim(),
    sections: Array.isArray(s.sections) ? s.sections.map((sec) => ({
      heading: String(sec?.heading || '').trim(),
      body: String(sec?.body || '').trim(),
      bullets: Array.isArray(sec?.bullets)
        ? sec.bullets.map((b) => String(b || '').trim()).filter(Boolean)
        : [],
    })) : [],
  };
};

// @desc  Get the editable content of a doc (stored override or default).
// @route GET /api/export/doc/:type/content   (super-admin only)
exports.getDocContent = async (req, res) => {
  try {
    const type = String(req.params.type || '').toLowerCase();
    if (!DOC_TYPES.includes(type)) return res.status(404).json({ message: 'Document inconnu.' });
    const { spec, edited } = await loadDocSpec(type);
    res.json({ type, edited, spec });
  } catch (error) {
    console.error('Erreur lecture doc:', error);
    res.status(500).json({ message: 'Erreur lors de la lecture du document' });
  }
};

// @desc  Save (or reset) the editable content of a doc.
// @route PUT /api/export/doc/:type/content   (super-admin only)
//        body { spec } to save, or { reset: true } to restore the default.
exports.saveDocContent = async (req, res) => {
  try {
    const type = String(req.params.type || '').toLowerCase();
    if (!DOC_TYPES.includes(type)) return res.status(404).json({ message: 'Document inconnu.' });

    const cfg = await PlatformConfig.getCatalog();
    if (!cfg.docs || typeof cfg.docs !== 'object') cfg.docs = {};

    if (req.body && req.body.reset) {
      delete cfg.docs[type];
      cfg.markModified('docs');
      await cfg.save();
      return res.json({ type, edited: false, spec: DOC_SPECS[type] });
    }

    const spec = sanitizeSpec(req.body && req.body.spec);
    if (!spec.title) return res.status(400).json({ message: 'Le titre est requis.' });
    cfg.docs[type] = spec;
    cfg.markModified('docs');
    await cfg.save();
    res.json({ type, edited: true, spec });
  } catch (error) {
    console.error('Erreur sauvegarde doc:', error);
    res.status(500).json({ message: 'Erreur lors de la sauvegarde du document' });
  }
};

// @desc  Generic structured document -> branded PDF (super-admin only).
// @route GET /api/export/doc/:type   (type = flyer | guide | formation)
exports.generateDocPdf = async (req, res) => {
  try {
    const type = String(req.params.type || '').toLowerCase();
    const { spec } = await loadDocSpec(type);
    if (!spec) return res.status(404).json({ message: 'Document inconnu.' });

    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=HD_Gestion_${type}.pdf`);
    doc.pipe(res);

    const M = 50;
    const W = doc.page.width - M * 2;
    const color = spec.color || PLATFORM.color;
    const bottom = doc.page.height - 60;
    const ensure = (h) => { if (doc.y + h > bottom) doc.addPage(); };

    // Title block
    doc.fillColor(color).font('Helvetica-Bold').fontSize(24).text(spec.title, M, 60, { width: W });
    if (spec.subtitle) doc.fillColor('#555').font('Helvetica').fontSize(12).text(spec.subtitle, M, doc.y + 2, { width: W });
    doc.moveTo(M, doc.y + 8).lineTo(M + W, doc.y + 8).lineWidth(2).strokeColor(color).stroke();
    doc.y += 18;

    (spec.sections || []).forEach((s) => {
      ensure(46);
      if (s.heading) {
        const y = doc.y;
        doc.rect(M, y + 1, 4, 14).fill(color);
        doc.fillColor('#111').font('Helvetica-Bold').fontSize(13.5).text(s.heading, M + 12, y, { width: W - 12 });
        doc.moveDown(0.35);
        doc.font('Helvetica');
      }
      if (s.body) {
        doc.fillColor('#333').font('Helvetica').fontSize(10.5).text(s.body, M, doc.y, { width: W });
        doc.moveDown(0.3);
      }
      (s.bullets || []).forEach((it) => {
        ensure(18);
        const y = doc.y;
        doc.fillColor(color).font('Helvetica-Bold').fontSize(10.5).text('-', M + 2, y, { width: 12 });
        doc.fillColor('#222').font('Helvetica').fontSize(10.5).text(it, M + 16, y, { width: W - 16 });
        doc.moveDown(0.2);
      });
      doc.moveDown(0.5);
    });

    // Footer on every page
    const range = doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      doc.switchToPage(range.start + i);
      doc.fillColor('#999').font('Helvetica').fontSize(8)
        .text(`${PLATFORM.name}  -  ${PLATFORM.site}`, M, doc.page.height - 38, { width: W, align: 'center', lineBreak: false });
    }

    doc.end();
  } catch (error) {
    console.error('Erreur doc PDF:', error);
    if (!res.headersSent) res.status(500).json({ message: 'Erreur lors de la génération du document' });
  }
};
