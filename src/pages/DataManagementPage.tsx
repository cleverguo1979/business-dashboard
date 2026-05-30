/**
 * 数据管理页面 - 查看、管理已导入的数据
 */
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Table, Select, Button, Space, Popconfirm, message, Empty, Tag, Statistic, Row, Col } from 'antd';
import { DeleteOutlined, DownloadOutlined } from '@ant-design/icons';
import { useDataStore } from '../store/dataStore';
import { useDimensionStore } from '../store/dimensionStore';

export const DataManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const dataSets = useDataStore(s => s.dataSets);
  const removeDataSet = useDataStore(s => s.removeDataSet);
  const currentDataSetId = useDataStore(s => s.currentDataSetId);
  const setCurrentDataSet = useDataStore(s => s.setCurrentDataSet);
  const dimensions = useDimensionStore(s => s.dimensions);
  const [viewDataSetId, setViewDataSetId] = useState<string | null>(null);

  const viewSet = useMemo(
    () => dataSets.find(ds => ds.id === (viewDataSetId || currentDataSetId)),
    [dataSets, viewDataSetId, currentDataSetId],
  );

  const handleDelete = (id: string) => {
    removeDataSet(id);
    if (viewDataSetId === id) setViewDataSetId(null);
    message.success('数据集已删除');
  };

  const handleExportCSV = (ds: typeof dataSets[0]) => {
    const headers = ds.columns.map(c => c.key);
    const csvContent = [
      headers.join(','),
      ...ds.records.map(r => headers.map(h => {
        const val = String(r[h] ?? '');
        return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
      }).join(',')),
    ].join('\n');

    const blob = new Blob(['﻿' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ds.name}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('导出成功');
  };

  if (dataSets.length === 0) {
    return (
      <Empty description="暂无数据，请先导入数据" style={{ marginTop: 100 }}>
        <Button type="primary" onClick={() => navigate('/import')}>前往导入</Button>
      </Empty>
    );
  }

  return (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <span style={{ fontWeight: 500 }}>当前数据集：</span>
          <Select
            style={{ width: 300 }}
            value={viewDataSetId || currentDataSetId}
            onChange={v => setViewDataSetId(v)}
            options={dataSets.map(ds => ({
              label: `${ds.name} (${ds.records.length}条, ${ds.fileName})`,
              value: ds.id,
            }))}
          />
          <Button
            type="primary"
            size="small"
            disabled={(viewDataSetId || currentDataSetId) === currentDataSetId}
            onClick={() => {
              if (viewDataSetId) setCurrentDataSet(viewDataSetId);
              message.success('已切换当前使用的数据集');
            }}
          >
            设为当前
          </Button>
        </Space>
      </Card>

      {viewSet && (
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col span={4}>
            <Card size="small">
              <Statistic title="总记录数" value={viewSet.records.length} suffix="条" />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="字段数" value={viewSet.columns.length} suffix="个" />
            </Card>
          </Col>
          <Col span={4}>
            <Card size="small">
              <Statistic title="维度数" value={dimensions.length} suffix="个" />
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Statistic
                title="列信息"
                value={viewSet.columns.map(c =>
                  `${c.label}(${c.type === 'number' ? '数值' : c.type === 'date' ? '日期' : '文本'})`
                ).join(' | ')}
                valueStyle={{ fontSize: 12, color: '#666' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {viewSet && (
        <Card
          title={`📋 ${viewSet.name}`}
          extra={
            <Space>
              <Button icon={<DownloadOutlined />} size="small" onClick={() => handleExportCSV(viewSet)}>
                导出 CSV
              </Button>
              <Popconfirm title="确定删除此数据集？所有相关图表将无法显示数据。" onConfirm={() => handleDelete(viewSet.id)}>
                <Button danger size="small" icon={<DeleteOutlined />}>删除</Button>
              </Popconfirm>
            </Space>
          }
        >
          <Table
            columns={viewSet.columns.map(c => ({
              title: (
                <span>
                  {c.label}
                  <Tag color={c.type === 'number' ? 'blue' : c.type === 'date' ? 'green' : 'default'}
                    style={{ marginLeft: 4, fontSize: 10 }}>
                    {c.type === 'number' ? '数值' : c.type === 'date' ? '日期' : '文本'}
                  </Tag>
                </span>
              ),
              dataIndex: c.key,
              key: c.key,
              ellipsis: true,
              width: 150,
              sorter: c.type === 'number'
                ? (a: any, b: any) => (Number(a[c.key]) || 0) - (Number(b[c.key]) || 0)
                : undefined,
              render: (val: any) => val ?? '-',
            }))}
            dataSource={viewSet.records}
            rowKey="id"
            size="small"
            scroll={{ x: 'max-content', y: 500 }}
            pagination={{ defaultPageSize: 20, showSizeChanger: true, showTotal: t => `共 ${t} 条` }}
          />
        </Card>
      )}
    </div>
  );
};
