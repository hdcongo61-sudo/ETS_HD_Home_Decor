import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import logo from '../assets/logo.png'; // Assurez-vous que le chemin est correct

const ExportSalesPdf = ({ sale }) => {
  const generatePDF = () => {
    const doc = new jsPDF();

    // En-tête
    doc.addImage(logo, 'PNG', 10, 10, 30, 30);
    doc.setFontSize(18);
    doc.text("FACTURE", 105, 20, { align: 'center' });
    doc.setFontSize(12);
    doc.text("ETS HD Home Decor", 105, 30, { align: 'center' });
    doc.text("61 rue Lenine, Moungali/Brazzaville", 105, 35, { align: 'center' });
    doc.text("Tél: +242 069822930", 105, 40, { align: 'center' });

    // Informations client
    const client = sale.client || {};
    const yStart = 60;
    doc.text(`Client: ${client.name || 'Non spécifié'}`, 15, yStart);
    doc.text(`Vendeur: ${sale.user?.name || 'Non spécifié'}`, 15, yStart + 5); // Nom du vendeur
    doc.text(`Date: ${new Date(sale.saleDate).toLocaleDateString('fr-FR')}`, 15, yStart + 10);
    doc.text(`Référence: ${sale._id}`, 15, yStart + 15);

    // Tableau des produits
    const headers = [['Produit', 'Prix Unitaire', 'Quantité', 'Total']];
    const data = sale.products.map(item => [
      item.product?.name || 'Produit supprimé',
      `${item.priceAtSale.toFixed()} CFA`,
      item.quantity,
      `${(item.priceAtSale * item.quantity).toFixed()} CFA`
    ]);

    autoTable(doc, {
      startY: yStart + 25,
      head: headers,
      body: data,
      theme: 'grid',
      styles: { fontSize: 10 },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 40 },
        2: { cellWidth: 30 },
        3: { cellWidth: 40 }
      }
    });

    // Total
    const finalY = doc.lastAutoTable.finalY + 10;
    doc.text(`Total: ${sale.totalAmount.toFixed()} CFA`, 140, finalY);

    // Section signature
    const signatureY = finalY + 20;
    doc.setFontSize(10);

    // Signature client
    doc.text("Signature du client:", 20, signatureY);
    doc.setLineWidth(0.5);
    doc.line(20, signatureY + 5, 80, signatureY + 5);


    // Signature vendeur
    doc.text("Signature du vendeur:", 120, signatureY);
    doc.line(120, signatureY + 5, 180, signatureY + 5);
    doc.text(sale.user?.name || "Responsable ETS HD", 120, signatureY + 10);

    // Pied de page
    const footerY = doc.internal.pageSize.height - 20;
    doc.setFontSize(8);
    doc.text("Merci pour votre confiance !", 105, footerY, { align: 'center' });
    doc.text("TVA non applicable, art. 293 B du CGI", 105, footerY + 5, { align: 'center' });

    doc.save(`facture-${sale._id}.pdf`);
  };

  return (
    <button
      onClick={generatePDF}
      className="bg-blue-500 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center transition-all duration-300 transform hover:scale-105"
    >
      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span className="font-semibold">Télécharger la facture</span>
    </button>
  );
};

export default ExportSalesPdf;