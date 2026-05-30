/**
 * 图表渲染器 - 根据配置自动选择合适的图表
 */
import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { Empty } from 'antd';
import type { ChartConfig } from '../../types';
import { useDataStore } from '../../store/dataStore';
import { useFilterStore } from '../../store/filterStore';
import { applyFilters, filterByMonthRange, aggregateData } from '../../utils/dataProcessor';
import {
  buildBarChartOption,
  buildLineChartOption,
  buildPieChartOption,
  buildScatterChartOption,
  buildAreaChartOption,
} from '../../utils/chartHelper';

interface ChartRendererProps {
  config: ChartConfig;
  height?: number;
}

export const ChartRenderer: React.FC<ChartRendererProps> = ({ config, height = 350 }) => {
  const dataSets = useDataStore(s => s.dataSets);
  const currentDataSetId = useDataStore(s => s.currentDataSetId);
  const currentDataSet = useMemo(
    () => dataSets.find(ds => ds.id === currentDataSetId),
    [dataSets, currentDataSetId],
  );

  const globalFilters = useFilterStore(s => s.globalFilters);
  const monthRange = useFilterStore(s => s.monthRange);

  const option = useMemo((): EChartsOption | null => {
    if (!currentDataSet) return null;

    let records = applyFilters(currentDataSet.records, globalFilters);
    records = filterByMonthRange(records, monthRange?.start, monthRange?.end);

    if (records.length === 0) return null;

    switch (config.type) {
      case 'bar': {
        if (!config.xDimension || !config.yDimension) return null;
        const data = aggregateData(records, config.xDimension, config.yDimension);
        return buildBarChartOption(data, config);
      }
      case 'line': {
        if (!config.xDimension || !config.yDimension) return null;
        const data = aggregateData(records, config.xDimension, config.yDimension);
        return buildLineChartOption(data, config);
      }
      case 'area': {
        if (!config.xDimension || !config.yDimension) return null;
        const data = aggregateData(records, config.xDimension, config.yDimension);
        return buildAreaChartOption(data, config);
      }
      case 'pie': {
        if (!config.xDimension || !config.yDimension) return null;
        const data = aggregateData(records, config.xDimension, config.yDimension);
        return buildPieChartOption(data, config);
      }
      case 'scatter': {
        if (!config.xDimension || !config.yDimension) return null;
        const data = records.map(r => ({
          x: Number(r[config.xDimension!]),
          y: Number(r[config.yDimension!]),
          label: String(r[config.xDimension!] || ''),
        })).filter(d => !isNaN(d.x) && !isNaN(d.y));
        return buildScatterChartOption(data, config);
      }
      case 'radar': {
        if (!config.xDimension || !config.yDimension) return null;
        const agg = aggregateData(records, config.xDimension, config.yDimension);
        return {
          title: { text: config.title, left: 'center', textStyle: { fontSize: 14 } },
          radar: {
            indicator: agg.map(d => ({ name: d.label, max: Math.max(...agg.map(a => a.value)) * 1.2 })),
          },
          series: [{
            type: 'radar',
            data: [{ value: agg.map(d => d.value), name: config.title }],
          }],
        };
      }
      default:
        return null;
    }
  }, [currentDataSet, config, globalFilters, monthRange]);

  if (!currentDataSet) {
    return <Empty description="请先导入数据" />;
  }

  if (!option) {
    return <Empty description="请配置图表维度和数据" />;
  }

  return (
    <ReactECharts
      option={option}
      style={{ height, width: '100%' }}
      notMerge={true}
      lazyUpdate={true}
    />
  );
};
