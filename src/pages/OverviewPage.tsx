/**
 * 总分析看板 - 跨月度横向对比
 */
import React, { useMemo } from 'react';
import { Card, Tag, Space, Empty, Table } from 'antd';
import { BarChartOutlined, ClockCircleOutlined, AlertOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useDataStore } from '../store/dataStore';

// 调色板
const CP = ['#1677ff','#52c41a','#fa8c16','#f5222d','#722ed1','#13c2c2','#eb2f96','#faad14','#2f54eb','#a0d911',
  '#f759ab','#fa541c','#9254de','#597ef7','#37c6d7','#73d13d','#ff7a45','#b37feb','#5ad8a6','#ffadd2'];

function parseTime(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s.replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}
function fmtSec(s: number): string {
  if (s < 60) return `${Math.round(s)}秒`;
  if (s < 3600) return `${(s / 60).toFixed(1)}分`;
  return `${(s / 3600).toFixed(1)}时`;
}

interface MonthMetric {
  label: string;       // e.g. "2026-05"
  total: number;
  acceptAvg: number;
  docAvg: number;
  crossDate: number;
  after17: number;
  entrustCounts: Map<string, number>;  // 委托企业 → 业务量
  fromDate: string;
  toDate: string;
}

export const OverviewPage: React.FC = () => {
  const dataSets = useDataStore(s => s.dataSets);

  // 计算每个数据集的指标
  const monthMetrics = useMemo((): MonthMetric[] => {
    return dataSets.map(ds => {
      const records = ds.records;
      const entrustCounts = new Map<string, number>();
      const acceptDurs: number[] = [];
      const docDurs: number[] = [];
      let crossDate = 0, after17 = 0;
      let minD = '', maxD = '';

      for (const r of records) {
        const entrust = r['委托企业'] || '(空)';
        entrustCounts.set(entrust, (entrustCounts.get(entrust) || 0) + 1);

        const ot = parseTime(r['业务下单时间']);
        const at = parseTime(r['接单时间']);
        const rt = parseTime(r['首次提交复核时间']);

        if (ot) {
          if (!minD || ot.toISOString() < minD) minD = ot.toISOString();
          if (!maxD || ot.toISOString() > maxD) maxD = ot.toISOString();
          if (ot.getHours() >= 17) after17++;
        }
        if (ot && at) { const d = (at.getTime() - ot.getTime()) / 1000; if (d >= 0) acceptDurs.push(d); }
        if (ot && rt) {
          const d = (rt.getTime() - ot.getTime()) / 1000; if (d >= 0) docDurs.push(d);
          if (ot.toDateString() !== rt.toDateString()) crossDate++;
        }
      }

      const label = ds.name || ds.fileName;
      return {
        label,
        total: records.length,
        acceptAvg: acceptDurs.length > 0 ? acceptDurs.reduce((a, b) => a + b, 0) / acceptDurs.length : 0,
        docAvg: docDurs.length > 0 ? docDurs.reduce((a, b) => a + b, 0) / docDurs.length : 0,
        crossDate,
        after17,
        entrustCounts,
        fromDate: minD ? minD.split('T')[0] : '',
        toDate: maxD ? maxD.split('T')[0] : '',
      };
    });
  }, [dataSets]);

  // 所有委托企业列表
  const allEntrusts = useMemo(() => {
    const set = new Set<string>();
    monthMetrics.forEach(m => m.entrustCounts.forEach((_, k) => set.add(k)));
    return [...set].sort();
  }, [monthMetrics]);

  // ===== 图1：所有委托企业月度业务量折线图 =====
  const businessVolumeOption = useMemo((): EChartsOption => {
    if (monthMetrics.length === 0) return {};
    const labels = monthMetrics.map(m => m.label);
    // 过滤掉全部为0的企业，减少噪点
    const entities = allEntrusts.filter(name => {
      return monthMetrics.some(m => (m.entrustCounts.get(name) || 0) > 0);
    });
    return {
      color: CP,
      tooltip: { trigger: 'axis' },
      legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 10 }, pageTextStyle: { fontSize: 11 } },
      grid: { left: 60, right: 30, top: 20, bottom: 60 },
      xAxis: { type: 'category', data: labels, axisLabel: { rotate: 30, fontSize: 11 } },
      yAxis: { type: 'value', name: '业务量(单)' },
      series: entities.slice(0, 50).map(name => ({
        name, type: 'line', data: monthMetrics.map(m => m.entrustCounts.get(name) || 0),
        smooth: true, symbol: 'circle', symbolSize: 4,
      })),
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 30 }],
    };
  }, [monthMetrics, allEntrusts]);

  // ===== 图2：平均接单耗时 + 平均制单时长 月度折线图 =====
  const timeComparisonOption = useMemo((): EChartsOption => ({
    color: [CP[0], CP[3]],
    tooltip: { trigger: 'axis', formatter: (p: any) => {
      const a = Array.isArray(p) ? p : [p];
      return a.map((d: any) => `${d.seriesName}: ${fmtSec(d.value)}`).join('<br/>');
    }},
    legend: { bottom: 0 },
    grid: { left: 60, right: 30, top: 20, bottom: 60 },
    xAxis: { type: 'category', data: monthMetrics.map(m => m.label), axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: { type: 'value', name: '耗时', axisLabel: { formatter: (v: number) => fmtSec(v) } },
    series: [
      { name: '平均接单耗时', type: 'line', data: monthMetrics.map(m => m.acceptAvg), smooth: true, symbol: 'circle', symbolSize: 6, label: { show: true, formatter: (p: any) => fmtSec(p.value), fontSize: 10 } },
      { name: '平均制单时长', type: 'line', data: monthMetrics.map(m => m.docAvg), smooth: true, symbol: 'diamond', symbolSize: 6, label: { show: true, formatter: (p: any) => fmtSec(p.value), fontSize: 10 } },
    ],
  }), [monthMetrics]);

  // ===== 图3：跨日制单 + 17点后 月度对比 =====
  const anomalyComparisonOption = useMemo((): EChartsOption => ({
    color: [CP[2], CP[3]],
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0 },
    grid: { left: 60, right: 30, top: 20, bottom: 60 },
    xAxis: { type: 'category', data: monthMetrics.map(m => m.label), axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: { type: 'value', name: '订单数' },
    series: [
      { name: '跨日制单', type: 'bar', data: monthMetrics.map(m => m.crossDate), itemStyle: { borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', fontSize: 10 } },
      { name: '17:00后下单', type: 'bar', data: monthMetrics.map(m => m.after17), itemStyle: { borderRadius: [4, 4, 0, 0] }, label: { show: true, position: 'top', fontSize: 10 } },
    ],
  }), [monthMetrics]);

  // ===== 汇总表 =====
  const summaryRows = useMemo(() => monthMetrics.map((m, i) => ({
    key: i, ...m,
    acceptAvgStr: fmtSec(m.acceptAvg),
    docAvgStr: fmtSec(m.docAvg),
  })), [monthMetrics]);

  if (dataSets.length === 0) {
    return <Empty style={{ marginTop: 100 }} description="请先导入多月数据" />;
  }

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space><span style={{ fontWeight: 600, fontSize: 15 }}>总分析 - 跨月度横向对比</span><Tag color="blue">{dataSets.length} 个月份</Tag></Space>
      </Card>

      {/* 汇总明细表 */}
      <Card title="各月份关键指标明细" size="small" style={{ marginBottom: 12 }}>
        <Table dataSource={summaryRows} rowKey="key" size="small" pagination={false}
          columns={[
            { title: '月份', dataIndex: 'label', width: 140 },
            { title: '日期', render: (_: any, r: any) => <span style={{ fontSize: 11 }}>{r.fromDate}~{r.toDate}</span> },
            { title: '总单量', dataIndex: 'total', width: 80, render: (v: number) => <b>{v}</b> },
            { title: '接单耗时', dataIndex: 'acceptAvgStr', width: 90 },
            { title: '制单时长', dataIndex: 'docAvgStr', width: 90 },
            { title: '跨日', dataIndex: 'crossDate', width: 60, render: (v: number) => <Tag color="orange">{v}</Tag> },
            { title: '17点后', dataIndex: 'after17', width: 70, render: (v: number) => <Tag color="red">{v}</Tag> },
          ]}
        />
      </Card>

      {/* 委托企业月度业务量 */}
      <Card title={<Space><BarChartOutlined />委托企业月度业务量变化</Space>} size="small" style={{ marginBottom: 12 }}
        extra={<Tag>TOP 50 企业（可滚轮缩放）</Tag>}>
        <ReactECharts option={businessVolumeOption} style={{ height: 400 }} />
      </Card>

      {/* 接单+制单时长对比 */}
      <Card title={<Space><ClockCircleOutlined />平均接单耗时 & 制单时长</Space>} size="small" style={{ marginBottom: 12 }}>
        <ReactECharts option={timeComparisonOption} style={{ height: 320 }} />
      </Card>

      {/* 异常对比 */}
      <Card title={<Space><AlertOutlined style={{ color: '#fa8c16' }} />跨日制单 & 17:00后下单 月度对比</Space>} size="small">
        <ReactECharts option={anomalyComparisonOption} style={{ height: 320 }} />
      </Card>
    </div>
  );
};
