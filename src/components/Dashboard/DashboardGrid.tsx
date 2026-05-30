/**
 * 仪表盘网格布局
 */
import React, { useMemo } from 'react';
import { Empty, Row, Col, Space, Select, message } from 'antd';
import { useDashboardStore } from '../../store/dashboardStore';
import { useDataStore } from '../../store/dataStore';
import { ChartCard } from './ChartCard';
import type { ChartType } from '../../types';

const NEW_CHART_OPTIONS: { label: string; value: ChartType; icon: string }[] = [
  { label: '柱状图', value: 'bar', icon: '📊' },
  { label: '折线图', value: 'line', icon: '📈' },
  { label: '饼图', value: 'pie', icon: '🥧' },
  { label: '面积图', value: 'area', icon: '🏔️' },
  { label: '散点图', value: 'scatter', icon: '🔵' },
  { label: '雷达图', value: 'radar', icon: '🕸️' },
  { label: '数据表', value: 'table', icon: '📋' },
];

export const DashboardGrid: React.FC = () => {
  const charts = useDashboardStore(s => s.charts);
  const name = useDashboardStore(s => s.name);
  const addChart = useDashboardStore(s => s.addChart);

  const dataSets = useDataStore(s => s.dataSets);
  const currentDataSetId = useDataStore(s => s.currentDataSetId);
  const currentDataSet = useMemo(
    () => dataSets.find(ds => ds.id === currentDataSetId),
    [dataSets, currentDataSetId],
  );

  const handleAddChart = (type: ChartType) => {
    const config = addChart(type, `新${NEW_CHART_OPTIONS.find(o => o.value === type)?.label || '图表'}`);
    message.success(`已添加"${config.title}"`);
  };

  if (!currentDataSet) {
    return (
      <Empty
        description="请先导入数据"
        style={{ marginTop: 100 }}
        image={Empty.PRESENTED_IMAGE_SIMPLE}
      >
        <p style={{ color: '#999' }}>导入数据后即可创建图表进行分析</p>
      </Empty>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 18, fontWeight: 600 }}>{name}</span>
        <Space>
          <span style={{ color: '#999', fontSize: 13 }}>
            数据集: {currentDataSet.name} ({currentDataSet.records.length} 条记录)
          </span>
          <Select
            placeholder="+ 添加图表"
            style={{ width: 160 }}
            onChange={(type: ChartType) => handleAddChart(type)}
            options={NEW_CHART_OPTIONS.map(o => ({
              label: <span>{o.icon} {o.label}</span>,
              value: o.value,
            }))}
            popupMatchSelectWidth={false}
          />
        </Space>
      </div>

      {charts.length === 0 ? (
        <Empty
          description="暂无图表，点击上方「添加图表」创建第一个分析图表"
          style={{ marginTop: 60 }}
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      ) : (
        <Row gutter={[12, 12]}>
          {charts.map(chart => (
            <Col
              key={chart.id}
              xs={24}
              sm={chart.position.w >= 12 ? 24 : 12}
              lg={Math.min(chart.position.w * 2, 24)}
              xl={chart.position.w * 2}
              style={{ height: chart.position.h * 90 + 60 }}
            >
              <ChartCard config={chart} />
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};
