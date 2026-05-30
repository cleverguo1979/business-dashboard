/**
 * 全局筛选栏组件
 */
import React, { useState, useMemo } from 'react';
import { Card, Select, Button, Space, Tag, Popconfirm, Input } from 'antd';
import { FilterOutlined, ClearOutlined, PlusOutlined } from '@ant-design/icons';
import { useFilterStore } from '../../store/filterStore';
import { useDataStore } from '../../store/dataStore';
import { useDimensionStore } from '../../store/dimensionStore';
import type { FilterOperator } from '../../types';

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  equals: '等于',
  notEquals: '不等于',
  contains: '包含',
  notContains: '不包含',
  gt: '大于',
  gte: '大于等于',
  lt: '小于',
  lte: '小于等于',
  between: '介于',
  in: '属于',
};

export const FilterBar: React.FC = () => {
  // 分别订阅单个属性，避免每次返回新对象
  const globalFilters = useFilterStore(s => s.globalFilters);
  const addFilter = useFilterStore(s => s.addFilter);
  const removeFilter = useFilterStore(s => s.removeFilter);
  const clearFilters = useFilterStore(s => s.clearFilters);
  const setMonthRange = useFilterStore(s => s.setMonthRange);
  const monthRange = useFilterStore(s => s.monthRange);

  // 订阅原始数组，用 useMemo 派生
  const allDimensions = useDimensionStore(s => s.dimensions);
  const dimensions = useMemo(() => allDimensions.filter(d => d.enabled), [allDimensions]);

  const dataSets = useDataStore(s => s.dataSets);
  const currentDataSetId = useDataStore(s => s.currentDataSetId);
  const currentDataSet = useMemo(
    () => dataSets.find(ds => ds.id === currentDataSetId),
    [dataSets, currentDataSetId],
  );

  const [showAdd, setShowAdd] = useState(false);
  const [newField, setNewField] = useState<string | undefined>(undefined);
  const [newOperator, setNewOperator] = useState<FilterOperator>('contains');
  const [newValue, setNewValue] = useState('');

  const handleAdd = () => {
    if (!newField || !newValue) return;
    const dim = dimensions.find(d => d.fieldKey === newField);
    addFilter(dim?.id || '', newField, newOperator, newValue);
    setNewField(undefined);
    setNewOperator('contains');
    setNewValue('');
    setShowAdd(false);
  };

  // 月份列表
  const months = useMemo(() => {
    if (!currentDataSet) return [];
    const set = new Set(currentDataSet.records.map(r => r.month).filter(Boolean));
    return [...set].sort();
  }, [currentDataSet]);

  // 缓存 Select value 数组
  const monthValue = useMemo(() => {
    if (!monthRange) return [];
    return [monthRange.start, monthRange.end];
  }, [monthRange]);

  return (
    <Card size="small" style={{ marginBottom: 16 }}>
      <Space wrap align="center" size={[8, 8]}>
        <FilterOutlined style={{ color: '#1677ff' }} />
        <span style={{ fontWeight: 500 }}>全局筛选：</span>

        <span style={{ color: '#666' }}>月份：</span>
        <Select
          mode="multiple"
          placeholder="选择月份"
          style={{ minWidth: 200 }}
          value={monthValue}
          options={months.map(m => ({ label: m, value: m }))}
          onChange={(vals: string[]) => {
            if (vals.length >= 2) {
              const sorted = [...vals].sort();
              setMonthRange({ start: sorted[0], end: sorted[sorted.length - 1] });
            } else if (vals.length === 1) {
              setMonthRange({ start: vals[0], end: vals[0] });
            } else {
              setMonthRange(null);
            }
          }}
        />

        {globalFilters.map(f => (
          <Tag
            key={f.id}
            closable
            onClose={() => removeFilter(f.id)}
            color="blue"
            style={{ padding: '2px 8px', fontSize: 13 }}
          >
            {f.fieldKey} {OPERATOR_LABELS[f.operator]} "{String(f.value)}"
          </Tag>
        ))}

        {showAdd ? (
          <Space size={4}>
            <Select
              size="small"
              style={{ width: 120 }}
              placeholder="字段"
              value={newField}
              onChange={setNewField}
              options={dimensions.map(d => ({ label: d.label, value: d.fieldKey }))}
            />
            <Select
              size="small"
              style={{ width: 100 }}
              value={newOperator}
              onChange={setNewOperator}
              options={Object.entries(OPERATOR_LABELS).map(([k, v]) => ({ label: v, value: k }))}
            />
            <Input
              size="small"
              style={{ width: 120 }}
              placeholder="值"
              value={newValue}
              onChange={e => setNewValue(e.target.value)}
              onPressEnter={handleAdd}
            />
            <Button size="small" type="primary" onClick={handleAdd}>确定</Button>
            <Button size="small" onClick={() => setShowAdd(false)}>取消</Button>
          </Space>
        ) : (
          <Button size="small" icon={<PlusOutlined />} onClick={() => setShowAdd(true)}>
            添加条件
          </Button>
        )}

        {globalFilters.length > 0 && (
          <Popconfirm title="清除所有筛选条件？" onConfirm={clearFilters}>
            <Button size="small" danger icon={<ClearOutlined />}>清除全部</Button>
          </Popconfirm>
        )}
      </Space>
    </Card>
  );
};
