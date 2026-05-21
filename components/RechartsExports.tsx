// This entire file (and recharts) only loads when a chart enters the viewport
import React from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts';

// Re-export everything for convenience
export {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
};

interface ChartWrapperProps {
  type: 'bar' | 'line' | 'area' | 'pie';
  data?: any[];
  height?: number;
  children?: React.ReactNode;
  barSize?: number;
  [key: string]: any;
}

const ChartWrapper: React.FC<ChartWrapperProps> = ({ type, data, height = 240, children, barSize, ...rest }) => {
  const common = { data, ...rest };
  const Chart = type === 'bar' ? BarChart : type === 'line' ? LineChart : type === 'area' ? AreaChart : PieChart;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <Chart {...common} barSize={barSize}>
        {children}
      </Chart>
    </ResponsiveContainer>
  );
};

export default ChartWrapper;
