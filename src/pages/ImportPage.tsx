/**
 * 数据导入页面
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Steps, Input, Button, Space, message, Divider, Statistic, Row, Col } from 'antd';
import { FileUploader } from '../components/DataImport/FileUploader';
import { PreviewTable } from '../components/DataImport/PreviewTable';
import { useDataStore } from '../store/dataStore';
import { useDimensionStore } from '../store/dimensionStore';
import type { ColumnInfo } from '../types';

export const ImportPage: React.FC = () => {
  const navigate = useNavigate();
  const importData = useDataStore(s => s.importData);
  const createDimensionsFromColumns = useDimensionStore(s => s.createDimensionsFromColumns);
  const dataSets = useDataStore(s => s.dataSets);

  const [step, setStep] = useState(0);
  const [parsedRecords, setParsedRecords] = useState<Record<string, any>[]>([]);
  const [parsedColumns, setParsedColumns] = useState<ColumnInfo[]>([]);
  const [fileName, setFileName] = useState('');
  const [dataSetName, setDataSetName] = useState('');

  const handleDataParsed = (records: Record<string, any>[], fName: string) => {
    setParsedRecords(records);
    setFileName(fName);
    setDataSetName(fName);

    // 推断列信息
    const keys = Object.keys(records[0] || {});
    const columns: ColumnInfo[] = keys.map(key => {
      const sampleValues = records.slice(0, 10).map(r => r[key]);
      const allNumbers = sampleValues.every(v => v !== null && v !== undefined && v !== '' && !isNaN(Number(v)));
      const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/;
      const allDates = sampleValues.some(v => datePattern.test(String(v)));
      return {
        key,
        label: key,
        type: allDates ? 'date' : allNumbers ? 'number' : 'string',
        sampleValues,
      };
    });
    setParsedColumns(columns);
    setStep(1);
  };

  const handleConfirmImport = () => {
    if (!dataSetName.trim()) {
      message.warning('请输入数据集名称');
      return;
    }

    const ds = importData(dataSetName, fileName, parsedRecords);

    // 自动创建维度
    createDimensionsFromColumns(ds.columns);

    message.success(`数据集「${dataSetName}」导入成功！已自动创建 ${ds.columns.length} 个维度`);
    setStep(2);
  };

  const handleReImport = () => {
    setStep(0);
    setParsedRecords([]);
    setParsedColumns([]);
    setFileName('');
    setDataSetName('');
  };

  const steps = [
    { title: '上传文件' },
    { title: '预览确认' },
    { title: '导入完成' },
  ];

  return (
    <div>
      <Card title="📥 导入数据" style={{ marginBottom: 16 }}>
        <Steps current={step} items={steps} style={{ marginBottom: 24 }} />

        {step === 0 && (
          <div>
            <p style={{ color: '#666', marginBottom: 16 }}>
              支持 CSV、Excel (.xlsx/.xls) 格式。第一行应为表头，系统会自动识别字段类型。
            </p>
            <FileUploader onDataParsed={handleDataParsed} />
          </div>
        )}

        {step === 1 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 4, fontWeight: 500 }}>数据集名称</label>
              <Input
                style={{ width: 300 }}
                value={dataSetName}
                onChange={e => setDataSetName(e.target.value)}
                placeholder="输入数据集名称"
              />
            </div>

            <Divider>数据预览（前20行）</Divider>
            <PreviewTable records={parsedRecords} columns={parsedColumns} maxRows={20} />

            <Divider />
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Statistic title="总行数" value={parsedRecords.length} />
              </Col>
              <Col span={6}>
                <Statistic title="列数" value={parsedColumns.length} />
              </Col>
              <Col span={6}>
                <Statistic title="数值列" value={parsedColumns.filter(c => c.type === 'number').length} />
              </Col>
              <Col span={6}>
                <Statistic title="分类/日期列" value={parsedColumns.filter(c => c.type !== 'number').length} />
              </Col>
            </Row>

            <Space>
              <Button type="primary" size="large" onClick={handleConfirmImport}>
                确认导入
              </Button>
              <Button size="large" onClick={handleReImport}>重新选择文件</Button>
            </Space>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
            <h2>导入成功！</h2>
            <p style={{ color: '#666', fontSize: 16 }}>
              数据集「{dataSetName}」已导入，共 {parsedRecords.length} 条数据，{parsedColumns.length} 个字段
            </p>
            <p style={{ color: '#999' }}>
              系统已自动为你创建了维度配置，你可以前往「维度配置」调整，或直接去「数据看板」创建图表
            </p>
            <Space style={{ marginTop: 16 }}>
              <Button type="primary" size="large" onClick={handleReImport}>
                继续导入
              </Button>
              <Button size="large" onClick={() => navigate('/')}>
                前往看板
              </Button>
            </Space>
          </div>
        )}
      </Card>

      {/* 已导入的数据集列表 */}
      {dataSets.length > 0 && (
        <Card title="📚 已导入的数据集">
          {dataSets.map(ds => (
            <Card
              key={ds.id}
              size="small"
              style={{ marginBottom: 8 }}
              type="inner"
            >
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="名称" value={ds.name} valueStyle={{ fontSize: 16 }} />
                </Col>
                <Col span={6}>
                  <Statistic title="文件名" value={ds.fileName} valueStyle={{ fontSize: 16 }} />
                </Col>
                <Col span={4}>
                  <Statistic title="数据量" value={`${ds.records.length} 条`} valueStyle={{ fontSize: 16 }} />
                </Col>
                <Col span={4}>
                  <Statistic title="字段数" value={ds.columns.length} valueStyle={{ fontSize: 16 }} />
                </Col>
                <Col span={4}>
                  <Statistic
                    title="导入时间"
                    value={new Date(ds.importDate).toLocaleDateString('zh-CN')}
                    valueStyle={{ fontSize: 16 }}
                  />
                </Col>
              </Row>
            </Card>
          ))}
        </Card>
      )}
    </div>
  );
};
