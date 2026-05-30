/**
 * 数据看板核心类型定义
 * 后续可根据业务需求扩展
 */

// ========== 基础数据类型 ==========

/** 单条原始数据记录 */
export interface DataRecord {
  id: string;
  /** 月份标识，如 "2026-05" */
  month: string;
  /** 其他动态字段 */
  [key: string]: any;
}

/** 导入的数据集 */
export interface DataSet {
  id: string;
  name: string;
  fileName: string;
  importDate: string;
  records: DataRecord[];
  columns: ColumnInfo[];
}

/** 列信息 */
export interface ColumnInfo {
  key: string;
  label: string;
  type: 'string' | 'number' | 'date';
  sampleValues: any[];
}

// ========== 维度定义 ==========

/** 维度类型 */
export type DimensionType = 'category' | 'number' | 'date';

/** 聚合方式 */
export type AggregationMethod = 'sum' | 'avg' | 'count' | 'min' | 'max' | 'distinctCount';

/** 维度定义 */
export interface Dimension {
  id: string;
  /** 对应数据中的字段名 */
  fieldKey: string;
  /** 维度显示名称 */
  label: string;
  type: DimensionType;
  /** 数值型维度的聚合方式 */
  aggregation?: AggregationMethod;
  /** 是否启用 */
  enabled: boolean;
}

// ========== 图表配置 ==========

/** 图表类型 */
export type ChartType = 'bar' | 'line' | 'pie' | 'scatter' | 'area' | 'radar' | 'table';

/** 图表配置 */
export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  /** X轴/分类维度 */
  xDimension?: string;
  /** Y轴/数值维度 */
  yDimension?: string;
  /** 分组维度（可选，用于堆叠图、分组图等） */
  groupBy?: string;
  /** 图表位置（网格布局） */
  position: {
    x: number; // 列位置 0-based
    y: number; // 行位置 0-based
    w: number; // 宽度（列数）
    h: number; // 高度（行数）
  };
  /** 颜色 */
  color?: string;
}

// ========== 筛选器 ==========

/** 筛选运算符 */
export type FilterOperator = 'equals' | 'notEquals' | 'contains' | 'notContains' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'in';

/** 筛选条件 */
export interface Filter {
  id: string;
  dimension: string; // 对应的 dimension id
  fieldKey: string;
  operator: FilterOperator;
  value: any;
  value2?: any; // between 操作符的第二个值
}

// ========== 聚合结果 ==========

/** 聚合后的数据点 */
export interface AggregatedDataPoint {
  label: string;
  value: number;
  group?: string;
  extra?: Record<string, any>;
}

// ========== Dashboard 布局 ==========

/** 仪表盘配置 */
export interface DashboardConfig {
  id: string;
  name: string;
  charts: ChartConfig[];
  globalFilters: Filter[];
  /** 当前使用的数据集 ID */
  dataSetId?: string;
  /** 时间范围 */
  monthRange?: {
    start: string;
    end: string;
  };
}
