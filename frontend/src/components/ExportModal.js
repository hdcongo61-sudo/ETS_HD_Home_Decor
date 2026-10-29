import React from "react";
import { FileDown } from "lucide-react";
import Modal from "./Modal";

const ExportModal = ({
  show,
  onClose,
  onExport,
  onPdfExport,
  filterLabel,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  exporting = false,
}) => {
  return (
    <Modal
      isOpen={show}
      onClose={onClose}
      title="Exporter les données"
      size="sm"
      footer={
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            onClick={onExport}
            disabled={exporting}
            className="ms-button ms-button-primary min-h-[44px] w-full sm:w-auto"
          >
            <FileDown size={18} />
            {exporting ? "Export..." : "Exporter Excel"}
          </button>
          {onPdfExport && (
            <button
              type="button"
              onClick={onPdfExport}
              disabled={exporting}
              className="ms-button ms-button-secondary min-h-[44px] w-full sm:w-auto"
            >
              <FileDown size={18} />
              {exporting ? "Export..." : "Rapport PDF"}
            </button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-[var(--radiusLarge)] border p-4" style={{ borderColor: 'var(--colorBrandStroke2, var(--ms-border))', background: 'var(--ms-blue-soft)' }}>
          <p className="fui-caption1-strong" style={{ color: 'var(--colorBrandForeground1)' }}>
            Choisissez la période à exporter
          </p>
          <p className="fui-caption1 mt-1" style={{ color: 'var(--colorBrandForeground1)' }}>
            {filterLabel || "Période personnalisée"}
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-white)] p-3">
            <span className="fui-caption1-strong uppercase tracking-wide" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Date début
            </span>
            <input
              type="date"
              value={startDate || ""}
              max={endDate || undefined}
              onChange={(e) => onStartDateChange?.(e.target.value)}
              className="form-control mt-2"
            />
          </label>
          <label className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-white)] p-3">
            <span className="fui-caption1-strong uppercase tracking-wide" style={{ color: 'var(--colorNeutralForeground3)' }}>
              Date fin
            </span>
            <input
              type="date"
              value={endDate || ""}
              min={startDate || undefined}
              onChange={(e) => onEndDateChange?.(e.target.value)}
              className="form-control mt-2"
            />
          </label>
        </div>
        <div className="rounded-[var(--radiusLarge)] border border-[var(--ms-border)] bg-[var(--ms-white)] p-3">
          <p className="fui-caption1">Le fichier contient les ventes, encaissements, dépenses et profit pour les dates choisies. Le PDF ajoute un résumé lisible pour impression.</p>
        </div>
      </div>
    </Modal>
  );
};

export default ExportModal;
