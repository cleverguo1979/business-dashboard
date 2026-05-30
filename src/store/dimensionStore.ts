/**
 * 维度配置 Store - 管理分析维度
 */
import { create } from 'zustand';
import type { Dimension, DimensionType, AggregationMethod } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface DimensionState {
  /** 所有维度定义 */
  dimensions: Dimension[];

  // Actions
  /** 添加维度 */
  addDimension: (fieldKey: string, label: string, type: DimensionType, aggregation?: AggregationMethod) => Dimension;
  /** 更新维度 */
  updateDimension: (id: string, updates: Partial<Dimension>) => void;
  /** 删除维度 */
  removeDimension: (id: string) => void;
  /** 切换启用状态 */
  toggleDimension: (id: string) => void;
  /** 批量从列信息创建维度 */
  createDimensionsFromColumns: (columns: { key: string; label: string; type: 'string' | 'number' | 'date' }[]) => void;
}

export const useDimensionStore = create<DimensionState>((set, get) => ({
  dimensions: [],

  addDimension: (fieldKey, label, type, aggregation) => {
    const dim: Dimension = {
      id: uuidv4(),
      fieldKey,
      label,
      type,
      aggregation: type === 'number' ? aggregation || 'sum' : undefined,
      enabled: true,
    };
    set(state => ({ dimensions: [...state.dimensions, dim] }));
    return dim;
  },

  updateDimension: (id, updates) => {
    set(state => ({
      dimensions: state.dimensions.map(d => d.id === id ? { ...d, ...updates } : d),
    }));
  },

  removeDimension: (id) => {
    set(state => ({ dimensions: state.dimensions.filter(d => d.id !== id) }));
  },

  toggleDimension: (id) => {
    set(state => ({
      dimensions: state.dimensions.map(d =>
        d.id === id ? { ...d, enabled: !d.enabled } : d
      ),
    }));
  },

  createDimensionsFromColumns: (columns) => {
    const existingKeys = new Set(get().dimensions.map(d => d.fieldKey));
    const newDimensions: Dimension[] = [];

    // ColumnInfo.type 'string' maps to DimensionType 'category'
    const typeMap: Record<string, DimensionType> = {
      string: 'category',
      number: 'number',
      date: 'date',
    };

    for (const col of columns) {
      if (!existingKeys.has(col.key)) {
        newDimensions.push({
          id: uuidv4(),
          fieldKey: col.key,
          label: col.label,
          type: typeMap[col.type] || 'category',
          aggregation: col.type === 'number' ? 'sum' : undefined,
          enabled: true,
        });
      }
    }

    if (newDimensions.length > 0) {
      set(state => ({ dimensions: [...state.dimensions, ...newDimensions] }));
    }
  },
}));
