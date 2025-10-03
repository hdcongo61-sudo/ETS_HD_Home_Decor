import React from 'react';

const StatisticsCard = ({ title, value, color, textColor }) => (
  <div className={`${color} p-6 rounded-lg shadow-sm`}>
    <h3 className="text-lg font-medium text-gray-600">{title}</h3>
    <p className={`${textColor} text-3xl font-bold mt-2`}>
      {typeof value === 'number' ? value.toFixed() : value} CFA
    </p>
  </div>
);

export default StatisticsCard;