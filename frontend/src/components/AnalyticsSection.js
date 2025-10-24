import React from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, Target, PieChart } from "lucide-react";

const MetricCard = ({ title, value, change, trend, color }) => (
  <motion.div
    whileHover={{ scale: 1.03 }}
    className={`p-5 rounded-2xl border dark:border-gray-700 ${color.bg} text-${color.text}`}
  >
    <div className="flex justify-between items-center mb-2">
      <h4 className="font-semibold text-sm opacity-80">{title}</h4>
      {trend === "up" ? <TrendingUp size={16} /> : trend === "down" ? <TrendingDown size={16} /> : null}
    </div>
    <div className="text-2xl font-bold mb-1">{value}</div>
    {change !== undefined && (
      <div className={`text-sm ${trend === "up" ? "text-green-500" : "text-red-500"}`}>
        {trend === "up" ? "+" : ""}
        {change}%
      </div>
    )}
  </motion.div>
);

const AnalyticsSection = ({ metrics }) => {
  if (!metrics) return null;

  return (
    <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow border dark:border-gray-700 space-y-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg">
          <Target size={22} className="text-white" />
        </div>
        <h2 className="text-xl font-semibold">Analyse Avancée</h2>
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
