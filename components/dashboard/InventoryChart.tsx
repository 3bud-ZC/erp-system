'use client';

import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend);

interface InventoryChartProps {
  data: {
    rawMaterials: number;
    finishedGoods: number;
    packaging: number;
  };
}

export default function InventoryChart({ data }: InventoryChartProps) {
  // Defensive checks for undefined data
  const safeData = {
    rawMaterials: data?.rawMaterials || 0,
    finishedGoods: data?.finishedGoods || 0,
    packaging: data?.packaging || 0,
  };

  const chartData = {
    labels: ['الخامات', 'المنتجات النهائية', 'مواد التعبئة'],
    datasets: [
      {
        data: [safeData.rawMaterials, safeData.finishedGoods, safeData.packaging],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',   // Blue - Raw Materials
          'rgba(34, 197, 94, 0.8)',    // Green - Finished Goods
          'rgba(249, 115, 22, 0.8)',   // Orange - Packaging
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(34, 197, 94)',
          'rgb(249, 115, 22)',
        ],
        borderWidth: 2,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        position: 'bottom' as const,
        align: 'center' as const,
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            family: 'system-ui',
            size: 11,
          },
          color: '#374151',
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#1f2937',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} منتج (${percentage}%)`;
          },
        },
      },
    },
  };

  const total = safeData.rawMaterials + safeData.finishedGoods + safeData.packaging;

  return (
    <div className="relative h-56">
      <Doughnut data={chartData} options={options} />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800">{total}</p>
          <p className="text-xs text-gray-500">إجمالي المنتجات</p>
        </div>
      </div>
    </div>
  );
}
