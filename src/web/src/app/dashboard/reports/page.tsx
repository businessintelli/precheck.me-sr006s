'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Chart as ChartJS, ArcElement, LineElement, BarElement, PointElement, CategoryScale, LinearScale, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { DateRange } from 'react-day-picker';
import { ErrorBoundary } from 'react-error-boundary';
import { Card } from '@/components/shared/Card';
import { Table } from '@/components/shared/Table';
import { DatePicker } from '@/components/ui/date-picker';
import { useBackgroundCheck } from '@/hooks/useBackgroundCheck';
import { useWebSocket } from '@/hooks/useWebSocket';
import { BackgroundCheckStatus, BackgroundCheckType } from '@/types/background-check.types';
import { NotificationType } from '@/types/notification.types';
import { cn } from '@/lib/utils';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  LineElement,
  BarElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Title,
  Tooltip,
  Legend
);

// Chart color constants
const CHART_COLORS = {
  primary: 'rgb(59, 130, 246)',
  secondary: 'rgb(99, 102, 241)',
  success: 'rgb(34, 197, 94)',
  warning: 'rgb(234, 179, 8)',
  error: 'rgb(239, 68, 68)'
};

interface ReportMetrics {
  totalChecks: number;
  completionRate: number;
  averageTime: number;
  accuracyRate: number;
  statusDistribution: Record<BackgroundCheckStatus, number>;
  typeDistribution: Record<BackgroundCheckType, number>;
  dailyTrends: Array<{ date: string; count: number }>;
}

const ReportsPage: React.FC = () => {
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [metrics, setMetrics] = useState<ReportMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { backgroundCheck, refetch } = useBackgroundCheck();
  const { subscribe, unsubscribe } = useWebSocket({
    autoConnect: true,
    heartbeatEnabled: true
  });

  // Table columns configuration
  const columns = useMemo(() => [
    {
      key: 'id',
      header: 'Check ID',
      width: '120px'
    },
    {
      key: 'type',
      header: 'Type',
      width: '150px'
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (value: BackgroundCheckStatus) => (
        <span className={cn(
          'px-2 py-1 rounded-full text-sm font-medium',
          value === BackgroundCheckStatus.COMPLETED ? 'bg-green-100 text-green-800' :
          value === BackgroundCheckStatus.REJECTED ? 'bg-red-100 text-red-800' :
          'bg-blue-100 text-blue-800'
        )}>
          {value}
        </span>
      )
    },
    {
      key: 'completionTime',
      header: 'Time to Complete',
      width: '150px',
      align: 'right'
    },
    {
      key: 'accuracy',
      header: 'Accuracy Score',
      width: '120px',
      align: 'right',
      render: (value: number) => `${value.toFixed(2)}%`
    }
  ], []);

  // Handle real-time updates
  useEffect(() => {
    const handleStatusUpdate = (data: any) => {
      refetch();
    };

    subscribe(NotificationType.CHECK_STATUS_UPDATE, handleStatusUpdate);
    return () => unsubscribe(NotificationType.CHECK_STATUS_UPDATE, handleStatusUpdate);
  }, [subscribe, unsubscribe, refetch]);

  // Status distribution chart data
  const statusChartData = useMemo(() => ({
    labels: Object.keys(metrics?.statusDistribution || {}),
    datasets: [{
      data: Object.values(metrics?.statusDistribution || {}),
      backgroundColor: [
        CHART_COLORS.success,
        CHART_COLORS.warning,
        CHART_COLORS.error,
        CHART_COLORS.primary
      ]
    }]
  }), [metrics]);

  // Daily trends chart data
  const trendsChartData = useMemo(() => ({
    labels: metrics?.dailyTrends.map(trend => trend.date) || [],
    datasets: [{
      label: 'Background Checks',
      data: metrics?.dailyTrends.map(trend => trend.count) || [],
      borderColor: CHART_COLORS.primary,
      tension: 0.4
    }]
  }), [metrics]);

  // Error fallback component
  const ErrorFallback = ({ error, resetErrorBoundary }: any) => (
    <Card className="p-6 text-center">
      <h3 className="text-lg font-semibold text-red-600">Error Loading Reports</h3>
      <p className="mt-2 text-gray-600">{error.message}</p>
      <button
        onClick={resetErrorBoundary}
        className="mt-4 px-4 py-2 bg-primary text-white rounded-md hover:bg-primary/90"
      >
        Retry
      </button>
    </Card>
  );

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-semibold">Analytics & Reports</h1>
          <DatePicker
            selected={dateRange}
            onChange={setDateRange}
            selectsRange
            className="w-72"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Checks</h3>
            <p className="mt-2 text-3xl font-semibold">{metrics?.totalChecks || 0}</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Completion Rate</h3>
            <p className="mt-2 text-3xl font-semibold">
              {metrics?.completionRate.toFixed(1)}%
            </p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Average Time</h3>
            <p className="mt-2 text-3xl font-semibold">
              {metrics?.averageTime.toFixed(1)} days
            </p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-500">Accuracy Rate</h3>
            <p className="mt-2 text-3xl font-semibold">
              {metrics?.accuracyRate.toFixed(1)}%
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Status Distribution</h3>
            <div className="h-[300px]">
              <Doughnut
                data={statusChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom'
                    }
                  }
                }}
              />
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="text-lg font-medium mb-4">Daily Trends</h3>
            <div className="h-[300px]">
              <Line
                data={trendsChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: false
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true
                    }
                  }
                }}
              />
            </div>
          </Card>
        </div>

        <Card className="p-6">
          <h3 className="text-lg font-medium mb-4">Detailed Reports</h3>
          <Table
            data={[]} // Replace with actual data
            columns={columns}
            isLoading={isLoading}
            className="w-full"
            stickyHeader
            virtualScroll
          />
        </Card>
      </div>
    </ErrorBoundary>
  );
};

export default ReportsPage;