/**
 * 维度配置面板 - 管理分析维度的定义
 */
import React, { useState, useMemo } from 'react';
import {
  Card, Table, Button, Select, Input, Switch, Tag, Space, Modal, Popconfirm, message, Tooltip
} from 'antd';
import { PlusOutlined, DeleteOutlined, SyncOutlined, QuestionCircleOutlined } from '@ant-design/icons';
import { useDimensionStore } from '../../store/dimensionStore';
import { useDataStore } from '../../store/dataStore';
import type { DimensionType, AggregationMethod } from '../../types';

const DIM_TYPE_OPTIONS: { label: string; value: DimensionType }[] = [
  { label: '分类', value: 'category' },
  { label: '数值', value: 'number' },
  { label: '日期', value: 'date' },
];

const AGG_OPTIONS: { label: string; value: AggregationMethod }[] = [
  { label: '求和', value: 'sum' },
  { label: '平均值', value: 'avg' },
  { label: '计数', value: 'count' },
  { label: '最小值', value: 'min' },
  { label: '最大值', value: 'max' },
  { label: '去重计数', value: 'distinctCount' },
];

export const DimensionPanel: React.FC = () => {
  const dimensions = useDimensionStore(s => s.dimensions);
  const addDimension = useDimensionStore(s => s.addDimension);
  const updateDimension = useDimensionStore(s => s.updateDimension);
  const removeDimension = useDimensionStore(s => s.removeDimension);
  const toggleDimension = useDimensionStore(s => s.toggleDimension);
  const createDimensionsFromColumns = useDimensionStore(s => s.createDimensionsFromColumns);

  const dataSets = useDataStore(s => s.dataSets);
  const currentDataSetId = useDataStore(s => s.currentDataSetId);
  const currentDataSet = useMemo(
    () => dataSets.find(ds => ds.id === currentDataSetId),
    [dataSets, currentDataSetId],
  );

  const [addOpen, setAddOpen] = useState(false);
  const [newField, setNewField] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<DimensionType>('category');
  const [newAgg, setNewAgg] = useState<AggregationMethod>('sum');

  const handleAdd = () => {
    if (!newField || !newLabel) return;
    addDimension(newField, newLabel, newType, newType === 'number' ? newAgg : undefined);
    setNewField('');
    setNewLabel('');
    setNewType('category');
    setNewAgg('sum');
    setAddOpen(false);
    message.success('维度已添加');
  };

  const handleAutoDetect = () => {
    if (!currentDataSet) {
      message.warning('请先导入数据');
      return;
    }
    createDimensionsFromColumns(currentDataSet.columns);
    message.success(`已从「${currentDataSet.name}」自动添加维度`);
  };

  const columns = [
    {
      title: '维度名称',
      dataIndex: 'label',
      key: 'label',
      width: 180,
      render: (val: string, record: any) => (
        <Input
          size="small"
          value={val}
          onChange={e => updateDimension(record.id, { label: e.target.value })}
          style={{ border: 'none', background: 'transparent', padding: 0 }}
        />
      ),
    },
    {
      title: '字段名',
      dataIndex: 'fieldKey',
      key: 'fieldKey',
      width: 150,
      render: (val: string) => <Tag>{val}</Tag>,
    },
    {
      title: (
        <span>
          类型
          <Tooltip title="分类：如产品名、地区；数值：如金额、数量；日期：时间维度">
            <QuestionCircleOutlined style={{ marginLeft: 4, color: '#999', fontSize: 11 }} />
          </Tooltip>
        </span>
      ),
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (val: DimensionType, record: any) => (
        <Select
          size="small"
          value={val}
          style={{ width: 90 }}
          onChange={v => updateDimension(record.id, { type: v, aggregation: v === 'number' ? 'sum' : undefined })}
          options={DIM_TYPE_OPTIONS}
        />
      ),
    },
    {
      title: '聚合方式',
      dataIndex: 'aggregation',
      key: 'aggregation',
      width: 120,
      render: (val: AggregationMethod | undefined, record: any) => {
        if (record.type !== 'number') return <span style={{ color: '#ccc' }}>-</span>;
        return (
          <Select
            size="small"
            value={val || 'sum'}
            style={{ width: 100 }}
            onChange={v => updateDimension(record.id, { aggregation: v })}
            options={AGG_OPTIONS}
          />
        );
      },
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      width: 70,
      render: (val: boolean, record: any) => (
        <Switch size="small" checked={val} onChange={() => toggleDimension(record.id)} />
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: any, record: any) => (
        <Popconfirm title="确定删除此维度？" onConfirm={() => {
          removeDimension(record.id);
          message.success('维度已删除');
        }}>
          <Button size="small" danger type="text" icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <Card
        title="分析维度配置"
        extra={
          <Space>
            <Button icon={<SyncOutlined />} onClick={handleAutoDetect} disabled={!currentDataSet}>
              自动检测
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
              添加维度
            </Button>
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        <Table
          columns={columns}
          dataSource={dimensions}
          rowKey="id"
          size="small"
          pagination={false}
          locale={{ emptyText: currentDataSet ? '暂无维度，点击「自动检测」或「添加维度」' : '请先导入数据' }}
        />
      </Card>

      {/* 提示卡片 */}
      <Card title="💡 使用提示" size="small">
        <ul style={{ margin: 0, paddingLeft: 20, color: '#666', lineHeight: 2 }}>
          <li><strong>自动检测</strong>：根据导入的数据自动识别字段并创建维度</li>
          <li><strong>分类维度</strong>：用于图表的 X 轴、饼图的分组等，如产品名称、地区</li>
          <li><strong>数值维度</strong>：用于图表的 Y 轴、指标值，可选择不同的聚合方式（求和、平均等）</li>
          <li><strong>日期维度</strong>：用于时间序列分析，如按月展示趋势</li>
          <li><strong>启用/禁用</strong>：禁用不需要的维度可以让图表配置界面更简洁</li>
          <li>配置完维度后，去<strong>数据看板</strong>页面添加图表，选择维度即可生成可视化</li>
        </ul>
      </Card>

      {/* 添加维度弹窗 */}
      <Modal
        title="添加维度"
        open={addOpen}
        onOk={handleAdd}
        onCancel={() => setAddOpen(false)}
        okText="添加"
        cancelText="取消"
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>字段名（对应数据中的列名）</label>
            <Input
              placeholder="例如: product_name, amount"
              value={newField}
              onChange={e => setNewField(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>显示名称</label>
            <Input
              placeholder="例如: 产品名称, 销售额"
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4 }}>维度类型</label>
            <Select
              style={{ width: '100%' }}
              value={newType}
              onChange={setNewType}
              options={DIM_TYPE_OPTIONS}
            />
          </div>
          {newType === 'number' && (
            <div>
              <label style={{ display: 'block', marginBottom: 4 }}>默认聚合方式</label>
              <Select
                style={{ width: '100%' }}
                value={newAgg}
                onChange={setNewAgg}
                options={AGG_OPTIONS}
              />
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
};
