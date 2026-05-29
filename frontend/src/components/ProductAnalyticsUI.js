import React from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, PackageSearch } from 'lucide-react';

export const formatProductCurrency = (value) =>
  `${Number(value || 0).toLocaleString('fr-FR')} CFA`;

export const formatProductNumber = (value) =>
  Number(value || 0).toLocaleString('fr-FR');

const toneClasses = {
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300',
  blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
  sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-300',
  slate: 'border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200',
  violet: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300',
};

export const ProductPageShell = ({ children, className = '' }) => (
  <motion.div
    className={`min-h-full bg-gradient-to-b from-gray-50 to-white px-3 py-4 text-gray-950 dark:from-gray-900 dark:to-gray-800 dark:text-gray-100 sm:px-5 lg:px-6 ${className}`}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.28, ease: 'easeOut' }}
  >
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">{children}</div>
  </motion.div>
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
  <section className="overflow-hidden rounded-[28px] border border-white/80 bg-white/90 shadow-[0_24px_70px_rgba(15,23,42,0.08)] backdrop-blur-2xl dark:border-gray-800 dark:bg-gray-900/90">
    <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between lg:p-6">
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gray-400">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-950 dark:text-white sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500 dark:text-gray-400 sm:text-base">
            {description}
          </p>
        )}
        {meta && (
          <p className="mt-2 text-xs font-medium text-gray-400 dark:text-gray-500">
            {meta}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600"
          >
            <ArrowLeft size={18} />
            {backLabel}
          </button>
        )}
        {actions}
      </div>
    </div>
  </section>
);

export const ProductMetricCard = ({ title, value, icon: Icon, tone = 'slate', helper }) => (
  <motion.article
    whileHover={{ y: -2 }}
    className="rounded-[22px] border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-900"
  >
    <div className="flex items-start justify-between gap-3">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border ${toneClasses[tone] || toneClasses.slate}`}>
        {Icon ? <Icon size={20} /> : <PackageSearch size={20} />}
      </span>
      {helper && (
        <span className="rounded-full bg-gray-50 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {helper}
        </span>
      )}
    </div>
    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.12em] text-gray-400">
      {title}
    </p>
    <p className="mt-2 text-xl font-bold text-gray-950 dark:text-white">
      {value}
    </p>
  </motion.article>
);

export const ProductSection = ({ title, description, action, children, className = '' }) => (
  <motion.section
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.24, ease: 'easeOut' }}
    className={`rounded-[24px] border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900 sm:p-5 ${className}`}
  >
    {(title || description || action) && (
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          {title && <h2 className="text-base font-semibold text-gray-950 dark:text-white sm:text-lg">{title}</h2>}
          {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        {action}
      </div>
    )}
    {children}
  </motion.section>
);

export const ProductActionButton = ({ children, onClick, variant = 'secondary', icon: Icon = ArrowUpRight, className = '' }) => (
  <button
    type="button"
    onClick={onClick}
    className={`inline-flex min-h-[42px] items-center justify-center gap-2 rounded-2xl px-4 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5 ${
      variant === 'primary'
        ? 'bg-gray-950 text-white shadow-[0_14px_28px_rgba(15,23,42,0.16)] hover:bg-gray-800 dark:bg-white dark:text-gray-950 dark:hover:bg-gray-100'
        : 'border border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-300 hover:shadow-md dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:border-gray-600'
    } ${className}`}
  >
    {Icon && <Icon size={17} />}
    {children}
  </button>
);

export const ProductEmptyState = ({ title = 'Aucune donnée', description }) => (
  <div className="rounded-[22px] border border-dashed border-gray-300 bg-gray-50 px-4 py-10 text-center dark:border-gray-700 dark:bg-gray-800/70">
    <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-gray-500 shadow-sm dark:bg-gray-900 dark:text-gray-300">
      <PackageSearch size={22} />
    </span>
    <p className="mt-4 text-sm font-semibold text-gray-950 dark:text-white">{title}</p>
    {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
  </div>
);
