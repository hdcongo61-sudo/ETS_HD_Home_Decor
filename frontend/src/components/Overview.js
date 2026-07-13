import React, { useState, useEffect, useContext, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
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
  PackageX,
  Truck,
  CalendarClock,
  BadgeAlert,
  HandCoins,
  CheckCircle2,
  UsersRound,
  Calculator,
  FileText,
  Crown,
} from "lucide-react";
import api from "../services/api";
import AuthContext from "../context/AuthContext";
import { KPICard, LoadingSkeleton } from "./business";
import { formatCfa as cfa } from "../utils/format";
import { SERIE_PROFIT } from "../utils/chartColors";
import { useModal } from "../context/ModalContext";

const num = (value) => (Number(value) || 0).toLocaleString("fr-FR");
const isFiniteNumber = (value) => Number.isFinite(Number(value));
const pick = (result) => (result.status === "fulfilled" ? result.value?.data : null);

const TONES = {
  brand:   { bg: "var(--ms-blue-soft)",                    fg: "var(--colorBrandForeground1)" },
  success: { bg: "var(--colorStatusSuccessBackground1)",  fg: "var(--colorStatusSuccessForeground1)" },
  warning: { bg: "var(--colorStatusWarningBackground1)",  fg: "var(--colorStatusWarningForeground1)" },
  danger:  { bg: "var(--colorStatusDangerBackground1)",   fg: "var(--colorStatusDangerForeground1)" },
  neutral: { bg: "var(--colorNeutralBackground3)",        fg: "var(--colorNeutralForeground2)" },
};

/* ---------- Bloc générique de section ---------- */
const SectionCard = ({ title, description, action, children }) => (
  <section className="ms-surface flex h-full flex-col p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="fui-subtitle2" style={{ color: "var(--colorNeutralForeground1)" }}>{title}</h2>
        {description && (
          <p className="mt-0.5 fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>{description}</p>
        )}
      </div>
      {action}
    </div>
    <div className="mt-4 flex-1">{children}</div>
  </section>
);

const SectionLink = ({ to, children = "Tout voir" }) => (
  <Link
    to={to}
    className="inline-flex shrink-0 items-center gap-1 fui-caption1-strong hover:underline"
    style={{ color: "var(--colorBrandForeground1)" }}
  >
    {children}
    <ChevronRight className="h-3.5 w-3.5" />
  </Link>
);

/* ---------- Carte module (raccourci avec stats) ---------- */
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

/* ---------- Élément du centre d'actions « À traiter » ---------- */
const ActionItem = ({ to, icon, tone, label, count, detail }) => {
  const t = TONES[tone] || TONES.warning;
  return (
    <Link
      to={to}
      className="group flex items-center gap-3 rounded-[var(--radiusLarge)] border p-3 transition-shadow hover:shadow-[var(--ms-shadow)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]"
      style={{ borderColor: "var(--ms-border)", background: "var(--ms-white)" }}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radiusLarge)]" style={{ background: t.bg, color: t.fg }}>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate fui-caption1-strong" style={{ color: "var(--colorNeutralForeground1)" }}>{label}</p>
        {detail && (
          <p className="truncate fui-caption1 tabular-nums" style={{ color: "var(--colorNeutralForeground3)" }}>{detail}</p>
        )}
      </div>
      <span
        className="inline-flex h-6 min-w-[24px] shrink-0 items-center justify-center rounded-full px-1.5 fui-caption1-strong tabular-nums"
        style={{ background: t.bg, color: t.fg }}
      >
        {num(count)}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5" style={{ color: "var(--colorNeutralForeground3)" }} />
    </Link>
  );
};

