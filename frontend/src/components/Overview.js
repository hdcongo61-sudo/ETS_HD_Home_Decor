import React, { useState, useEffect, useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  ShoppingCart,
  Boxes,
  Users,
  Landmark,
  Receipt,
  ChevronRight,
  Wallet,
  TrendingUp,
  BarChart3,
  Plus,
  AlertTriangle,
} from "lucide-react";
import api from "../services/api";
import AuthContext from "../context/AuthContext";
import { KPICard, LoadingSkeleton } from "./business";

const cfa = (value) => `${Math.round(Number(value) || 0).toLocaleString("fr-FR")} CFA`;
const num = (value) => (Number(value) || 0).toLocaleString("fr-FR");
const isFiniteNumber = (value) => Number.isFinite(Number(value));

const TONES = {
  brand:   { bg: "var(--ms-blue-soft)",                    fg: "var(--colorBrandForeground1)" },
  success: { bg: "var(--colorStatusSuccessBackground1)",  fg: "var(--colorStatusSuccessForeground1)" },
  warning: { bg: "var(--colorStatusWarningBackground1)",  fg: "var(--colorStatusWarningForeground1)" },
  danger:  { bg: "var(--colorStatusDangerBackground1)",   fg: "var(--colorStatusDangerForeground1)" },
  neutral: { bg: "var(--colorNeutralBackground3)",        fg: "var(--colorNeutralForeground2)" },
};

