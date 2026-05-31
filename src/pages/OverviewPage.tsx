/**
 * 总分析看板 - 跨月度横向对比，X轴固定1-12月
 */
import React, { useMemo } from 'react';
import { Card, Tag, Space, Empty } from 'antd';
import { BarChartOutlined, ClockCircleOutlined, AlertOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useDataStore } from '../store/dataStore';

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
const MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const COLORS = ['#1677ff','#52c41a','#fa8c16','#f5222d','#722ed1','#13c2c2','#eb2f96','#faad14','#2f54eb','#a0d911',
  '#f759ab','#fa541c','#9254de','#597ef7','#37c6d7','#73d13d','#ff7a45','#b37feb','#5ad8a6','#ffadd2'];

/** 从数据集名称提取月份，如 "2026-04" → 4, "工作效率统计报表" → null */
function extractMonth(name: string): number | null {
  const m = name.match(/(\d{4})[-/](\d{1,2})/);
  if (m) return parseInt(m[2], 10);
  const m2 = name.match(/(\d{1,2})月/);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

/** 月份数据槽位 */
interface MonthSlot {
  total: number;
  acceptAvg: number;
  docAvg: number;
  crossDate: number;
  after17: number;
  entrustCounts: Map<string, number>;
  hasData: boolean;
  label: string;
}

function emptySlot(): MonthSlot {
  return { total: 0, acceptAvg: 0, docAvg: 0, crossDate: 0, after17: 0, entrustCounts: new Map(), hasData: false, label: '' };
}

export const OverviewPage: React.FC = () => {
  const dataSets = useDataStore(s => s.dataSets);

  // 将所有数据集映射到1-12月
  const monthSlots = useMemo((): MonthSlot[] => {
    const slots: MonthSlot[] = Array.from({ length: 12 }, () => emptySlot());

    for (const ds of dataSets) {
      const month = extractMonth(ds.name);
      if (month === null || month < 1 || month > 12) continue;
      const slot = slots[month - 1];
      const records = ds.records;
      const entrustCounts = new Map<string, number>();
      const acceptDurs: number[] = [];
      const docDurs: number[] = [];
      let crossDate = 0, after17 = 0;

      for (const r of records) {
        const entrust = r['委托企业'] || '(空)';
        entrustCounts.set(entrust, (entrustCounts.get(entrust) || 0) + 1);
        const ot = parseTime(r['业务下单时间']);
        const at = parseTime(r['接单时间']);
        const rt = parseTime(r['首次提交复核时间']);
        if (ot) { if (ot.getHours() >= 17) after17++; }
        if (ot && at) { const d = (at.getTime() - ot.getTime()) / 1000; if (d >= 0) acceptDurs.push(d); }
        if (ot && rt) {
          const d = (rt.getTime() - ot.getTime()) / 1000; if (d >= 0) docDurs.push(d);
          if (ot.toDateString() !== rt.toDateString()) crossDate++;
        }
      }

      slot.total = records.length;
      slot.acceptAvg = acceptDurs.length > 0 ? acceptDurs.reduce((a, b) => a + b, 0) / acceptDurs.length : 0;
      slot.docAvg = docDurs.length > 0 ? docDurs.reduce((a, b) => a + b, 0) / docDurs.length : 0;
      slot.crossDate = crossDate;
      slot.after17 = after17;
      slot.entrustCounts = entrustCounts;
      slot.hasData = true;
      slot.label = ds.name;
    }
    return slots;
  }, [dataSets]);

  const hasData = monthSlots.some(s => s.hasData);

  // 所有委托企业
  const allEntrusts = useMemo(() => {
    const set = new Set<string>();
    monthSlots.forEach(s => s.entrustCounts.forEach((_, k) => set.add(k)));
    return [...set].sort();
  }, [monthSlots]);

  // ===== 图1：业务量月度折线图 =====
  const volumeChartOption = useMemo((): EChartsOption => ({
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 10 } },
    grid: { left: 50, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'category', data: MONTHS },
    yAxis: { type: 'value', name: '业务量(单)' },
    series: [{
      name: '业务总量', type: 'line',
      data: monthSlots.map(s => s.hasData ? s.total : null),
      smooth: true, symbol: 'circle', symbolSize: 8,
      itemStyle: { color: COLORS[3] },
      label: { show: true, fontSize: 11 },
    }],
  }), [monthSlots]);

  // ===== 图2：委托企业业务量变化 =====
  const entrustVolumeOption = useMemo((): EChartsOption => ({
    color: COLORS,
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', bottom: 0, textStyle: { fontSize: 10 } },
    grid: { left: 50, right: 20, top: 20, bottom: 50 },
    xAxis: { type: 'category', data: MONTHS },
    yAxis: { type: 'value', name: '业务量(单)' },
    series: allEntrusts.map(name => ({
      name, type: 'line',
      data: monthSlots.map(s => s.hasData ? (s.entrustCounts.get(name) || 0) : null),
      smooth: true, symbol: 'none',
    })),
    dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 30 }],
  }), [monthSlots, allEntrusts]);

  // ===== 图3：平均接单耗时 =====
  const acceptChartOption = useMemo((): EChartsOption => ({
    color: [COLORS[0]],
    tooltip: { trigger: 'axis', formatter: (p: any) => { const d = Array.isArray(p) ? p[0] : p; return `${d.name}<br/>${fmtSec(d.value)}`; } },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: MONTHS },
    yAxis: { type: 'value', name: '耗时', axisLabel: { formatter: (v: number) => fmtSec(v) } },
    series: [{
      name: '平均接单耗时', type: 'line',
      data: monthSlots.map(s => s.hasData ? s.acceptAvg : null),
      smooth: true, symbol: 'circle', symbolSize: 8,
      label: { show: true, formatter: (p: any) => fmtSec(p.value), fontSize: 11 },
      markLine: { silent: true, data: [{ type: 'average', name: '年均值', label: { formatter: (p: any) => fmtSec(p.value) } }], lineStyle: { color: '#ff4d4f', type: 'dashed' } },
    }],
  }), [monthSlots]);

  // ===== 图4：平均制单时长 =====
  const docChartOption = useMemo((): EChartsOption => ({
    color: [COLORS[2]],
    tooltip: { trigger: 'axis', formatter: (p: any) => { const d = Array.isArray(p) ? p[0] : p; return `${d.name}<br/>${fmtSec(d.value)}`; } },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: MONTHS },
    yAxis: { type: 'value', name: '耗时', axisLabel: { formatter: (v: number) => fmtSec(v) } },
    series: [{
      name: '平均制单时长', type: 'line',
      data: monthSlots.map(s => s.hasData ? s.docAvg : null),
      smooth: true, symbol: 'diamond', symbolSize: 8,
      label: { show: true, formatter: (p: any) => fmtSec(p.value), fontSize: 11 },
      markLine: { silent: true, data: [{ type: 'average', name: '年均值', label: { formatter: (p: any) => fmtSec(p.value) } }], lineStyle: { color: '#ff4d4f', type: 'dashed' } },
    }],
  }), [monthSlots]);

  // ===== 图5：跨日制单 =====
  const crossChartOption = useMemo((): EChartsOption => ({
    color: [COLORS[2]],
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: MONTHS },
    yAxis: { type: 'value', name: '订单数' },
    series: [{
      name: '跨日制单', type: 'bar',
      data: monthSlots.map(s => s.hasData ? s.crossDate : null),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', fontSize: 11 },
    }],
  }), [monthSlots]);

  // ===== 图6：17:00后下单 =====
  const after17ChartOption = useMemo((): EChartsOption => ({
    color: [COLORS[3]],
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: 'category', data: MONTHS },
    yAxis: { type: 'value', name: '订单数' },
    series: [{
      name: '17:00后下单', type: 'bar',
      data: monthSlots.map(s => s.hasData ? s.after17 : null),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', fontSize: 11 },
    }],
  }), [monthSlots]);

  if (!hasData) {
    return <Empty style={{ marginTop: 100 }} description="请先导入数据（数据集名称需包含月份，如 2026-04 或 4月）" />;
  }

  return (
    <div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Space><span style={{ fontWeight: 600, fontSize: 15 }}>总分析 - 1~12月横向对比</span><Tag color="blue">{dataSets.length} 个月份数据</Tag></Space>
      </Card>

      {/* 1. 业务量 */}
      <Card title={<Space><BarChartOutlined />月度业务总量</Space>} size="small" style={{ marginBottom: 12 }}>
        <ReactECharts option={volumeChartOption} style={{ height: 300 }} />
      </Card>

      {/* 2. 委托企业业务量 */}
      <Card title={<Space><BarChartOutlined />委托企业月度业务量变化</Space>} size="small" style={{ marginBottom: 12 }}
        extra={<Tag>滚轮缩放 / 拖拽查看</Tag>}>
        <ReactECharts option={entrustVolumeOption} style={{ height: 400 }} />
      </Card>

      {/* 3. 平均接单耗时 */}
      <Card title={<Space><ClockCircleOutlined />平均接单耗时</Space>} size="small" style={{ marginBottom: 12 }}>
        <ReactECharts option={acceptChartOption} style={{ height: 300 }} />
      </Card>

      {/* 4. 平均制单时长 */}
      <Card title={<Space><ClockCircleOutlined />平均制单时长</Space>} size="small" style={{ marginBottom: 12 }}>
        <ReactECharts option={docChartOption} style={{ height: 300 }} />
      </Card>

      {/* 5. 跨日制单 */}
      <Card title={<Space><AlertOutlined style={{ color: '#fa8c16' }} />跨日制单</Space>} size="small" style={{ marginBottom: 12 }}>
        <ReactECharts option={crossChartOption} style={{ height: 300 }} />
      </Card>

      {/* 6. 17:00后下单 */}
      <Card title={<Space><AlertOutlined style={{ color: '#f5222d' }} />17:00后下单</Space>} size="small">
        <ReactECharts option={after17ChartOption} style={{ height: 300 }} />
      </Card>
    </div>
  );
};
