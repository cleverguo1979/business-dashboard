/**
 * 数据预览表格组件
 */
import React from 'react';
import { Table, Tag } from 'antd';
import type { ColumnInfo } from '../../types';

interface PreviewTableProps {
  records: Record<string, any>[];
  columns: ColumnInfo[];
  maxRows?: number;
}

export const PreviewTable: React.FC<PreviewTableProps> = ({ records, columns, maxRows = 20 }) => {
  const tableColumns = columns.map(col => ({
    title: (
      <span>
        {col.label}
        <Tag color={col.type === 'number' ? 'blue' : col.type === 'date' ? 'green' : 'default'}
          style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px' }}>
          {col.type === 'number' ? '数值' : col.type === 'date' ? '日期' : '文本'}
        </Tag>
      </span>
    ),
    dataIndex: col.key,
    key: col.key,
    ellipsis: true,
    width: 150,
    render: (val: any) => {
      if (val === null || val === undefined || val === '') return <span style={{ color: '#ccc' }}>-</span>;
      return String(val);
    },
  }));

  return (
    <Table
      columns={tableColumns}
      dataSource={records.slice(0, maxRows)}
      rowKey={(_, idx) => String(idx)}
      size="small"
      scroll={{ x: 'max-content', y: 400 }}
      pagination={false}
      bordered
    />
  );
};
