import React, { useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { FileDown, FileSpreadsheet } from "lucide-react";
import { useAppSettings } from "../../context/AppSettingsContext";
import { resolveAppLogo } from "../../utils/appBranding";
import { calculateSaleTotals, getPaymentStructureKey, getStatusText } from "../../utils/saleUtils";

const formatAmount = (value) => Number(value || 0).toLocaleString("fr-FR").replace(/\s/g, ".");

const formatCurrency = (value) => `${formatAmount(value)} CFA`;

const formatDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("fr-FR");
};

const getSellerName = (sale) => {
  if (!sale?.user) return "Non spécifié";
  if (typeof sale.user === "object") return sale.user.name || sale.user.email || "Non spécifié";
  return "Non spécifié";
};

const getClientName = (sale) => sale?.client?.name || "Client non spécifié";

const getRows = (sales) =>
  sales.map((sale) => {
    const { totalPaid, balance } = calculateSaleTotals(sale);
    return {
      Date: formatDate(sale.saleDate || sale.createdAt),
      Client: getClientName(sale),
      Vendeur: getSellerName(sale),
      Statut: getStatusText(sale.status),
      "Type vente": (sale.saleType || "normal") === "wholesale" ? "Vente en gros" : "Vente normale",
      "Structure paiement": getPaymentStructureKey(sale),
      Total: Number(sale.totalAmount || 0),
      "Montant payé": Number(totalPaid || 0),
      "Solde restant": Number(balance || 0),
    };
  });

const getLogoDataUrl = async (logoUrl) => {
  if (!logoUrl) return null;
  try {
    const response = await fetch(logoUrl);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

const SalesListExportButtons = ({ sales = [], filenamePrefix = "ventes", label = "Exporter" }) => {
  const { appSettings } = useAppSettings();
  const [exporting, setExporting] = useState("");
  const branding = appSettings.branding;
  const logoUrl = resolveAppLogo(branding.logoUrl);
  const disabled = sales.length === 0 || Boolean(exporting);

  const buildFilename = (extension) => {
    const date = new Date().toISOString().slice(0, 10);
    return `${filenamePrefix}-${date}.${extension}`;
  };

  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const logoDataUrl = await getLogoDataUrl(logoUrl);
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, "PNG", 14, 10, 18, 18);
      }

      doc.setFontSize(15);
      doc.setTextColor(15, 23, 42);
      doc.text(branding.appName || "ETS HD Home Decor", logoDataUrl ? 38 : 14, 17);
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`${label} - ${sales.length} vente${sales.length > 1 ? "s" : ""}`, logoDataUrl ? 38 : 14, 23);

      autoTable(doc, {
        startY: 34,
        head: [["Date", "Client", "Vendeur", "Statut", "Type", "Paiement", "Total", "Payé", "Solde"]],
        body: getRows(sales).map((row) => [
          row.Date,
          row.Client,
          row.Vendeur,
          row.Statut,
          row["Type vente"],
          row["Structure paiement"],
          formatCurrency(row.Total),
          formatCurrency(row["Montant payé"]),
          formatCurrency(row["Solde restant"]),
        ]),
        styles: { fontSize: 8, cellPadding: 2.2 },
        headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });

      doc.save(buildFilename("pdf"));
    } finally {
      setExporting("");
    }
  };

  const exportExcel = () => {
    setExporting("excel");
    try {
      const rows = getRows(sales).map((row) => ({
        ...row,
        Total: row.Total,
        "Montant payé": row["Montant payé"],
        "Solde restant": row["Solde restant"],
      }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Ventes");
      XLSX.writeFile(workbook, buildFilename("xlsx"));
    } finally {
      setExporting("");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={exportPdf}
        disabled={disabled}
        className="inline-flex min-h-[42px] items-center gap-2 rounded-2xl bg-gray-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileDown className="h-4 w-4" aria-hidden="true" />
        {exporting === "pdf" ? "PDF..." : "PDF"}
      </button>
      <button
        type="button"
        onClick={exportExcel}
        disabled={disabled}
        className="inline-flex min-h-[42px] items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
        {exporting === "excel" ? "Excel..." : "Excel"}
      </button>
    </div>
  );
};

export default SalesListExportButtons;
