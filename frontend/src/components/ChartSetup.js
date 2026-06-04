import React, { useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from 'chart.js';

let registered = false;

const ChartSetup = () => {
  useEffect(() => {
    if (!registered) {
      ChartJS.register(
        CategoryScale,
        LinearScale,
        PointElement,
        LineElement,
        BarElement,
        Title,
        Tooltip,
        Legend,
        ArcElement,
        Filler
      );
      registered = true;
    }
  }, []);

  return null;
};

export default ChartSetup;
