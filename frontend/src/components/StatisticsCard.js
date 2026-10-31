import { formatCfa } from '../utils/format';
import React from 'react';
import { KPICard } from './business';

const StatisticsCard = ({ title, value, color, textColor }) => (
  <KPICard
    title={title}
    value={`${typeof value === 'number' ? formatCfa(value) : value}`}
    tone="neutral"
  />
);

export default StatisticsCard;