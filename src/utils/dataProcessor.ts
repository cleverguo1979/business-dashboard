/**
 * 数据处理工具 - 聚合、筛选、转换等
 */
import type { DataRecord, AggregatedDataPoint, Filter, AggregationMethod } from '../types';

/**
 * 根据筛选条件过滤数据
 */
export function applyFilters(records: DataRecord[], filters: Filter[]): DataRecord[] {
  if (!filters || filters.length === 0) return records;

  return records.filter(record => {
    return filters.every(filter => {
      const val = record[filter.fieldKey];
      const targetVal = filter.value;

      switch (filter.operator) {
        case 'equals':
          return val === targetVal;
        case 'notEquals':
          return val !== targetVal;
        case 'contains':
          return String(val).includes(String(targetVal));
        case 'notContains':
          return !String(val).includes(String(targetVal));
        case 'gt':
          return Number(val) > Number(targetVal);
        case 'gte':
          return Number(val) >= Number(targetVal);
        case 'lt':
          return Number(val) < Number(targetVal);
        case 'lte':
          return Number(val) <= Number(targetVal);
        case 'between':
          return Number(val) >= Number(targetVal) && Number(val) <= Number(filter.value2 ?? targetVal);
        case 'in':
          return Array.isArray(targetVal) && targetVal.includes(val);
        default:
          return true;
      }
    });
  });
}

/**
 * 按月筛选数据
 */
export function filterByMonthRange(records: DataRecord[], start?: string, end?: string): DataRecord[] {
  if (!start && !end) return records;
  return records.filter(r => {
    if (start && r.month < start) return false;
    if (end && r.month > end) return false;
    return true;
  });
}

/**
 * 按指定字段聚合数据
 */
export function aggregateData(
  records: DataRecord[],
  groupField: string,
  valueField: string,
  method: AggregationMethod = 'sum'
): AggregatedDataPoint[] {
  const groups = new Map<string, number[]>();

  // 分组收集值
  for (const r of records) {
    const key = String(r[groupField] ?? '未分类');
    const val = Number(r[valueField]);
    if (isNaN(val)) continue;

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(val);
  }

  // 按聚合方法计算
  const results: AggregatedDataPoint[] = [];
  for (const [label, values] of groups) {
    let value: number;
    switch (method) {
      case 'sum':
        value = values.reduce((a, b) => a + b, 0);
        break;
      case 'avg':
        value = values.reduce((a, b) => a + b, 0) / values.length;
        break;
      case 'count':
        value = values.length;
        break;
      case 'min':
        value = Math.min(...values);
        break;
      case 'max':
        value = Math.max(...values);
        break;
      case 'distinctCount':
        value = new Set(values).size;
        break;
      default:
        value = values.reduce((a, b) => a + b, 0);
    }
    results.push({
      label,
      value: Math.round(value * 100) / 100, // 保留两位小数
    });
  }

  // 按值降序排序
  return results.sort((a, b) => b.value - a.value);
}

/**
 * 按两个字段分组聚合（支持分组柱状图、堆叠图等）
 */
export function aggregateDataWithGroup(
  records: DataRecord[],
  groupField: string,
  valueField: string,
  subGroupField: string,
  method: AggregationMethod = 'sum'
): { groups: string[]; series: { name: string; data: number[] }[] } {
  // 获取所有主分组和子分组的唯一值
  const mainGroups = [...new Set(records.map(r => String(r[groupField] ?? '未分类')))];
  const subGroups = [...new Set(records.map(r => String(r[subGroupField] ?? '未分类')))];

  const series = subGroups.map(sub => {
    const data = mainGroups.map(main => {
      const filtered = records.filter(
        r => String(r[groupField] ?? '未分类') === main && String(r[subGroupField] ?? '未分类') === sub
      );
      const values = filtered.map(r => Number(r[valueField])).filter(v => !isNaN(v));

      if (values.length === 0) return 0;
      switch (method) {
        case 'sum': return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
        case 'avg': return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
        case 'count': return values.length;
        case 'min': return Math.round(Math.min(...values) * 100) / 100;
        case 'max': return Math.round(Math.max(...values) * 100) / 100;
        default: return Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100;
      }
    });
    return { name: sub, data };
  });

  return { groups: mainGroups, series };
}

/**
 * 计算字段的统计信息
 */
export function calcFieldStats(records: DataRecord[], fieldKey: string) {
  const values = records.map(r => Number(r[fieldKey])).filter(v => !isNaN(v));
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);

  return {
    count: values.length,
    sum: Math.round(sum * 100) / 100,
    avg: Math.round((sum / values.length) * 100) / 100,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted[Math.floor(sorted.length / 2)],
  };
}

/**
 * 推断列的数值类型
 */
export function inferColumnType(values: any[]): 'string' | 'number' | 'date' {
  const sample = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 20);
  if (sample.length === 0) return 'string';

  // 检查是否为日期
  const datePattern = /^\d{4}[-/]\d{1,2}[-/]\d{1,2}/;
  if (sample.some(v => datePattern.test(String(v)))) return 'date';

  // 检查是否为数字
  if (sample.every(v => !isNaN(Number(v)) && String(v).trim() !== '')) return 'number';

  return 'string';
}
