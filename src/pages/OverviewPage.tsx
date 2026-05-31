/**
 * 总分析看板 - 跨月度横向对比，X轴固定1-12月
 */
import React, { useMemo, useState } from 'react';
import { Card, Tag, Space, Empty, Select } from 'antd';
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

const ALL_MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const COLORS = ['#1677ff','#52c41a','#fa8c16','#f5222d','#722ed1','#13c2c2'];

function extractMonth(name: string): number | null {
  const m = name.match(/(\d{4})[-/](\d{1,2})/);
  if (m) return parseInt(m[2], 10);
  const m2 = name.match(/(\d{1,2})月/);
  if (m2) return parseInt(m2[1], 10);
  return null;
}

interface MonthSlot {
  total: number;
  acceptAll: number;
  acceptClean: number;
  docAll: number;
  docClean: number;
  crossDate: number;
  after17: number;
  entrustCounts: Map<string, number>;
  hasData: boolean;
}

function emptySlot(): MonthSlot {
  return { total: 0, acceptAll: 0, acceptClean: 0, docAll: 0, docClean: 0, crossDate: 0, after17: 0, entrustCounts: new Map(), hasData: false };
}

export const OverviewPage: React.FC = () => {
  const dataSets = useDataStore(s => s.dataSets);
  const [selectedEntrust, setSelectedEntrust] = useState<string>('');

  const monthSlots = useMemo((): MonthSlot[] => {
    const slots: MonthSlot[] = Array.from({ length: 12 }, () => emptySlot());
    for (const ds of dataSets) {
      const month = extractMonth(ds.name);
      if (month === null || month < 1 || month > 12) continue;
      const slot = slots[month - 1];
      const records = ds.records;
      const entrustCounts = new Map<string, number>();
      const acceptAll: number[] = [], acceptClean: number[] = [];
      const docAll: number[] = [], docClean: number[] = [];
      let crossDate = 0, after17 = 0;

      for (const r of records) {
        const entrust = r['委托企业'] || '(空)';
        entrustCounts.set(entrust, (entrustCounts.get(entrust) || 0) + 1);
        const ot = parseTime(r['业务下单时间']);
        const at = parseTime(r['接单时间']);
        const rt = parseTime(r['首次提交复核时间']);
        const isCross = ot && rt ? ot.toDateString() !== rt.toDateString() : false;
        if (ot) { if (ot.getHours() >= 17) after17++; }
        if (ot && at) {
          const d = (at.getTime() - ot.getTime()) / 1000;
          if (d >= 0) { acceptAll.push(d); if (!isCross) acceptClean.push(d); }
        }
        if (ot && rt) {
          const d = (rt.getTime() - ot.getTime()) / 1000;
          if (d >= 0) { docAll.push(d); if (!isCross) docClean.push(d); }
          if (isCross) crossDate++;
        }
      }
      slot.total = records.length;
      slot.acceptAll = acceptAll.length > 0 ? acceptAll.reduce((a, b) => a + b, 0) / acceptAll.length : 0;
      slot.acceptClean = acceptClean.length > 0 ? acceptClean.reduce((a, b) => a + b, 0) / acceptClean.length : 0;
      slot.docAll = docAll.length > 0 ? docAll.reduce((a, b) => a + b, 0) / docAll.length : 0;
      slot.docClean = docClean.length > 0 ? docClean.reduce((a, b) => a + b, 0) / docClean.length : 0;
      slot.crossDate = crossDate;
      slot.after17 = after17;
      slot.entrustCounts = entrustCounts;
      slot.hasData = true;
    }
    return slots;
  }, [dataSets]);

  const hasData = monthSlots.some(s => s.hasData);

  // 所有委托企业列表
  const allEntrusts = useMemo(() => {
    const set = new Set<string>();
    monthSlots.forEach(s => s.entrustCounts.forEach((_, k) => set.add(k)));
    return [...set].sort();
  }, [monthSlots]);

  // 选中企业的月度业务量
  const selectedEntrustData = useMemo(() => {
    if (!selectedEntrust) return [];
    return monthSlots.map(s => s.hasData ? (s.entrustCounts.get(selectedEntrust) || 0) : null);
  }, [monthSlots, selectedEntrust]);

  // ===== 图1：业务总量 =====
  const volumeChart = useMemo((): EChartsOption => ({
    color: [COLORS[0]],
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: ALL_MONTHS },
    yAxis: { type: 'value', name: '单量' },
    series: [{
      name: '业务总量', type: 'line',
      data: monthSlots.map(s => s.hasData ? s.total : null),
      smooth: true, symbol: 'circle', symbolSize: 8,
      label: { show: true, fontSize: 11 },
    }],
  }), [monthSlots]);

  // ===== 图2：选中委托企业业务量 =====
  const entrustChart = useMemo((): EChartsOption => ({
    color: [COLORS[1]],
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: ALL_MONTHS },
    yAxis: { type: 'value', name: '单量' },
    series: [{
      name: selectedEntrust || '请选择企业', type: 'line',
      data: selectedEntrustData,
      smooth: true, symbol: 'circle', symbolSize: 10,
      label: { show: true, fontSize: 12, fontWeight: 'bold' },
    }],
  }), [selectedEntrustData, selectedEntrust]);

  // ===== 图3：平均接单耗时（全量 + 剔除） =====
  const acceptChart = useMemo((): EChartsOption => ({
    color: [COLORS[0], COLORS[1]],
    tooltip: { trigger: 'axis', formatter: (p: any) => {
      const arr = Array.isArray(p) ? p : [p];
      return arr.map((d: any) => `${d.seriesName}: ${fmtSec(d.value)}`).join('<br/>');
    }},
    legend: { bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 50 },
    xAxis: { type: "category", data: ALL_MONTHS },
    yAxis: { type: 'value', name: '耗时', axisLabel: { formatter: (v: number) => fmtSec(v) } },
    series: [
      { name: '全量数据', type: 'line', data: monthSlots.map(s => s.hasData ? s.acceptAll : null), smooth: true, symbol: 'circle', symbolSize: 7, label: { show: true, formatter: (p: any) => fmtSec(p.value), fontSize: 10 } },
      { name: '剔除异常', type: 'line', data: monthSlots.map(s => s.hasData ? s.acceptClean : null), smooth: true, symbol: 'diamond', symbolSize: 7, label: { show: true, formatter: (p: any) => fmtSec(p.value), fontSize: 10 } },
    ],
  }), [monthSlots]);

  // ===== 图4：平均制单时长（全量 + 剔除） =====
  const docChart = useMemo((): EChartsOption => ({
    color: [COLORS[2], COLORS[1]],
    tooltip: { trigger: 'axis', formatter: (p: any) => {
      const arr = Array.isArray(p) ? p : [p];
      return arr.map((d: any) => `${d.seriesName}: ${fmtSec(d.value)}`).join('<br/>');
    }},
    legend: { bottom: 0 },
    grid: { left: 50, right: 20, top: 20, bottom: 50 },
    xAxis: { type: "category", data: ALL_MONTHS },
    yAxis: { type: 'value', name: '耗时', axisLabel: { formatter: (v: number) => fmtSec(v) } },
    series: [
      { name: '全量数据', type: 'line', data: monthSlots.map(s => s.hasData ? s.docAll : null), smooth: true, symbol: 'circle', symbolSize: 7, label: { show: true, formatter: (p: any) => fmtSec(p.value), fontSize: 10 } },
      { name: '剔除异常', type: 'line', data: monthSlots.map(s => s.hasData ? s.docClean : null), smooth: true, symbol: 'diamond', symbolSize: 7, label: { show: true, formatter: (p: any) => fmtSec(p.value), fontSize: 10 } },
    ],
  }), [monthSlots]);

  // ===== 图5：跨日制单 =====
  const crossChart = useMemo((): EChartsOption => ({
    color: [COLORS[3]],
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: ALL_MONTHS },
    yAxis: { type: 'value', name: '单量' },
    series: [{
      name: '跨日制单', type: 'bar',
      data: monthSlots.map(s => s.hasData ? s.crossDate : null),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', fontSize: 11 },
    }],
  }), [monthSlots]);

  // ===== 图6：17:00后 =====
  const after17Chart = useMemo((): EChartsOption => ({
    color: [COLORS[4]],
    tooltip: { trigger: 'axis' },
    grid: { left: 50, right: 20, top: 20, bottom: 40 },
    xAxis: { type: "category", data: ALL_MONTHS },
    yAxis: { type: 'value', name: '单量' },
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

      <Card title={<Space><BarChartOutlined />月度业务总量</Space>} size="small" style={{ marginBottom: 12 }}>
        <ReactECharts option={volumeChart} style={{ height: 280 }} />
      </Card>

      <Card title={<Space><BarChartOutlined />委托企业月度业务量</Space>} size="small" style={{ marginBottom: 12 }}
        extra={
          <Select size="small" style={{ width: 240 }} value={selectedEntrust || undefined}
            placeholder="选择一家委托企业" showSearch optionFilterProp="label"
            onChange={v => setSelectedEntrust(v)}
            options={allEntrusts.map(e => ({ label: e, value: e }))} />
        }>
        {selectedEntrust
          ? <ReactECharts option={entrustChart} style={{ height: 280 }} />
          : <Empty description="请在上方选择一家委托企业" style={{ padding: 40 }} />
        }
      </Card>

      <Card title={<Space><ClockCircleOutlined />平均接单耗时</Space>} size="small" style={{ marginBottom: 12 }}>
        <ReactECharts option={acceptChart} style={{ height: 300 }} />
      </Card>

      <Card title={<Space><ClockCircleOutlined />平均制单时长</Space>} size="small" style={{ marginBottom: 12 }}>
        <ReactECharts option={docChart} style={{ height: 300 }} />
      </Card>

      <Card title={<Space><AlertOutlined style={{ color: '#fa8c16' }} />跨日制单</Space>} size="small" style={{ marginBottom: 12 }}>
        <ReactECharts option={crossChart} style={{ height: 280 }} />
      </Card>

      <Card title={<Space><AlertOutlined style={{ color: '#f5222d' }} />17:00后下单</Space>} size="small">
        <ReactECharts option={after17Chart} style={{ height: 280 }} />
      </Card>
    </div>
  );
};
