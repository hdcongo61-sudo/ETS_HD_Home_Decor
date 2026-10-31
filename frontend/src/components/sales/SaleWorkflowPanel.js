import React from 'react';
import { getSaleActivity, getSaleWorkflow } from './saleWorkflow';
import { formatCfa } from '../../utils/format';

export default function SaleWorkflowPanel({ sale, onPayment, onDelivery, renderReceipt, onRefresh }) {
  const workflow = getSaleWorkflow(sale);
  const activity = getSaleActivity(sale);
  return <section className="ms-surface p-4 sm:p-5 space-y-4" aria-labelledby="sale-next-action-title">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-[var(--ms-text-muted)]">{sale.client?.name || 'Client non spécifié'}</p>
        <h2 id="sale-next-action-title" className="text-lg font-semibold text-[var(--ms-text)]">{workflow.title}</h2>
        <p className="mt-1 text-sm text-[var(--ms-text-muted)]">{workflow.description}</p>
      </div>
      <div className="flex flex-col gap-2 sm:shrink-0">
        {workflow.action === 'payment' && <button type="button" className="ms-button ms-button-primary min-h-[44px]" onClick={onPayment}>Enregistrer un paiement</button>}
        {workflow.action === 'delivery' && <button type="button" className="ms-button ms-button-primary min-h-[44px]" onClick={onDelivery}>Mettre à jour la livraison</button>}
        {workflow.action === 'receipt' && renderReceipt('primary')}
        {!workflow.action && sale.status !== 'cancelled' && <button type="button" className="ms-button ms-button-primary min-h-[44px]" onClick={onRefresh}>Actualiser la fiche</button>}
        {workflow.action === 'delivery' && renderReceipt('secondary')}
      </div>
    </div>
    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {[['Total de la vente', workflow.total], ['Montant encaissé', workflow.paid], ['Solde restant', workflow.balance]].map(([label, value]) => <div key={label} className="rounded-md border border-[var(--ms-border)] p-3 min-w-0">
        <dt className="text-sm text-[var(--ms-text-muted)]">{label}</dt><dd className="mt-1 text-lg font-semibold text-[var(--ms-text)] break-words">{formatCfa(value)}</dd>
      </div>)}
    </dl>
    <details className="border-t border-[var(--ms-border)] pt-3">
      <summary className="cursor-pointer min-h-[44px] py-2 text-sm font-semibold text-[var(--ms-text)]">Suivi de la vente · {activity.length} événement{activity.length === 1 ? '' : 's'}</summary>
      {activity.length ? <ol className="mt-3 space-y-3" aria-label="Activité de la vente">
        {activity.map(event => <li key={event.id} className="border-l-2 border-[var(--ms-border)] pl-3">
          <p className="text-sm font-semibold text-[var(--ms-text)]">{event.label}</p>
          <time dateTime={new Date(event.date).toISOString()} className="text-xs text-[var(--ms-text-muted)]">{new Date(event.date).toLocaleString('fr-FR')}</time>
          {event.detail && <p className="text-sm text-[var(--ms-text-muted)] break-words">{event.detail}</p>}
        </li>)}
      </ol> : <p className="text-sm text-[var(--ms-text-muted)]">Aucun événement daté disponible.</p>}
    </details>
  </section>;
}
