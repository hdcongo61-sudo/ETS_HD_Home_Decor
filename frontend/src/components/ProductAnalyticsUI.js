import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, PackageSearch } from 'lucide-react';
import {
  Button,
  ChartCard,
  EmptyState,
  KPICard,
  PageHeader,
  Workspace,
} from './business';

export const formatProductCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} CFA`;

export const formatProductNumber = (value) =>
  Number(value || 0).toLocaleString('fr-FR');

const toneMap = {
  amber: 'warning',
  blue: 'info',
  emerald: 'success',
  rose: 'danger',
  sky: 'info',
  slate: 'neutral',
  violet: 'neutral',
};

export const ProductPageShell = ({ children, className = '' }) => (
  <Workspace className={className}>
    <motion.div
      className="space-y-5 sm:space-y-6"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: 'easeOut' }}
  >
      {children}
    </motion.div>
  </Workspace>
);

export const ProductHero = ({
  eyebrow = 'Inventaire',
  title,
  description,
  meta,
  onBack,
  backLabel = 'Dashboard produits',
  actions,
}) => (
  <PageHeader
    eyebrow={eyebrow}
    title={title}
    description={description}
    meta={meta}
    actions={
      <>
        {onBack && (
          <Button
            type="button"
            onClick={onBack}
          >
            <ArrowLeft size={18} />
            {backLabel}
          </Button>
        )}
        {actions}
      </>
    }
  />
);

export const ProductMetricCard = ({ title, value, icon: Icon, tone = 'slate', helper }) => (
  <KPICard
    title={title}
    value={value}
    context={helper}
    tone={toneMap[tone] || 'neutral'}
    icon={Icon ? <Icon size={20} /> : <PackageSearch size={20} />}
  />
);

export const ProductSection = ({ title, description, action, children, className = '' }) => (
  <ChartCard title={title} description={description} actions={action} className={className}>
    {children}
  </ChartCard>
);

export const ProductActionButton = ({ children, onClick, variant = 'secondary', icon: Icon = ArrowUpRight, className = '' }) => (
  <Button
    type="button"
    onClick={onClick}
    variant={variant === 'primary' ? 'primary' : 'secondary'}
    className={className}
  >
    {Icon && <Icon size={17} />}
    {children}
  </Button>
);

export const ProductEmptyState = ({ title = 'Aucune donnée', description }) => (
  <EmptyState title={title} description={description} />
);
