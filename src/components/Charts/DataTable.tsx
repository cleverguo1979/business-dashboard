/**
 * 数据表格组件 - 用于图表中的表格展示
 */
import React, { useMemo, useState } from 'react';
import { Table, Input } from 'antd';
import type { ChartConfig, DataRecord } from '../../types';
import { useDataStore } from '../../store/dataStore';
import { useFilterStore } from '../../store/filterStore';
import { applyFilters, filterByMonthRange } from '../../utils/dataProcessor';

interface DataTableProps {
  config: ChartConfig;
  height?: number;
}

export const ChartDataTable: React.FC<DataTableProps> = ({ config, height = 350 }) => {
  const dataSets = useDataStore(s => s.dataSets);
  const currentDataSetId = useDataStore(s => s.currentDataSetId);
  const currentDataSet = useMemo(
    () => dataSets.find(ds => ds.id === currentDataSetId),
    [dataSets, currentDataSetId],
  );

  const globalFilters = useFilterStore(s => s.globalFilters);
  const monthRange = useFilterStore(s => s.monthRange);
  const [searchText, setSearchText] = useState('');

  const records = useMemo((): DataRecord[] => {
    if (!currentDataSet) return [];
    let filtered = applyFilters(currentDataSet.records, globalFilters);
    filtered = filterByMonthRange(filtered, monthRange?.start, monthRange?.end);
    return filtered;
  }, [currentDataSet, globalFilters, monthRange]);

  const columns = useMemo(() => {
    if (!currentDataSet) return [];
    const cols = currentDataSet.columns.filter(c => {
      if (!config.xDimension && !config.yDimension) return true;
      return c.key === config.xDimension || c.key === config.yDimension || c.key === 'month';
    });

    return cols.map(c => ({
      title: c.label,
      dataIndex: c.key,
      key: c.key,
      ellipsis: true,
      sorter: c.type === 'number' ? (a: any, b: any) => (Number(a[c.key]) || 0) - (Number(b[c.key]) || 0) : undefined,
      render: (val: any) => val ?? '-',
    }));
  }, [currentDataSet, config]);

  const dataSource = useMemo(() => {
    let data = records;
    if (searchText) {
      data = data.filter(r =>
        Object.values(r).some(v => String(v).toLowerCase().includes(searchText.toLowerCase()))
      );
    }
    return data;
  }, [records, searchText]);

  if (!currentDataSet) return null;

  return (
    <div>
      <Input.Search
        placeholder="搜索数据..."
        allowClear
        size="small"
        style={{ marginBottom: 8, width: 250 }}
        onChange={e => setSearchText(e.target.value)}
      />
      <Table
        columns={columns}
        dataSource={dataSource}
        rowKey="id"
        size="small"
        scroll={{ y: height - 80, x: 'max-content' }}
        pagination={{ defaultPageSize: 10, showSizeChanger: true, showTotal: (t) => `共 ${t} 条` }}
      />
    </div>
  );
};
