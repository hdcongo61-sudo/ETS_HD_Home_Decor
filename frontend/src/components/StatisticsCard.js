import React from 'react';
import { KPICard } from './business';

const StatisticsCard = ({ title, value, color, textColor }) => (
  <KPICard
    title={title}
    value={`${typeof value === 'number' ? value.toFixed() : value} CFA`}
    tone="neutral"
  />
);

export default StatisticsCard;