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
  const dataSets = useDataStore(s => s.dataSets);
  const currentDataSetId = useDataStore(s => s.currentDataSetId);
  const setCurrentDataSet = useDataStore(s => s.setCurrentDataSet);
  const importData = useDataStore(s => s.importData);
  const createDimensionsFromColumns = useDimensionStore(s => s.createDimensionsFromColumns);
  const currentDataSet = useMemo(() => dataSets.find(ds => ds.id === currentDataSetId), [dataSets, currentDataSetId]);
  const { pre, computing, compute } = usePreprocessStore();
  const allRecords = currentDataSet?.records || [];

  useEffect(() => { if (allRecords.length > 0) { usePreprocessStore.getState().reset(); compute(allRecords); } }, [allRecords]);

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
      // 列出 public 下所有 CSV 文件
      const base = import.meta.env.BASE_URL;
      // 从 index.html 中无法直接列出目录，改为加载已知月份
      const months = ['01','02','03','04','05','06','07','08','09','10','11','12'];
      const year = '2026';
      let loadedCount = 0;

      for (const m of months) {
        const fileName = `数据${year}-${m}.csv`;
        try {
          const resp = await fetch(base + fileName);
          if (!resp.ok) continue;
          const text = await resp.text();
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length < 2) continue;
          const headers = parseCSVLine(lines[0]);
          const records: Record<string, any>[] = [];
          for (let i = 1; i < lines.length; i++) {
            const vals = parseCSVLine(lines[i]);
            const row: Record<string, any> = {};
            headers.forEach((h, idx) => { row[h] = vals[idx]?.trim() ?? ''; });
            records.push(row);
          }
          importData(`${year}-${m}`, fileName, records);
          loadedCount++;
        } catch { /* 该月份无文件 */ }
      }

      if (loadedCount > 0) {
        createDimensionsFromColumns([
          { key: '业务下单时间', label: '业务下单时间', type: 'string' as const },
          { key: '接单时间', label: '接单时间', type: 'string' as const },
          { key: '首次提交复核时间', label: '首次提交复核时间', type: 'string' as const },
        ]);
      }
    } catch { } finally { setLoading(false); }
  }, [importData, createDimensionsFromColumns]);

  useEffect(() => { if (pre && pre.availableDates.length && !selectedDate) setSelectedDate(pre.availableDates[pre.availableDates.length - 1]); }, [pre, selectedDate]);
  useEffect(() => { if (pre && pre.after17AvailableDates.length && !after17Date) setAfter17Date(pre.after17AvailableDates[pre.after17AvailableDates.length - 1]); }, [pre, after17Date]);

  const ex = false;
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
      return { name, total, anomalyTotal, expTotal, expDoc, expAvgStr: expDoc > 0 ? fmtSec(expAvg) : '-', impTotal, impDoc, impAvgStr: impDoc > 0 ? fmtSec(impAvg) : '-', expAfter17, expAfter17Pct: expTotal > 0 ? pct(expAfter17, expTotal) : '0', expCross, expCrossPct: expTotal > 0 ? pct(expCross, expTotal) : '0', impAfter17, impAfter17Pct: impTotal > 0 ? pct(impAfter17, impTotal) : '0', impCross, impCrossPct: impTotal > 0 ? pct(impCross, impTotal) : '0' };
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

  const pieOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: 'item', formatter: '{b}: {c} 单 ({d}%)' },
    legend: { bottom: 0, textStyle: { fontSize: 12 } },
    series: [{
      type: 'pie', radius: ['40%', '70%'], center: ['50%', '43%'],
      data: [
        { value: pre?.expTotal || 0, name: `出口  ${pre?.expTotal || 0} 单`, itemStyle: { color: '#1677ff' } },
        { value: pre?.impTotal || 0, name: `进口  ${pre?.impTotal || 0} 单`, itemStyle: { color: '#52c41a' } },
      ],
      label: { formatter: '{d}%', fontSize: 14, fontWeight: 'bold' },
    }],
  }), [pre]);

  const entrustUniqueRank = useMemo(() => pre?.entrustUniqueBizRank?.slice(0, 20) || [], [pre]);

  if (!currentDataSet) {
    return <div style={{ textAlign: 'center', marginTop: 100 }}><Empty description="暂无数据" image={Empty.PRESENTED_IMAGE_SIMPLE} /><Spin spinning={loading}><Button type="primary" size="large" icon={<ReloadOutlined />} onClick={handleLoad} loading={loading}>一键加载报表</Button></Spin></div>;
  }
  if (!pre || computing) return <div style={{ textAlign: 'center', marginTop: 150 }}><Spin size="large" /><p style={{ color: '#999', marginTop: 16 }}>分析 {allRecords.length} 条数据...</p></div>;

  const CARD_H = 96;

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Row justify="space-between" align="middle">
          <Col><Space><span style={{ fontWeight: 600, fontSize: 15 }}>业务数据看板</span><Select size="small" style={{ width: 260 }} value={currentDataSetId} onChange={v => setCurrentDataSet(v)} options={dataSets.map(ds => ({ label: `${ds.name} (${ds.records.length}条)`, value: ds.id }))} /></Space></Col>
          <Col><span style={{ fontSize: 13, color: '#666' }}>{pre.dateRange.start} ~ {pre.dateRange.end}</span></Col>
        </Row>
      </Card>

      <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
        <Col xs={12} sm={8} md={6} lg={3} xl={3}><Card size="small" style={{ height: CARD_H }}><Statistic title={<span><BarChartOutlined /> 报关单总数</span>} value={total} suffix="单" valueStyle={{ color: '#1677ff', fontWeight: 700, fontSize: 20 }} /></Card></Col>
        <Col xs={12} sm={8} md={6} lg={3} xl={3}><Card size="small" style={{ height: CARD_H }}><Statistic title="日期范围" value={`${pre.dateRange.start} ~ ${pre.dateRange.end}`} valueStyle={{ fontSize: 12 }} /></Card></Col>
        <Col xs={12} sm={8} md={6} lg={3} xl={3}>
          <Card size="small" style={{ height: CARD_H }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
              <ClockCircleOutlined /> 平均接单耗时 <Tooltip title="「全量」全部数据平均值；「剔除异常」排除跨日制单等异常数据后的平均值"><span style={{ fontSize: 10, color: '#bbb', cursor: 'help' }}>ⓘ</span></Tooltip>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 10, color: '#999' }}>全量</div>
                <div style={{ color: acceptAll < 120 ? '#52c41a' : '#fa8c16', fontWeight: 700, fontSize: 20 }}>{fmtSec(acceptAll)}</div>
              </div>
              <div style={{ color: '#52c41a', fontSize: 16, padding: '0 4px' }}>→</div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 10, color: '#999' }}>剔除异常</div>
                <div style={{ color: '#52c41a', fontWeight: 700, fontSize: 20 }}>{fmtSec(acceptClean)}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3} xl={3}>
          <Card size="small" style={{ height: CARD_H }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
              <FileTextOutlined /> 平均制单时长 <Tooltip title="「全量」全部数据平均值；「剔除异常」排除跨日制单等异常数据后的平均值"><span style={{ fontSize: 10, color: '#bbb', cursor: 'help' }}>ⓘ</span></Tooltip>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 10, color: '#999' }}>全量</div>
                <div style={{ color: docAll < 600 ? '#52c41a' : '#fa8c16', fontWeight: 700, fontSize: 20 }}>{fmtSec(docAll)}</div>
              </div>
              <div style={{ color: '#52c41a', fontSize: 16, padding: '0 4px' }}>→</div>
              <div style={{ textAlign: 'center', flex: 1 }}>
                <div style={{ fontSize: 10, color: '#999' }}>剔除异常</div>
                <div style={{ color: '#52c41a', fontWeight: 700, fontSize: 20 }}>{fmtSec(docClean)}</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={12} sm={8} md={6} lg={3} xl={3}><Card size="small" style={{ height: CARD_H }}><Statistic title={<span><ThunderboltOutlined /> 高峰 {peakInfo.hour}</span>} value={`${peakInfo.count} 单 (${pct(peakInfo.count, total)}%)`} valueStyle={{ color: '#f5222d', fontWeight: 700, fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={8} md={6} lg={3} xl={3}><Card size="small" style={{ height: CARD_H, background: '#fff7e6' }}><Statistic title={<span><AlertOutlined style={{ color: '#fa8c16' }} /> 跨日制单</span>} value={`${pre.crossDateCount} 单 (${pct(pre.crossDateCount, total)}%)`} valueStyle={{ color: '#fa8c16', fontWeight: 600, fontSize: 18 }} /></Card></Col>
        <Col xs={12} sm={8} md={6} lg={3} xl={3}><Card size="small" style={{ height: CARD_H, background: '#fff1f0' }}><Statistic title={<span><WarningOutlined style={{ color: '#f5222d' }} /> 17:00后</span>} value={`${pre.after17Count} 单 (${pct(pre.after17Count, total)}%)`} valueStyle={{ color: '#f5222d', fontWeight: 600, fontSize: 18 }} /></Card></Col>
      </Row>

      {/* 饼图 + 委托企业去重排行 + 问询 */}
      <Row gutter={[14, 14]} style={{ marginBottom: 12 }}>
        <Col xs={24} lg={8}>
          <Card title="报关单进出口分布" size="small" style={{ height: 380 }}>
            <ReactECharts option={pieOption} style={{ height: 340 }} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<Space><TrophyOutlined style={{ color: '#fa8c16' }} />委托企业 单月委托量 TOP20</Space>} size="small" extra={<Tag color="blue">去重业务号</Tag>} style={{ height: 380 }}>
            <Table dataSource={entrustUniqueRank} rowKey="name" size="small" pagination={{ pageSize: 10, size: 'small' }}
              columns={[{ title: '#', width: 35, render: (_: any, __: any, i: number) => <Tag color={i < 3 ? 'gold' : 'default'}>{i + 1}</Tag> }, { title: '企业', dataIndex: 'name', ellipsis: true }, { title: '业务号数', dataIndex: 'count', width: 75, sorter: (a: any, b: any) => a.count - b.count, defaultSortOrder: 'descend', render: (v: number) => <b>{v}</b> }]} />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title={<Space><MessageOutlined style={{ color: '#722ed1' }} />委托企业 问询次数 TOP20</Space>} size="small" style={{ height: 380 }}>
            <Table dataSource={inquiryRank.slice(0, 20)} rowKey="name" size="small" pagination={{ pageSize: 10, size: 'small' }}
              columns={[{ title: '#', width: 35, render: (_: any, __: any, i: number) => <Tag color={i < 3 ? 'purple' : 'default'}>{i + 1}</Tag> }, { title: '企业', dataIndex: 'name', ellipsis: true }, { title: '问询次数', dataIndex: 'count', width: 80, sorter: (a: any, b: any) => a.count - b.count, defaultSortOrder: 'descend', render: (v: number) => <Tag color="purple">{v} 次</Tag> }]} />
          </Card>
        </Col>
      </Row>

      {/* 境内收发货人 + 异常排行 */}
      <Row gutter={[14, 14]} style={{ marginBottom: 12 }}>
        <Col xs={24} lg={12}>
          <Card title={<Space><TrophyOutlined style={{ color: '#fa8c16' }} />境内收发货人 业务量 TOP20</Space>} size="small">
            <Table dataSource={shipperRank.slice(0, 20)} rowKey="name" size="small" pagination={{ pageSize: 10, size: 'small' }}
              columns={[{ title: '#', width: 40, render: (_: any, __: any, i: number) => <Tag color={i < 3 ? 'gold' : 'default'}>{i + 1}</Tag> }, { title: '企业', dataIndex: 'name', ellipsis: true }, { title: '单量', dataIndex: 'count', sorter: (a: any, b: any) => a.count - b.count, defaultSortOrder: 'descend', render: (v: number) => <b>{v}</b> }]} />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Space><AlertOutlined style={{ color: '#f5222d' }} />境内收发货人 异常+17点后 TOP30</Space>} size="small">
            <Table dataSource={anomalyTop30.slice(0, 20)} rowKey="name" size="small" pagination={{ pageSize: 10, size: 'small' }} scroll={{ x: 500 }}
              columns={[
                { title: '#', width: 35, render: (_: any, __: any, i: number) => <Tag color={i < 3 ? 'red' : 'default'}>{i + 1}</Tag> },
                { title: '企业', dataIndex: 'name', ellipsis: true, width: 120 },
                { title: '总量', dataIndex: 'total', width: 55, render: (v: number) => <b>{v}</b> },
                { title: '异常', dataIndex: 'anomalyTotal', width: 55, sorter: (a: any, b: any) => a.anomalyTotal - b.anomalyTotal, defaultSortOrder: 'descend', render: (v: number) => <Tag color="red">{v}</Tag> },
                { title: '出口17点后', dataIndex: 'expAfter17', width: 80, render: (v: number, r: any) => <span style={{ fontSize: 11 }}>{v}<span style={{ color: '#f5222d' }}>({r.expAfter17Pct}%)</span></span> },
                { title: '出口跨日', dataIndex: 'expCross', width: 75, render: (v: number, r: any) => <span style={{ fontSize: 11 }}>{v}<span style={{ color: '#fa8c16' }}>({r.expCrossPct}%)</span></span> },
              ]}
            />
          </Card>
        </Col>
      </Row>

      {/* 维度一 */}
      <Card title={<Space>业务下单时间分布<Tag color="blue">{activeHourly.reduce((s, d) => s + d.count, 0)} 单</Tag></Space>}
        extra={<Space><Radio.Group value={viewMode} onChange={e => setViewMode(e.target.value)} optionType="button" buttonStyle="solid" size="small"><Radio.Button value="all">全部</Radio.Button><Radio.Button value="daily">按日</Radio.Button></Radio.Group>{viewMode === 'daily' && <Select size="small" style={{ width: 130 }} value={selectedDate} onChange={setSelectedDate} options={pre.availableDates.map(d => ({ label: d, value: d }))} />}</Space>}
        style={{ marginBottom: 12 }}>
        <ReactECharts option={hourlyChart} style={{ height: 260 }} />
      </Card>

      {/* 维度二+三 */}
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

      {/* 17:00后 + 高并发 */}
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