/* ---------- Ligne classement (top produits / clients) ---------- */
const RankedRow = ({ to, rank, title, subtitle, value, share }) => (
  <Link
    to={to}
    className="block rounded-[var(--radiusLarge)] px-2 py-2 -mx-2 transition-colors hover:bg-[var(--ms-bg-subtle)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ms-blue)]"
  >
    <div className="flex items-center gap-3">
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full fui-caption1-strong tabular-nums"
        style={{
          background: rank === 1 ? "var(--colorStatusWarningBackground1)" : "var(--colorNeutralBackground3)",
          color: rank === 1 ? "var(--colorStatusWarningForeground1)" : "var(--colorNeutralForeground2)",
        }}
      >
        {rank === 1 ? <Crown className="h-3.5 w-3.5" /> : rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="truncate fui-caption1-strong" style={{ color: "var(--colorNeutralForeground1)" }}>{title}</p>
          <p className="shrink-0 fui-caption1-strong tabular-nums" style={{ color: "var(--colorNeutralForeground1)" }}>{value}</p>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--colorNeutralBackground3)" }}>
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.max(4, Math.min(100, share))}%`, background: "var(--colorBrandBackground)" }}
            />
          </div>
          {subtitle && (
            <span className="shrink-0 fui-caption1 tabular-nums" style={{ color: "var(--colorNeutralForeground3)" }}>{subtitle}</span>
          )}
        </div>
      </div>
    </div>
  </Link>
);

/* ---------- Ligne du volet finances ---------- */
const FinanceRow = ({ label, value, badge, badgeTone, strong, color }) => (
  <div
    className="flex items-center justify-between gap-3 py-2"
    style={{ borderBottom: "1px solid var(--ms-border)" }}
  >
    <span className={strong ? "fui-body1-strong" : "fui-caption1"} style={{ color: strong ? "var(--colorNeutralForeground1)" : "var(--colorNeutralForeground3)" }}>
      {label}
    </span>
    <span className="flex items-center gap-2">
      {badge != null && (
        <span
          className="rounded-full px-2 py-0.5 fui-caption1-strong tabular-nums"
          style={{ background: (TONES[badgeTone] || TONES.neutral).bg, color: (TONES[badgeTone] || TONES.neutral).fg }}
        >
          {badge}
        </span>
      )}
      <span className={`${strong ? "fui-body1-strong" : "fui-caption1-strong"} tabular-nums`} style={{ color: color || "var(--colorNeutralForeground1)" }}>
        {value}
      </span>
    </span>
  </div>
);

const Overview = () => {
  const { auth } = useContext(AuthContext);
  const { openModal } = useModal();
  const isAdmin = Boolean(auth?.user?.isAdmin);
  const userId = auth?.user?._id;
  const userName = auth?.user?.name || "";
  const shopName = auth?.tenant?.name || "";

  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState(null);
  const [products, setProducts] = useState(null);
  const [clients, setClients] = useState(null);
  const [bankTx, setBankTx] = useState(null);
  const [compta, setCompta] = useState(null);
  const [reminders, setReminders] = useState(null);
  const [delivery, setDelivery] = useState(null);
  const [userSales, setUserSales] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      if (isAdmin) {
        const todayKey = new Date().toLocaleDateString("fr-CA"); // YYYY-MM-DD
        const [s, p, c, b, k, r, d] = await Promise.allSettled([
          api.get(`/sales/dashboard-sale?range=30days&summaryDate=${todayKey}`),
          api.get("/products/dashboard?range=month"),
          api.get("/clients/stats"),
          api.get("/bank"),
          api.get("/comptabilite/summary"), // mois en cours par défaut
          api.get("/sales/reminders/upcoming"),
          api.get("/sales/stats/delivery"),
        ]);
        if (cancelled) return;
        setSales(pick(s));
        setProducts(pick(p));
        setClients(pick(c));
        setBankTx(pick(b));
        setCompta(pick(k)?.data || null);
        setReminders(pick(r));
        setDelivery(pick(d));
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

  // Recharge silencieuse quand une vente/paiement/dépense est créée via le FAB.
  useEffect(() => {
    if (!isAdmin) return undefined;
    let timeoutId = null;
    const refresh = () => {
      // léger debounce : plusieurs événements peuvent arriver d'affilée
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(async () => {
        const todayKey = new Date().toLocaleDateString("fr-CA");
        const [s, b, k, r] = await Promise.allSettled([
          api.get(`/sales/dashboard-sale?range=30days&summaryDate=${todayKey}`),
          api.get("/bank"),
          api.get("/comptabilite/summary"),
          api.get("/sales/reminders/upcoming"),
        ]);
        setSales((prev) => pick(s) || prev);
        setBankTx((prev) => pick(b) || prev);
        setCompta((prev) => pick(k)?.data || prev);
        setReminders((prev) => pick(r) || prev);
      }, 400);
    };
    window.addEventListener("saleCreated", refresh);
    window.addEventListener("paymentCreated", refresh);
    window.addEventListener("expenseCreated", refresh);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener("saleCreated", refresh);
      window.removeEventListener("paymentCreated", refresh);
      window.removeEventListener("expenseCreated", refresh);
    };
  }, [isAdmin]);

  const today = useMemo(
    () => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    []
  );

  // Caisse balance = dépôts − retraits (même calcul que la page Caisse).
  const bankBalance = useMemo(() => {
    if (!Array.isArray(bankTx)) return null;
    return bankTx.reduce((acc, t) => acc + (t.type === "deposit" ? (t.amount || 0) : t.type === "withdraw" ? -(t.amount || 0) : 0), 0);
  }, [bankTx]);

  // Tendance CA — 30 derniers jours, jours sans vente inclus à 0.
  const trend30 = useMemo(() => {
    const raw = sales?.salesTrend;
    if (!Array.isArray(raw)) return [];
    const byDate = {};
    raw.forEach((r) => { if (r?.date) byDate[r.date] = Number(r.total) || 0; });
    const out = [];
    const day = new Date();
    day.setHours(0, 0, 0, 0);
    day.setDate(day.getDate() - 29);
    for (let i = 0; i < 30; i += 1) {
      const key = day.toLocaleDateString("fr-CA");
      out.push({ date: key, total: byDate[key] || 0 });
      day.setDate(day.getDate() + 1);
    }
    return out;
  }, [sales]);

  const trend30Total = useMemo(() => trend30.reduce((s, d) => s + d.total, 0), [trend30]);

  const greeting = (
    <header className="ms-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="fui-caption1 capitalize" style={{ color: "var(--colorNeutralForeground3)" }}>
          {today}{shopName ? ` · ${shopName}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: "var(--ms-text-strong)" }}>
          Bonjour{userName ? `, ${userName}` : ""}
        </h1>
        <p className="mt-1 fui-body1" style={{ color: "var(--colorNeutralForeground3)" }}>
          {isAdmin ? "Voici la situation de votre boutique en un coup d'œil." : "Prêt à enregistrer vos ventes ?"}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => openModal("sale")} className="ms-button ms-button-primary ms-button-md">
          <Plus className="h-4 w-4" /> Nouvelle vente
        </button>
        {isAdmin && (
          <Link to="/dashboard" className="ms-button ms-button-secondary ms-button-md">
            <BarChart3 className="h-4 w-4" /> Analyse détaillée
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

  // ---- Vue vendeur (non admin) ----
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

  // ---- Vue admin ----
  const ds = sales?.dailySummary || {};
  const status = sales?.statusStats || {};
  const toSettle = (status.partially_paid?.count || 0) + (status.pending?.count || 0);

  const lowStockArr = products?.lowStockProducts;
  const outOfStockArr = products?.outOfStockProducts;
  const lowStock = Array.isArray(lowStockArr) ? lowStockArr.length : products?.lowStockCount;
  const outOfStock = Array.isArray(outOfStockArr) ? outOfStockArr.length : products?.outOfStockCount;
  const stockValue = products?.totalStockValue;

  const cr = compta?.compteResultat || null;
  const treso = compta?.tresorerie || null;
  const creances = compta?.creances || null;

  // ----- Centre d'actions « À traiter » -----
  const overdue = Array.isArray(reminders?.overdue) ? reminders.overdue : [];
  const upcoming = Array.isArray(reminders?.upcoming) ? reminders.upcoming : [];
  const neverPaid = Array.isArray(reminders?.neverPaid) ? reminders.neverPaid : [];
  const salaryReminders = Array.isArray(reminders?.salaryReminders) ? reminders.salaryReminders : [];
  const sumBalance = (arr) => arr.reduce((s, r) => s + (Number(r?.balance) || 0), 0);
  const deliveriesTodo = (delivery?.pending?.count || 0) + (delivery?.not_delivered?.count || 0);

  const actionItems = [
    overdue.length > 0 && {
      key: "overdue", to: "/sales/partially-paid", tone: "danger", icon: <BadgeAlert className="h-4 w-4" />,
      label: "Paiements en retard", count: overdue.length, detail: `${cfa(sumBalance(overdue))} à recouvrer`,
    },
    neverPaid.length > 0 && {
      key: "neverpaid", to: "/sales/partially-paid", tone: "danger", icon: <HandCoins className="h-4 w-4" />,
      label: "Ventes jamais encaissées", count: neverPaid.length, detail: `${cfa(sumBalance(neverPaid))} dus`,
    },
    upcoming.length > 0 && {
      key: "upcoming", to: "/sales/partially-paid", tone: "warning", icon: <CalendarClock className="h-4 w-4" />,
      label: "Échéances à venir", count: upcoming.length, detail: `${cfa(sumBalance(upcoming))} attendus`,
    },
    (outOfStock || 0) > 0 && {
      key: "outofstock", to: "/products/out-of-stock", tone: "danger", icon: <PackageX className="h-4 w-4" />,
      label: "Produits en rupture", count: outOfStock, detail: "Réapprovisionnement requis",
    },
    (lowStock || 0) > 0 && {
      key: "lowstock", to: "/products/critical", tone: "warning", icon: <AlertTriangle className="h-4 w-4" />,
      label: "Stock critique", count: lowStock, detail: "Sous le seuil d'alerte",
    },
    deliveriesTodo > 0 && {
      key: "delivery", to: "/sales", tone: "brand", icon: <Truck className="h-4 w-4" />,
      label: "Livraisons à préparer", count: deliveriesTodo, detail: "Commandes non livrées",
    },
    salaryReminders.length > 0 && {
      key: "salaries", to: "/employees", tone: "brand", icon: <UsersRound className="h-4 w-4" />,
      label: "Salaires à préparer", count: salaryReminders.length,
      detail: cfa(salaryReminders.reduce((s, e) => s + (Number(e?.salary) || 0), 0)),
    },
  ].filter(Boolean);

  // ----- KPI -----
  const kpis = [
    { title: "CA du jour", value: cfa(ds.totalAmount), context: `${num(ds.salesCount)} vente(s) aujourd'hui`, icon: <TrendingUp className="h-4 w-4" />, tone: "brand" },
    { title: "Encaissé aujourd'hui", value: cfa(ds.paymentsTotal), context: `${num(ds.paymentsCount)} paiement(s)`, icon: <Wallet className="h-4 w-4" />, tone: "success" },
    { title: "Solde de caisse", value: bankBalance == null ? "—" : cfa(bankBalance), context: "Dépôts − retraits", icon: <Landmark className="h-4 w-4" />, tone: bankBalance != null && bankBalance < 0 ? "warning" : "neutral" },
    { title: "Créances clients", value: creances == null ? "—" : cfa(creances.clients), context: creances ? `${num(creances.nbFactures)} facture(s) à encaisser` : "", icon: <HandCoins className="h-4 w-4" />, tone: (creances?.clients || 0) > 0 ? "warning" : "neutral" },
    { title: "Valeur du stock", value: stockValue == null ? "—" : cfa(stockValue), context: "Prix de vente potentiel", icon: <Boxes className="h-4 w-4" />, tone: "neutral" },
    { title: "Résultat net (mois)", value: cr == null ? "—" : cfa(cr.resultatNet), context: cr ? `Marge brute ${cr.margeBrutePct}% · Net ${cr.resultatNetPct}%` : "", icon: <Calculator className="h-4 w-4" />, tone: cr ? (cr.resultatNet >= 0 ? "success" : "danger") : "neutral" },
  ];

  // ----- Top produits / clients -----
  const topProducts = Array.isArray(sales?.topProducts) ? sales.topProducts.slice(0, 5) : [];
  const maxProductQty = Math.max(1, ...topProducts.map((p) => Number(p?.quantity) || 0));
  const topClients = Array.isArray(clients?.topClients) ? clients.topClients.slice(0, 5) : [];
  const maxClientSpent = Math.max(1, ...topClients.map((c) => Number(c?.totalSpent) || 0));

  return (
    <>
      {greeting}

      {/* Bandeau KPI — situation instantanée */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {kpis.map((k) => (
          <KPICard key={k.title} title={k.title} value={k.value} context={k.context} icon={k.icon} tone={k.tone} />
        ))}
      </div>

      {/* Centre d'actions */}
      <section className="ms-surface p-5" aria-label="Actions à traiter">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="fui-subtitle2" style={{ color: "var(--colorNeutralForeground1)" }}>À traiter</h2>
            <p className="mt-0.5 fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>
              Ce qui demande votre attention aujourd'hui
            </p>
          </div>
          {actionItems.length > 0 && (
            <span
              className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-full px-2 fui-caption1-strong tabular-nums"
              style={{ background: "var(--colorStatusWarningBackground1)", color: "var(--colorStatusWarningForeground1)" }}
            >
              {actionItems.length}
            </span>
          )}
        </div>
        {actionItems.length > 0 ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {actionItems.map((item) => (
              <ActionItem key={item.key} {...item} />
            ))}
          </div>
        ) : (
          <div
            className="mt-4 flex items-center gap-3 rounded-[var(--radiusLarge)] p-4"
            style={{ background: "var(--colorStatusSuccessBackground1)", border: "1px solid var(--colorStatusSuccessStroke1)" }}
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "var(--colorStatusSuccessForeground1)" }} />
            <p className="fui-caption1-strong" style={{ color: "var(--colorStatusSuccessForeground1)" }}>
              Tout est à jour — aucun impayé en retard, stock sous contrôle.
            </p>
          </div>
        )}
      </section>

      {/* Tendance 30 jours + Finances du mois */}
      <div className="grid gap-4 xl:grid-cols-5">
        <div className="xl:col-span-3">
          <SectionCard
            title="Chiffre d'affaires — 30 derniers jours"
            description={`${cfa(trend30Total)} cumulés · moyenne ${cfa(trend30Total / 30)} / jour`}
            action={
              <Link
                to="/dashboard"
                className="inline-flex shrink-0 items-center gap-1 fui-caption1-strong hover:underline"
                style={{ color: "var(--colorBrandForeground1)" }}
              >
                Analyse complète
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            }
          >
            <div className="h-44 sm:h-52">
              {trend30.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trend30} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ovTrend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={SERIE_PROFIT} stopOpacity={0.28} />
                        <stop offset="100%" stopColor={SERIE_PROFIT} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d) => new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                      tick={{ fontSize: 10, fill: "var(--colorNeutralForeground3)" }}
                      ticks={[trend30[0]?.date, trend30[14]?.date, trend30[29]?.date].filter(Boolean)}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide domain={[0, "auto"]} />
                    <Tooltip
                      formatter={(v) => [cfa(v), "Ventes"]}
                      labelFormatter={(d) => new Date(`${d}T00:00:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
                      contentStyle={{
                        borderRadius: 12,
                        border: "none",
                        boxShadow: "0 10px 30px rgba(0,0,0,.12)",
                        fontSize: 12,
                      }}
                    />
                    <Area type="monotone" dataKey="total" stroke={SERIE_PROFIT} strokeWidth={2} fill="url(#ovTrend)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <p className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>Pas encore de ventes sur la période.</p>
              )}
            </div>
          </SectionCard>
        </div>

        <div className="xl:col-span-2">
          <SectionCard
            title="Finances du mois"
            description="Compte de résultat (encaissé)"
            action={<SectionLink to="/comptabilite">Comptabilité</SectionLink>}
          >
            {cr ? (
              <div>
                <FinanceRow label="Chiffre d'affaires encaissé" value={cfa(cr.chiffreAffaires)} />
                <FinanceRow label="Coût des marchandises" value={`− ${cfa(cr.coutMarchandises)}`} />
                <FinanceRow
                  label="Marge brute"
                  value={cfa(cr.margeBrute)}
                  badge={`${cr.margeBrutePct}%`}
                  badgeTone={cr.margeBrute >= 0 ? "success" : "danger"}
                />
                <FinanceRow label="Dépenses" value={`− ${cfa(cr.depenses)}`} />
                {(cr.pertes || 0) > 0 && <FinanceRow label="Pertes de stock" value={`− ${cfa(cr.pertes)}`} />}
                <FinanceRow
                  label="Résultat net"
                  value={cfa(cr.resultatNet)}
                  badge={`${cr.resultatNetPct}%`}
                  badgeTone={cr.resultatNet >= 0 ? "success" : "danger"}
                  strong
                  color={cr.resultatNet >= 0 ? "var(--colorStatusSuccessForeground1)" : "var(--colorStatusDangerForeground1)"}
                />
                {treso && (
                  <FinanceRow
                    label="Flux de trésorerie"
                    value={cfa(treso.flux)}
                    color={treso.flux >= 0 ? "var(--colorStatusSuccessForeground1)" : "var(--colorStatusDangerForeground1)"}
                  />
                )}
              </div>
            ) : (
              <p className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>
                Données comptables indisponibles.
              </p>
            )}
          </SectionCard>
        </div>
      </div>

      {/* Top produits + meilleurs clients */}
      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Top produits — 30 jours"
          description="Les plus vendus en quantité"
          action={<SectionLink to="/products/top-sellers" />}
        >
          {topProducts.length > 0 ? (
            <div className="space-y-1">
              {topProducts.map((p, i) => (
                <RankedRow
                  key={p?.product?._id || i}
                  to={p?.product?._id ? `/products/${p.product._id}` : "/products"}
                  rank={i + 1}
                  title={p?.product?.name || "Produit"}
                  subtitle={p?.product?.price != null ? cfa(p.product.price) : undefined}
                  value={`${num(p?.quantity)} vendus`}
                  share={((Number(p?.quantity) || 0) / maxProductQty) * 100}
                />
              ))}
            </div>
          ) : (
            <p className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>Aucune vente sur les 30 derniers jours.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Meilleurs clients"
          description="Par montant d'achats cumulé"
          action={<SectionLink to="/clients" />}
        >
          {topClients.length > 0 ? (
            <div className="space-y-1">
              {topClients.map((c, i) => (
                <RankedRow
                  key={c?._id || i}
                  to={c?._id ? `/clients/${c._id}` : "/clients"}
                  rank={i + 1}
                  title={c?.name || "Client"}
                  subtitle={`${num(c?.totalSales)} achat(s)`}
                  value={cfa(c?.totalSpent)}
                  share={((Number(c?.totalSpent) || 0) / maxClientSpent) * 100}
                />
              ))}
            </div>
          ) : (
            <p className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>Pas encore de clients enregistrés.</p>
          )}
        </SectionCard>
      </div>

      {/* Modules */}
      <section aria-label="Accès aux modules">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="fui-subtitle2" style={{ color: "var(--colorNeutralForeground1)" }}>Modules</h2>
          <span className="fui-caption1" style={{ color: "var(--colorNeutralForeground3)" }}>Accès direct avec chiffres clés</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              { label: "Ce mois", value: cr == null ? "—" : cfa(cr.depenses) },
              { label: "Plan mensuel", value: "Ouvrir" },
            ]}
          />
          <ModuleCard
            to="/employees"
            icon={<UsersRound className="h-5 w-5" />}
            tone="brand"
            title="Employés & paie"
            stats={[
              { label: "Salaires à préparer", value: num(salaryReminders.length), color: salaryReminders.length > 0 ? "var(--colorStatusWarningForeground1)" : undefined },
              { label: "Gestion RH", value: "Ouvrir" },
            ]}
          />
          <ModuleCard
            to="/comptabilite"
            icon={<Calculator className="h-5 w-5" />}
            tone="success"
            title="Comptabilité"
            stats={[
              { label: "Résultat net (mois)", value: cr == null ? "—" : cfa(cr.resultatNet), color: cr ? (cr.resultatNet >= 0 ? "var(--colorStatusSuccessForeground1)" : "var(--colorStatusDangerForeground1)") : undefined },
              { label: "Créances", value: creances == null ? "—" : cfa(creances.clients) },
            ]}
          />
          <ModuleCard
            to="/documents"
            icon={<FileText className="h-5 w-5" />}
            tone="neutral"
            title="Documents"
            stats={[
              { label: "Proformas & factures", value: "Ouvrir" },
            ]}
          />
        </div>
      </section>
    </>
  );
};

export default Overview;
