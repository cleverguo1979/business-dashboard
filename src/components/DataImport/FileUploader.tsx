/**
 * 文件上传组件 - 支持 CSV 和 Excel
 */
import React, { useState } from 'react';
import { Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import * as XLSX from 'xlsx';

const { Dragger } = Upload;

interface FileUploaderProps {
  onDataParsed: (records: Record<string, any>[], fileName: string) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onDataParsed }) => {
  const [loading, setLoading] = useState(false);

  const parseFile = (file: File): boolean => {
    setLoading(true);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const fileName = file.name.replace(/\.[^/.]+$/, '');
        let records: Record<string, any>[] = [];

        if (file.name.endsWith('.csv')) {
          // 解析 CSV
          const text = data as string;
          const lines = text.split('\n').filter(line => line.trim());
          if (lines.length < 2) {
            message.warning('CSV 文件至少需要包含表头和一行数据');
            setLoading(false);
            return;
          }

          const headers = parseCSVLine(lines[0]);
          for (let i = 1; i < lines.length; i++) {
            const values = parseCSVLine(lines[i]);
            const record: Record<string, any> = {};
            headers.forEach((h, idx) => {
              record[h] = values[idx]?.trim() ?? '';
            });
            records.push(record);
          }
        } else {
          // 解析 Excel
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          records = XLSX.utils.sheet_to_json(sheet);
        }

        if (records.length === 0) {
          message.warning('未解析到任何数据');
          setLoading(false);
          return;
        }

        // 自动检测并转换数值字段
        records = records.map(r => {
          const converted: Record<string, any> = {};
          for (const [key, val] of Object.entries(r)) {
            const numVal = Number(val);
            converted[key] = !isNaN(numVal) && String(val).trim() !== '' ? numVal : val;
          }
          return converted;
        });

        message.success(`成功解析 ${records.length} 条数据`);
        onDataParsed(records, fileName);
      } catch (err) {
        message.error('文件解析失败: ' + (err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    if (file.name.endsWith('.csv')) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }

    return false; // 阻止自动上传
  };

  return (
    <Dragger
      accept=".csv,.xlsx,.xls"
      multiple={false}
      showUploadList={false}
      beforeUpload={parseFile}
      disabled={loading}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined />
      </p>
      <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
      <p className="ant-upload-hint">支持 CSV、Excel (.xlsx/.xls) 格式</p>
      {loading && <p style={{ color: '#1677ff' }}>正在解析文件...</p>}
    </Dragger>
  );
};

/** 解析 CSV 行（处理引号包裹的字段） */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}
