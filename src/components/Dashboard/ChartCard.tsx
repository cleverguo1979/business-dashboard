/**
 * 图表卡片 - 包裹单个图表，提供配置、删除等操作
 */
import React, { useState, useMemo } from 'react';
import { Card, Dropdown, Modal, Select, Button, Space, message, Input } from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  CopyOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import type { ChartConfig, ChartType } from '../../types';
import { useDashboardStore } from '../../store/dashboardStore';
import { useDimensionStore } from '../../store/dimensionStore';
import { ChartRenderer } from '../Charts/ChartRenderer';
import { ChartDataTable } from '../Charts/DataTable';

interface ChartCardProps {
  config: ChartConfig;
}

const CHART_TYPE_OPTIONS: { label: string; value: ChartType }[] = [
  { label: '柱状图', value: 'bar' },
  { label: '折线图', value: 'line' },
  { label: '饼图', value: 'pie' },
  { label: '面积图', value: 'area' },
  { label: '散点图', value: 'scatter' },
  { label: '雷达图', value: 'radar' },
  { label: '数据表', value: 'table' },
];

export const ChartCard: React.FC<ChartCardProps> = ({ config }) => {
  const updateChart = useDashboardStore(s => s.updateChart);
  const removeChart = useDashboardStore(s => s.removeChart);
  const duplicateChart = useDashboardStore(s => s.duplicateChart);

  // 订阅原始数组，用 useMemo 派生
  const allDimensions = useDimensionStore(s => s.dimensions);
  const dimensions = useMemo(() => allDimensions.filter(d => d.enabled), [allDimensions]);

  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: config.title,
    type: config.type,
    xDimension: config.xDimension || '',
    yDimension: config.yDimension || '',
    groupBy: config.groupBy || '',
  });

  const handleSave = () => {
    updateChart(config.id, {
      title: editForm.title,
      type: editForm.type,
      xDimension: editForm.xDimension || undefined,
      yDimension: editForm.yDimension || undefined,
      groupBy: editForm.groupBy || undefined,
    });
    setEditOpen(false);
    message.success('图表配置已更新');
  };

  const chartHeight = config.position.h * 90;

  const dimensionOptions = useMemo(
    () => dimensions.map(d => ({ label: `${d.label} (${d.fieldKey})`, value: d.fieldKey })),
    [dimensions],
  );

  const extraMenu = useMemo(() => ({
    items: [
      { key: 'edit', icon: <EditOutlined />, label: '配置', onClick: () => {
        setEditForm({
          title: config.title,
          type: config.type,
          xDimension: config.xDimension || '',
          yDimension: config.yDimension || '',
          groupBy: config.groupBy || '',
        });
        setEditOpen(true);
      }},
      { key: 'copy', icon: <CopyOutlined />, label: '复制', onClick: () => duplicateChart(config.id) },
      { type: 'divider' as const },
      { key: 'delete', icon: <DeleteOutlined />, label: '删除', danger: true,
        onClick: () => {
          removeChart(config.id);
          message.success('图表已删除');
        },
      },
    ],
  }), [config, duplicateChart, removeChart]);

  return (
    <>
      <Card
        title={config.title}
        size="small"
        extra={
          <Dropdown menu={extraMenu} trigger={['click']}>
            <Button size="small" type="text" icon={<MoreOutlined />} />
          </Dropdown>
        }
        style={{ height: '100%', overflow: 'hidden' }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        {config.type === 'table' ? (
          <ChartDataTable config={config} height={chartHeight} />
        ) : (
          <ChartRenderer config={config} height={chartHeight} />
        )}
      </Card>

      <Modal
        title="编辑图表"
        open={editOpen}
        onOk={handleSave}
        onCancel={() => setEditOpen(false)}
        okText="保存"
        cancelText="取消"
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>图表名称</label>
            <Input
              value={editForm.title}
              onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>图表类型</label>
            <Select
              style={{ width: '100%' }}
              value={editForm.type}
              onChange={v => setEditForm(f => ({ ...f, type: v }))}
              options={CHART_TYPE_OPTIONS}
            />
          </div>
          {editForm.type !== 'table' && (
            <>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>分类维度（X轴/分组）</label>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择分类字段"
                  allowClear
                  value={editForm.xDimension || undefined}
                  onChange={v => setEditForm(f => ({ ...f, xDimension: v || '' }))}
                  options={dimensionOptions}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>数值维度（Y轴/值）</label>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择数值字段"
                  allowClear
                  value={editForm.yDimension || undefined}
                  onChange={v => setEditForm(f => ({ ...f, yDimension: v || '' }))}
                  options={dimensionOptions}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 4 }}>分组维度（可选）</label>
                <Select
                  style={{ width: '100%' }}
                  placeholder="选择分组字段"
                  allowClear
                  value={editForm.groupBy || undefined}
                  onChange={v => setEditForm(f => ({ ...f, groupBy: v || '' }))}
                  options={dimensionOptions}
                />
              </div>
            </>
          )}
        </Space>
      </Modal>
    </>
  );
};