const ModuleCard = ({ to, icon, tone = "brand", title, stats }) => {
  const t = TONES[tone] || TONES.brand;
  return (
    <Link
      to={to}
      className="group ms-surface flex flex-col gap-4 p-5 transition-shadow hover:shadow-[var(--ms-shadow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]"
    >
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: t.bg, color: t.fg }}>
          {icon}
        </span>
        <span className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: "var(--colorBrandForeground1)" }}>
          Voir
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
      <div>
        <h3 className="fui-subtitle2" style={{ color: "var(--colorNeutralForeground1)" }}>{title}</h3>
        <dl className="mt-3 space-y-1.5">
          {stats.map((s) => (
            <div key={s.label} className="flex items-baseline justify-between gap-3">
              <dt className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>{s.label}</dt>
              <dd className="fui-body1-strong tabular-nums" style={{ color: s.color || "var(--colorNeutralForeground1)" }}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Link>
  );
};

const Overview = () => {
  const { auth } = useContext(AuthContext);
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const userId = auth?.user?._id;
  const userName = auth?.user?.name || "";

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState(null);
  const [products, setProducts] = useState(null);
  const [clients, setClients] = useState(null);
  const [bankTx, setBankTx] = useState(null);
  const [expenses, setExpenses] = useState(null);
  const [userSales, setUserSales] = useState(null);

  useEffect(() => {
    let cancelled = false;
    const pick = (result) => (result.status === "fulfilled" ? result.value?.data : null);

    const load = async () => {
      setLoading(true);
      if (isAdmin) {
        const todayKey = new Date().toLocaleDateString("fr-CA"); // YYYY-MM-DD
        const [s, p, c, b, e] = await Promise.allSettled([
          api.get(`/sales/dashboard-sale?range=30days&summaryDate=${todayKey}`),
          api.get("/products/dashboard?range=month"),
          api.get("/clients/stats"),
          api.get("/bank"),
          api.get("/expenses"),
        ]);
        if (cancelled) return;
        setSales(pick(s));
        setProducts(pick(p));
        setClients(pick(c));
        setBankTx(pick(b));
        setExpenses(pick(e));
      } else if (userId) {
        const [u] = await Promise.allSettled([api.get(`/sales/user/${userId}`)]);
        if (cancelled) return;
        setUserSales(pick(u));
      }
      if (!cancelled) setLoading(false);
    };

    load();
    return () => { cancelled = true; };
  }, [isAdmin, userId]);

  const today = useMemo(
    () => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }),
    []
  );

  // Caisse balance = dépôts − retraits (même calcul que la page Caisse).
  const bankBalance = useMemo(() => {
    if (!Array.isArray(bankTx)) return null;
    return bankTx.reduce((acc, t) => acc + (t.type === "deposit" ? (t.amount || 0) : t.type === "withdraw" ? -(t.amount || 0) : 0), 0);
  }, [bankTx]);

  // Dépenses du mois en cours.
  const monthExpenses = useMemo(() => {
    if (!Array.isArray(expenses)) return null;
    const start = new Date();
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return expenses
      .filter((e) => {
        const d = new Date(e.date || e.createdAt);
        return !Number.isNaN(d.getTime()) && d >= start;
      })
      .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
  }, [expenses]);

  const greeting = (
    <header className="ms-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="fui-caption1 capitalize" style={{ color: "var(--colorNeutralForeground3)" }}>{today}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ms-text-strong)" }}>
          Bonjour{userName ? `, ${userName}` : ""}
        </h1>
        <p className="mt-1 fui-body1" style={{ color: "var(--colorNeutralForeground3)" }}>
          {isAdmin ? "Voici un aperçu de votre boutique aujourd'hui." : "Prêt à enregistrer vos ventes ?"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link
          to="/sales#sale-form"
          className="ms-button ms-button-primary ms-button-md"
        >
          <Plus className="h-4 w-4" /> Nouvelle vente
        </Link>
        {isAdmin && (
          <Link to="/dashboard" className="ms-button ms-button-secondary ms-button-md">
            <BarChart3 className="h-4 w-4" /> Tableau de bord complet
          </Link>
        )}
      </div>
    </header>
  );

  if (loading) {
    return (
      <>
        {greeting}
        <div className="ms-surface p-5"><LoadingSkeleton rows={6} /></div>
      </>
    );
  }

  // ---- Seller (non-admin) overview ----
  if (!isAdmin) {
    const totalAmount = userSales?.totalAmount ?? userSales?.revenue;
    const totalSales = userSales?.totalSales ?? userSales?.salesCount;
    const sellerStats = [
      isFiniteNumber(totalSales) && { title: "Mes ventes", value: num(totalSales), context: "Total enregistré", icon: <ShoppingCart className="h-4 w-4" />, tone: "brand" },
      isFiniteNumber(totalAmount) && { title: "Chiffre d'affaires", value: cfa(totalAmount), context: "Cumulé", icon: <Wallet className="h-4 w-4" />, tone: "success" },
    ].filter(Boolean);

    return (
      <>
        {greeting}
        {sellerStats.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2">
            {sellerStats.map((k) => (
              <KPICard key={k.title} title={k.title} value={k.value} context={k.context} icon={k.icon} tone={k.tone} />
            ))}
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <ModuleCard
            to="/sales#sale-form"
            icon={<ShoppingCart className="h-5 w-5" />}
            tone="brand"
            title="Enregistrer une vente"
            stats={[{ label: "Accès rapide", value: "Vendre" }]}
          />
          <ModuleCard
            to={userId ? `/sales/user/${userId}` : "/sales"}
            icon={<BarChart3 className="h-5 w-5" />}
            tone="success"
            title="Mes ventes"
            stats={[{ label: "Historique & encaissements", value: "Ouvrir" }]}
          />
        </div>
      </>
    );
  }

  // ---- Admin overview ----
  const ds = sales?.dailySummary || {};
  const status = sales?.statusStats || {};
  const toSettle = (status.partially_paid?.count || 0) + (status.pending?.count || 0);

  const lowStock = products?.lowStockCount ?? products?.lowStock;
  const outOfStock = products?.outOfStockCount ?? products?.outOfStock;
  const stockValue = products?.totalStockValue;

  const kpis = [
    { title: "CA du jour", value: cfa(ds.totalAmount), context: `${num(ds.salesCount)} vente(s)`, icon: <TrendingUp className="h-4 w-4" />, tone: "brand" },
    { title: "Encaissé aujourd'hui", value: cfa(ds.paymentsTotal), context: `${num(ds.paymentsCount)} paiement(s)`, icon: <Wallet className="h-4 w-4" />, tone: "success" },
    { title: "Solde de caisse", value: bankBalance == null ? "—" : cfa(bankBalance), context: "Dépôts − retraits", icon: <Landmark className="h-4 w-4" />, tone: bankBalance != null && bankBalance < 0 ? "warning" : "neutral" },
    { title: "Valeur du stock", value: stockValue == null ? "—" : cfa(stockValue), context: "Prix de vente potentiel", icon: <Boxes className="h-4 w-4" />, tone: "neutral" },
  ];

  return (
    <>
      {greeting}

      {/* Bandeau KPI */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k) => (
          <KPICard key={k.title} title={k.title} value={k.value} context={k.context} icon={k.icon} tone={k.tone} />
        ))}
      </div>

      {/* Cartes par module */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ModuleCard
          to="/sales"
          icon={<ShoppingCart className="h-5 w-5" />}
          tone="brand"
          title="Ventes"
          stats={[
            { label: "Aujourd'hui", value: `${num(ds.salesCount)} vente(s)` },
            { label: "CA du jour", value: cfa(ds.totalAmount) },
            { label: "À solder", value: num(toSettle), color: toSettle > 0 ? "var(--colorStatusWarningForeground1)" : undefined },
          ]}
        />
        <ModuleCard
          to="/products"
          icon={<Boxes className="h-5 w-5" />}
          tone="success"
          title="Stock & produits"
          stats={[
            { label: "Produits", value: products?.totalProducts == null ? "—" : num(products.totalProducts) },
            { label: "Stock bas", value: lowStock == null ? "—" : num(lowStock), color: (lowStock || 0) > 0 ? "var(--colorStatusWarningForeground1)" : undefined },
            { label: "Rupture", value: outOfStock == null ? "—" : num(outOfStock), color: (outOfStock || 0) > 0 ? "var(--colorStatusDangerForeground1)" : undefined },
          ]}
        />
        <ModuleCard
          to="/clients"
          icon={<Users className="h-5 w-5" />}
          tone="brand"
          title="Clients"
          stats={[
            { label: "Total", value: clients?.totalClients == null ? "—" : num(clients.totalClients) },
            { label: "Nouveaux (mois)", value: clients?.newThisMonth == null ? "—" : num(clients.newThisMonth) },
            { label: "Achats cumulés", value: clients?.totalSpent == null ? "—" : cfa(clients.totalSpent) },
          ]}
        />
        <ModuleCard
          to="/bank"
          icon={<Landmark className="h-5 w-5" />}
          tone="neutral"
          title="Caisse"
          stats={[
            { label: "Solde", value: bankBalance == null ? "—" : cfa(bankBalance), color: bankBalance != null && bankBalance < 0 ? "var(--colorStatusDangerForeground1)" : "var(--colorStatusSuccessForeground1)" },
            { label: "Mouvements", value: Array.isArray(bankTx) ? num(bankTx.length) : "—" },
          ]}
        />
        <ModuleCard
          to="/expenses"
          icon={<Receipt className="h-5 w-5" />}
          tone="warning"
          title="Dépenses"
          stats={[
            { label: "Ce mois", value: monthExpenses == null ? "—" : cfa(monthExpenses) },
            { label: "Total enregistrées", value: Array.isArray(expenses) ? num(expenses.length) : "—" },
          ]}
        />
        <ModuleCard
          to="/expenses/monthly-plan"
          icon={<AlertTriangle className="h-5 w-5" />}
          tone="neutral"
          title="Objectif mensuel"
          stats={[{ label: "Planification des dépenses", value: "Ouvrir" }]}
        />
      </div>
    </>
  );
};

export default Overview;
