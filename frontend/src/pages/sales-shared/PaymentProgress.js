import React from "react";

// Part encaissée d'une vente, bornée à [0, 100].
export const paymentRatio = (paid, total) =>
  total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;

/**
 * Barre de progression d'encaissement partagée (SaleCard, recouvrement…).
 * La piste et l'accessibilité vivent ici ; les libellés restent côté page.
 */
const PaymentProgress = ({ ratio, color = "var(--colorBrandBackground)", className = "" }) => (
  <div
    className={`h-1.5 w-full overflow-hidden rounded-full ${className}`}
    style={{ background: "var(--colorNeutralBackground3)" }}
    role="progressbar"
    aria-valuenow={ratio}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label="Part encaissée"
  >
    <div
      className="h-full rounded-full transition-[width]"
      style={{ width: `${ratio}%`, background: color }}
    />
  </div>
);

export default PaymentProgress;
