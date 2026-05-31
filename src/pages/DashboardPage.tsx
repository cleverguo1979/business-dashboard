/**
 * 业务数据看板
 */
import React, { useMemo, useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Select, Tag, Space, Empty, Button, Spin, Radio, Tooltip } from 'antd';
import {
  ClockCircleOutlined, ThunderboltOutlined, BarChartOutlined,
  WarningOutlined, ReloadOutlined, FileTextOutlined, AlertOutlined,
  TrophyOutlined, MessageOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useDataStore } from '../store/dataStore';
import { useDimensionStore } from '../store/dimensionStore';
import { usePreprocessStore } from '../store/preprocessStore';
import {
  preprocessedToHourly, preprocessedToDailyHourly,
  preprocessedToTimeRanges, preprocessedToConcurrency,
  ACCEPTANCE_RANGES, DOCPREP_RANGES,
} from '../utils/orderAnalyzer';

const C = ['#1677ff', '#52c41a', '#fa8c16', '#eb2f96', '#722ed1', '#13c2c2', '#f5222d'];

function parseCSVLine(l: string): string[] {
  const r: string[] = []; let c = '', q = false;
  for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') q = !q; else if (ch === ',' && !q) { r.push(c); c = ''; } else c += ch; }
  r.push(c); return r;
}
function fmtSec(s: number): string {
  if (s < 60) return `${Math.round(s)}秒`;
  if (s < 3600) return `${(s / 60).toFixed(1)}分`;
  return `${(s / 3600).toFixed(1)}时`;
}
function pct(v: number, t: number): string { return t > 0 ? (v / t * 100).toFixed(1) : '0'; }
function buildHourlyChart(data: { hour: string; count: number }[], color?: string): EChartsOption {
  const max = Math.max(...data.map(d => d.count), 1);
  return {
    color: [color || C[0]], tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: any) => { const d = Array.isArray(p) ? p[0] : p; return `<b>${d.name}:00</b><br/>${d.value} 单`; } },
    grid: { left: 50, right: 20, top: 20, bottom: 40 }, xAxis: { type: 'category', data: data.map(d => `${d.hour}:00`), axisLabel: { rotate: 45, fontSize: 10 } }, yAxis: { type: 'value', name: '订单数' },
    series: [{ type: 'bar', data: data.map(d => d.count), itemStyle: { borderRadius: [4, 4, 0, 0], color: (p: any) => p.value === max ? '#f5222d' : p.value > max * 0.7 ? '#fa8c16' : (color || C[0]) }, markLine: { silent: true, data: [{ type: 'average', name: '均值', label: { formatter: '均值: {c}' } }], lineStyle: { color: '#ff4d4f', type: 'dashed' } } }],
  };
}
function buildTimeBar(data: { range: string; count: number }[], color: string, total: number): EChartsOption {
  return {
    color: [color], tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: (p: any) => { const d = Array.isArray(p) ? p[0] : p; return `<b>${d.name}</b><br/>${d.value} 单 (${pct(d.value, total)}%)`; } },
    grid: { left: 50, right: 20, top: 20, bottom: 40 }, xAxis: { type: 'category', data: data.map(d => d.range), axisLabel: { rotate: 30, fontSize: 11 } }, yAxis: { type: 'value', name: '订单数' },
    series: [{ type: 'bar', data: data.map(d => d.count), itemStyle: { borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', fontSize: 10 } }],
  };
}

export const DashboardPage: React.FC = () => {
  // ====== 所有 hooks 必须在任何 return 之前 ======
  const dataSets = useDataStore(s => s.dataSets);
  const currentDataSetId = useDataStore(s => s.currentDataSetId);
  const setCurrentDataSet = useDataStore(s => s.setCurrentDataSet);
  const importData = useDataStore(s => s.importData);
  const createDimensionsFromColumns = useDimensionStore(s => s.createDimensionsFromColumns);
  const currentDataSet = useMemo(() => dataSets.find(ds => ds.id === currentDataSetId), [dataSets, currentDataSetId]);
  const { pre, computing, compute } = usePreprocessStore();
  const allRecords = currentDataSet?.records || [];

  useEffect(() => { if (allRecords.length > 0 && !pre && !computing) compute(allRecords); }, [allRecords, pre, computing, compute]);

  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'daily'>('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [after17Mode, setAfter17Mode] = useState<'all' | 'daily'>('all');
  const [after17Date, setAfter17Date] = useState('');
  const [th, setTh] = useState(5);
  const [wm, setWm] = useState(5);

  const handleLoad = React.useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch('/工作效率统计报表.csv');
      const text = await resp.text();
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;
      const headers = parseCSVLine(lines[0]);
      const records: Record<string, any>[] = [];
      for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const row: Record<string, any> = {};
        headers.forEach((h, idx) => { row[h] = vals[idx]?.trim() ?? ''; });
        records.push(row);
      }
      importData('工作效率统计报表', '工作效率统计报表.xls', records);
      createDimensionsFromColumns(headers.map(h => ({ key: h, label: h, type: 'string' as const })));
    } catch { } finally { setLoading(false); }
  }, [importData, createDimensionsFromColumns]);

  useEffect(() => { if (pre && pre.availableDates.length && !selectedDate) setSelectedDate(pre.availableDates[pre.availableDates.length - 1]); }, [pre, selectedDate]);
  useEffect(() => { if (pre && pre.after17AvailableDates.length && !after17Date) setAfter17Date(pre.after17AvailableDates[pre.after17AvailableDates.length - 1]); }, [pre, after17Date]);

  // 所有 useMemo 都在这里（pre 可能为 null，需要兜底）
  const ex = false; // 汇总卡片已显示剔除异常值，此处固定显示全部数据
  const total = pre?.total || 0;
  const acceptAll = useMemo(() => pre && pre.acceptDurations.length > 0 ? pre.acceptDurations.reduce((a, b) => a + b, 0) / pre.acceptDurations.length : 0, [pre]);
  const acceptClean = useMemo(() => pre && pre.acceptDurationsClean.length > 0 ? pre.acceptDurationsClean.reduce((a, b) => a + b, 0) / pre.acceptDurationsClean.length : 0, [pre]);
  const docAll = useMemo(() => pre && pre.docDurations.length > 0 ? pre.docDurations.reduce((a, b) => a + b, 0) / pre.docDurations.length : 0, [pre]);
  const docClean = useMemo(() => pre && pre.docDurationsClean.length > 0 ? pre.docDurationsClean.reduce((a, b) => a + b, 0) / pre.docDurationsClean.length : 0, [pre]);

  const peakInfo = useMemo(() => {
    let pkH = 0, pkC = 0;
    if (pre) for (let h = 0; h < 24; h++) { const c = pre.hourCounts.get(String(h).padStart(2, '0')) || 0; if (c > pkC) { pkC = c; pkH = h; } }
    return { hour: `${String(pkH).padStart(2, '0')}:00`, count: pkC };
  }, [pre]);

  const shipperRank = useMemo(() => pre ? [...pre.shipperCounts.entries()].map(([n, c]) => ({ name: n, count: c })).sort((a, b) => b.count - a.count).slice(0, 25) : [], [pre]);
  const inquiryRank = useMemo(() => pre ? [...pre.entrustInquiryCounts.entries()].filter(([, c]) => c > 0).map(([n, c]) => ({ name: n, count: c })).sort((a, b) => b.count - a.count).slice(0, 25) : [], [pre]);

  // 异常+17点后 最多 TOP30（按进出口拆分呈现）
  const anomalyTop30 = useMemo(() => {
    if (!pre) return [];
    return [...pre.shipperCounts.entries()].map(([name, total]) => {
      const m = pre.shipperImpExpDocPrep.get(name);
      const exp = m?.get('出口'); const imp = m?.get('进口');
      const anomMap = pre.shipperAnomalyCounts.get(name);
      const expAnom = anomMap?.get('出口'); const impAnom = anomMap?.get('进口');
      const expTotal = exp?.total || 0; const expDoc = exp?.docCount || 0;
      const impTotal = imp?.total || 0; const impDoc = imp?.docCount || 0;
      const expAfter17 = expAnom?.after17 || 0; const expCross = expAnom?.crossDate || 0;
      const impAfter17 = impAnom?.after17 || 0; const impCross = impAnom?.crossDate || 0;
      const anomalyTotal = expAfter17 + expCross + impAfter17 + impCross;
      const expAvg = exp && expDoc > 0 ? exp.docSum / expDoc : Infinity;
      const impAvg = imp && impDoc > 0 ? imp.docSum / impDoc : Infinity;
      return {
        name, total, anomalyTotal,
        expTotal, expDoc, expAvgStr: expDoc > 0 ? fmtSec(expAvg) : '-',
        impTotal, impDoc, impAvgStr: impDoc > 0 ? fmtSec(impAvg) : '-',
        expAfter17, expAfter17Pct: expTotal > 0 ? pct(expAfter17, expTotal) : '0',
        expCross, expCrossPct: expTotal > 0 ? pct(expCross, expTotal) : '0',
        impAfter17, impAfter17Pct: impTotal > 0 ? pct(impAfter17, impTotal) : '0',
        impCross, impCrossPct: impTotal > 0 ? pct(impCross, impTotal) : '0',
      };
    }).sort((a, b) => b.anomalyTotal - a.anomalyTotal).slice(0, 30);
  }, [pre]);

  const hourlyAll = useMemo(() => pre ? preprocessedToHourly(pre.hourCounts) : [], [pre]);
  const hourlyDaily = useMemo(() => pre && selectedDate ? preprocessedToDailyHourly(pre.dailyHourCounts, selectedDate) : [], [pre, selectedDate]);
  const activeAccept = ex ? (pre?.acceptDurationsClean || []) : (pre?.acceptDurations || []);
  const activeDoc = ex ? (pre?.docDurationsClean || []) : (pre?.docDurations || []);
  const dataTotal = ex ? (pre?.cleanRecords.length || 0) : total;
  const acceptData = useMemo(() => preprocessedToTimeRanges(activeAccept, ACCEPTANCE_RANGES), [activeAccept]);
  const docData = useMemo(() => preprocessedToTimeRanges(activeDoc, DOCPREP_RANGES), [activeDoc]);
  const concData = useMemo(() => pre ? preprocessedToConcurrency(pre.orderTimestamps, wm).filter(w => w.count >= th) : [], [pre, wm, th]);
  const after17All = useMemo(() => pre ? preprocessedToHourly(pre.after17HourCounts, 17, 23) : [], [pre]);
  const after17Daily = useMemo(() => pre && after17Date ? preprocessedToDailyHourly(pre.after17DailyHourCounts, after17Date, 17, 23) : [], [pre, after17Date]);

  const activeHourly = viewMode === 'daily' ? hourlyDaily : hourlyAll;
  const activeAfter17 = after17Mode === 'daily' ? after17Daily : after17All;
  const hourlyChart = useMemo(() => buildHourlyChart(activeHourly), [activeHourly]);
  const after17Chart = useMemo(() => buildHourlyChart(activeAfter17, '#f5222d'), [activeAfter17]);
  const acceptChart = useMemo(() => buildTimeBar(acceptData, C[1], dataTotal), [acceptData, dataTotal]);
  const docChart = useMemo(() => buildTimeBar(docData, C[2], dataTotal), [docData, dataTotal]);
  const peakWins = useMemo(() => concData.filter(w => w.count >= 20), [concData]);

  // ====== 所有 return 在 hooks 之后 ======
  if (!currentDataSet) {
    return <div style={{ textAlign: 'center', marginTop: 100 }}><Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /><Spin spinning={loading}><Button type="primary" size="large" icon={<ReloadOutlined />} onClick={handleLoad} loading={loading}>一键加载报表</Button></Spin></div>;
  }
  if (!pre || computing) {
    return <div style={{ textAlign: 'center', marginTop: 150 }}><Spin size="large" /><p style={{ color: '#999', marginTop: 16 }}>分析 {allRecords.length} 条数据...</p></div>;
  }

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row justify="space-between" align="middle">
          <Col><Space><span style={{ fontWeight: 600, fontSize: 15 }}>📋 业务数据看板</span><Select size="small" style={{ width: 260 }} value={currentDataSetId} onChange={v => setCurrentDataSet(v)} options={dataSets.map(ds => ({ label: `${ds.name} (${ds.records.length}条)`, value: ds.id }))} /></Space></Col>
          <Col>
            <Tooltip title="「跨日制单」指业务下单日期与首次提交复核日期不在同一天的订单，此类订单制单耗时异常偏高。汇总卡片中已标注剔除异常后的平均耗时，下方维度图表展示全部数据。">
              <span style={{ fontSize: 12, color: '#999', cursor: 'help', borderBottom: '1px dashed #999' }}>ⓘ 剔除异常说明</span>
            </Tooltip>
          </Col>
        </Row>
      </Card>

      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        {[
          { title: '标准化业务报关单总数', value: total, suffix: '单', color: '#1677ff', icon: <BarChartOutlined /> },
          { title: '日期范围', value: `${pre.dateRange.start} ~ ${pre.dateRange.end}`, color: '#333', fs: 12 },
          { title: '平均接单耗时', value: fmtSec(acceptAll), color: acceptAll < 120 ? '#52c41a' : '#fa8c16', sub: `剔除异常：${fmtSec(acceptClean)}`, icon: <ClockCircleOutlined /> },
          { title: '平均制单时长', value: fmtSec(docAll), color: docAll < 600 ? '#52c41a' : '#fa8c16', sub: `剔除异常：${fmtSec(docClean)}`, icon: <FileTextOutlined /> },
          { title: `高峰 ${peakInfo.hour}`, value: `${peakInfo.count} 单 (${pct(peakInfo.count, total)}%)`, color: '#f5222d', icon: <ThunderboltOutlined /> },
          { title: '跨日制单', value: `${pre.crossDateCount} 单 (${pct(pre.crossDateCount, total)}%)`, color: '#fa8c16', bg: '#fff7e6', icon: <AlertOutlined /> },
          { title: '17:00后下单', value: `${pre.after17Count} 单 (${pct(pre.after17Count, total)}%)`, color: '#f5222d', bg: '#fff1f0', icon: <WarningOutlined /> },
        ].map((item, i) => (
          <Col xs={12} sm={8} md={6} lg={3} xl={Math.floor(24 / 7)} key={i}>
            <Card size="small" style={{ background: (item as any).bg, height: '100%' }}>
              <Statistic
                title={<span>{(item as any).icon} {(item as any).icon ? ' ' : ''}{item.title}</span>}
                value={item.value}
                valueStyle={{ color: item.color, fontWeight: 600, fontSize: (item as any).fs || 16 }}
              />
              {(item as any).sub && <div style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{(item as any).sub}</div>}
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[14, 14]} style={{ marginBottom: 12 }}>
        <Col xs={24} lg={12}>
          <Card title={<Space><TrophyOutlined style={{ color: '#fa8c16' }} />境内收发货人 业务量 TOP20</Space>} size="small">
            <Table dataSource={shipperRank.slice(0, 20)} rowKey="name" size="small" pagination={{ pageSize: 10, size: 'small' }}
              columns={[{ title: '#', width: 40, render: (_: any, __: any, i: number) => <Tag color={i < 3 ? 'gold' : 'default'}>{i + 1}</Tag> }, { title: '企业', dataIndex: 'name', ellipsis: true }, { title: '单量', dataIndex: 'count', sorter: (a: any, b: any) => a.count - b.count, defaultSortOrder: 'descend', render: (v: number) => <b>{v}</b> }]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Space><MessageOutlined style={{ color: '#722ed1' }} />委托企业 问询次数 TOP20</Space>} size="small">
            <Table dataSource={inquiryRank.slice(0, 20)} rowKey="name" size="small" pagination={{ pageSize: 10, size: 'small' }}
              columns={[{ title: '#', width: 40, render: (_: any, __: any, i: number) => <Tag color={i < 3 ? 'purple' : 'default'}>{i + 1}</Tag> }, { title: '企业', dataIndex: 'name', ellipsis: true }, { title: '问询次数', dataIndex: 'count', sorter: (a: any, b: any) => a.count - b.count, defaultSortOrder: 'descend', render: (v: number) => <Tag color="purple">{v} 次</Tag> }]} />
          </Card>
        </Col>
      </Row>

      <Card
        title={<Space><AlertOutlined style={{ color: '#f5222d' }} />境内收发货人 异常+17点后 最多 TOP30</Space>}
        extra={<Tag color="red">按进出口拆分 | 17点后+跨日总量降序</Tag>}
        size="small" style={{ marginBottom: 12 }}
      >
        <Table dataSource={anomalyTop30} rowKey="name" size="small" pagination={{ pageSize: 15, size: 'small' }} scroll={{ x: 800 }}
          columns={[
            { title: '#', width: 35, render: (_: any, __: any, i: number) => <Tag color={i < 3 ? 'red' : 'default'}>{i + 1}</Tag> },
            { title: '企业', dataIndex: 'name', ellipsis: true, width: 160, fixed: 'left' as const },
            { title: '总量', dataIndex: 'total', width: 60, render: (v: number) => <b>{v}</b> },
            { title: '异常合计', dataIndex: 'anomalyTotal', width: 75, sorter: (a: any, b: any) => a.anomalyTotal - b.anomalyTotal, defaultSortOrder: 'descend', render: (v: number) => <Tag color="red">{v}</Tag> },
            { title: '出口量', dataIndex: 'expTotal', width: 60 },
            { title: '出口17点后', dataIndex: 'expAfter17', width: 85, render: (v: number, r: any) => <span style={{ fontSize: 11 }}>{v}<span style={{ color: '#f5222d' }}>({r.expAfter17Pct}%)</span></span> },
            { title: '出口跨日', dataIndex: 'expCross', width: 80, render: (v: number, r: any) => <span style={{ fontSize: 11 }}>{v}<span style={{ color: '#fa8c16' }}>({r.expCrossPct}%)</span></span> },
            { title: '进口量', dataIndex: 'impTotal', width: 60 },
            { title: '进口17点后', dataIndex: 'impAfter17', width: 85, render: (v: number, r: any) => <span style={{ fontSize: 11 }}>{v}<span style={{ color: '#f5222d' }}>({r.impAfter17Pct}%)</span></span> },
            { title: '进口跨日', dataIndex: 'impCross', width: 80, render: (v: number, r: any) => <span style={{ fontSize: 11 }}>{v}<span style={{ color: '#fa8c16' }}>({r.impCrossPct}%)</span></span> },
          ]}
        />
      </Card>

      <Card title={<Space>📊 业务下单时间分布<Tag color="blue">{activeHourly.reduce((s, d) => s + d.count, 0)} 单</Tag></Space>}
        extra={<Space><Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)} optionType="button" buttonStyle="solid" size="small"><Radio.Button value="all">全部</Radio.Button><Radio.Button value="daily">按日</Radio.Button></Radio.Group>{viewMode === 'daily' && <Select size="small" style={{ width: 130 }} value={selectedDate} onChange={setSelectedDate} options={pre.availableDates.map(d => ({ label: d, value: d }))} />}</Space>}
        style={{ marginBottom: 12 }}>
        <ReactECharts option={hourlyChart} style={{ height: 260 }} />
      </Card>

      <Row gutter={[14, 14]} style={{ marginBottom: 12 }}>
        <Col xs={24} lg={12}>
          <Card title={<Space><ClockCircleOutlined />接单耗时</Space>} extra={<Tag color="green">下单→接单</Tag>}>
            <ReactECharts option={acceptChart} style={{ height: 220 }} />
            <Table dataSource={acceptData} rowKey="range" size="small" pagination={false} style={{ marginTop: 8 }}
              columns={[{ title: '耗时', dataIndex: 'range' }, { title: '单数', dataIndex: 'count', render: (v: number) => <b>{v}</b> }, { title: '占比', render: (_: any, r: any) => <span style={{ fontSize: 12 }}>{pct(r.count, dataTotal)}%</span> }]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Space><FileTextOutlined />制单时长</Space>} extra={<Tag color="orange">下单→首次提交复核</Tag>}>
            <ReactECharts option={docChart} style={{ height: 220 }} />
            <Table dataSource={docData} rowKey="range" size="small" pagination={false} style={{ marginTop: 8 }}
              columns={[{ title: '耗时', dataIndex: 'range' }, { title: '单数', dataIndex: 'count', render: (v: number) => <b>{v}</b> }, { title: '占比', render: (_: any, r: any) => <span style={{ fontSize: 12 }}>{pct(r.count, dataTotal)}%</span> }]} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[14, 14]}>
        <Col xs={24} lg={12}>
          <Card title={<Space><WarningOutlined style={{ color: '#f5222d' }} />17:00后下单 {pre.after17Count}单 ({pct(pre.after17Count, total)}%)</Space>}
            extra={<Space><Radio.Group value={after17Mode} onChange={e => setAfter17Mode(e.target.value)} optionType="button" buttonStyle="solid" size="small"><Radio.Button value="all">全部</Radio.Button><Radio.Button value="daily">按日</Radio.Button></Radio.Group>{after17Mode === 'daily' && <Select size="small" style={{ width: 130 }} value={after17Date} onChange={setAfter17Date} options={pre.after17AvailableDates.map(d => ({ label: d, value: d }))} />}</Space>}
            style={{ borderLeft: '3px solid #f5222d' }}>
            <ReactECharts option={after17Chart} style={{ height: 250 }} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Space><ThunderboltOutlined style={{ color: '#f5222d' }} />高并发 ({wm}分窗口 ≥{th}单)</Space>}
            extra={<Space size="small"><Select size="small" style={{ width: 70 }} value={th} onChange={setTh} options={[3, 5, 8, 10, 15, 20, 30].map(n => ({ label: `≥${n}`, value: n }))} /><Select size="small" style={{ width: 80 }} value={wm} onChange={setWm} options={[3, 5, 10].map(n => ({ label: `${n}分`, value: n }))} /></Space>}>
            {concData.length === 0 ? <Empty description="无高并发" /> : (
              <Table dataSource={concData.slice(0, 15).map((d, i) => ({ ...d, _k: `${d.startTime}_${i}` }))} rowKey="_k" size="small" pagination={{ pageSize: 8, size: 'small' }}
                columns={[{ title: '时段', dataIndex: 'startTime', render: (v: string) => <span style={{ fontSize: 12 }}>{v.substring(5)}</span> }, { title: '单数', dataIndex: 'count', width: 60, render: (v: number) => <Tag color={v >= 20 ? 'red' : 'orange'}>{v}</Tag> }]} />
            )}
            {peakWins.length > 0 && <div style={{ marginTop: 8, padding: '6px 12px', background: '#fff2f0', borderRadius: 4, fontSize: 13, color: '#f5222d' }}><WarningOutlined /> {peakWins.length} 个时段超20单 | 峰值: {peakWins[0]?.count}单</div>}
          </Card>
        </Col>
      </Row>
    </div>
  );
};
