/**
 * ECharts 配置生成工具
 */
import type { EChartsOption } from 'echarts';
import type { AggregatedDataPoint, ChartConfig } from '../types';

/** 默认配色方案 */
const COLORS = [
  '#1677ff', '#52c41a', '#fa8c16', '#eb2f96',
  '#722ed1', '#13c2c2', '#f5222d', '#faad14',
  '#2f54eb', '#a0d911', '#f759ab', '#fa541c',
];

/**
 * 生成柱状图配置
 */
export function buildBarChartOption(
  data: AggregatedDataPoint[],
  config: ChartConfig
): EChartsOption {
  return {
    color: COLORS,
    title: { text: config.title, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '10%', right: '10%', bottom: '15%', top: '15%' },
    xAxis: {
      type: 'category',
      data: data.map(d => d.label),
      axisLabel: { rotate: data.length > 6 ? 45 : 0, fontSize: 11 },
    },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: data.map(d => d.value),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      label: { show: true, position: 'top', fontSize: 11 },
    }],
  };
}

/**
 * 生成折线图配置
 */
export function buildLineChartOption(
  data: AggregatedDataPoint[],
  config: ChartConfig
): EChartsOption {
  return {
    color: COLORS,
    title: { text: config.title, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '10%', right: '10%', bottom: '15%', top: '15%' },
    xAxis: {
      type: 'category',
      data: data.map(d => d.label),
      boundaryGap: false,
      axisLabel: { rotate: data.length > 6 ? 45 : 0, fontSize: 11 },
    },
    yAxis: { type: 'value' },
    series: [{
      type: 'line',
      data: data.map(d => d.value),
      smooth: true,
      areaStyle: { opacity: 0.15 },
      label: { show: true, position: 'top', fontSize: 11 },
    }],
  };
}

/**
 * 生成饼图配置
 */
export function buildPieChartOption(
  data: AggregatedDataPoint[],
  config: ChartConfig
): EChartsOption {
  return {
    color: COLORS,
    title: { text: config.title, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { bottom: 0, type: 'scroll' },
    series: [{
      type: 'pie',
      radius: ['35%', '65%'],
      center: ['50%', '45%'],
      data: data.map(d => ({ name: d.label, value: d.value })),
      label: { formatter: '{b}\n{d}%', fontSize: 11 },
      emphasis: {
        itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' },
      },
    }],
  };
}

/**
 * 生成散点图配置
 */
export function buildScatterChartOption(
  data: { x: number; y: number; label?: string }[],
  config: ChartConfig
): EChartsOption {
  return {
    color: COLORS,
    title: { text: config.title, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: {
      trigger: 'item',
      formatter: (params: any) => `${params.data[0]}, ${params.data[1]}<br/>${params.name || ''}`,
    },
    grid: { left: '10%', right: '10%', bottom: '15%', top: '15%' },
    xAxis: { type: 'value' },
    yAxis: { type: 'value' },
    series: [{
      type: 'scatter',
      data: data.map(d => [d.x, d.y]),
      symbolSize: 8,
    }],
  };
}

/**
 * 生成面积图配置
 */
export function buildAreaChartOption(
  data: AggregatedDataPoint[],
  config: ChartConfig
): EChartsOption {
  return {
    color: COLORS,
    title: { text: config.title, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '10%', right: '10%', bottom: '15%', top: '15%' },
    xAxis: {
      type: 'category',
      data: data.map(d => d.label),
      boundaryGap: false,
      axisLabel: { rotate: data.length > 6 ? 45 : 0, fontSize: 11 },
    },
    yAxis: { type: 'value' },
    series: [{
      type: 'line',
      data: data.map(d => d.value),
      smooth: true,
      areaStyle: {},
      lineStyle: { width: 2 },
    }],
  };
}

/**
 * 生成分组/堆叠柱状图配置
 */
export function buildGroupedBarChartOption(
  groups: string[],
  series: { name: string; data: number[] }[],
  config: ChartConfig,
  stacked: boolean = false
): EChartsOption {
  return {
    color: COLORS,
    title: { text: config.title, left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    legend: { bottom: 0, type: 'scroll' },
    grid: { left: '10%', right: '10%', bottom: '15%', top: '15%' },
    xAxis: {
      type: 'category',
      data: groups,
      axisLabel: { rotate: groups.length > 6 ? 45 : 0, fontSize: 11 },
    },
    yAxis: { type: 'value' },
    series: series.map((s) => ({
      name: s.name,
      type: 'bar' as const,
      data: s.data,
      stack: stacked ? 'total' : undefined,
      itemStyle: { borderRadius: stacked ? 0 : [4, 4, 0, 0] },
    })),
  };
}
