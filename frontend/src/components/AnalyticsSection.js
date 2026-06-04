import React from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, Target, PieChart } from "lucide-react";
import { KPICard } from "./business";

const MetricCard = ({ title, value, change, trend, color }) => (
  <KPICard
    title={title}
    value={value}
    context={change !== undefined ? `${trend === "up" ? "+" : ""}${change}%` : undefined}
    tone={trend === "up" ? "success" : trend === "down" ? "danger" : "neutral"}
  />
);

const AnalyticsSection = ({ metrics }) => {
  if (!metrics) return null;

  return (
    <div className="ms-surface p-5 space-y-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-[var(--ms-blue)] rounded-lg">
          <Target size={22} className="text-white" />
        </div>
        <h2 className="ms-section-title">Analyse Avancee</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Bénéfice Brut"
          value={`${metrics.grossProfit.toLocaleString()} CFA`}
          change={metrics.dailyGrowth}
          trend={metrics.dailyGrowth >= 0 ? "up" : "down"}
          color={{ bg: "bg-green-50 dark:bg-green-900/30", text: "green-700" }}
        />
        <MetricCard
          title="Marge Commerciale"
          value={`${metrics.profitMargin.toFixed(1)}%`}
          change={metrics.weeklyGrowth}
          trend={metrics.weeklyGrowth >= 0 ? "up" : "down"}
          color={{ bg: "bg-blue-50 dark:bg-blue-900/30", text: "blue-700" }}
        />
        <MetricCard
          title="ROI"
          value={`${metrics.roi.toFixed(1)}%`}
          change={metrics.monthlyGrowth}
          trend={metrics.roi >= 20 ? "up" : "down"}
          color={{ bg: "bg-purple-50 dark:bg-purple-900/30", text: "purple-700" }}
        />
        <MetricCard
          title="Efficacité Opérationnelle"
          value={`${metrics.operationalEfficiency.toFixed(1)}%`}
          color={{ bg: "bg-yellow-50 dark:bg-yellow-900/30", text: "yellow-700" }}
        />
      </div>
    </div>
  );
};

export default AnalyticsSection;
