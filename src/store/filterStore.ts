/**
 * 筛选器 Store - 管理全局和局部筛选条件
 */
import { create } from 'zustand';
import type { Filter, FilterOperator } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface FilterState {
  /** 全局筛选条件 */
  globalFilters: Filter[];
  /** 时间范围 */
  monthRange: { start: string; end: string } | null;

  // Actions
  /** 添加筛选条件 */
  addFilter: (dimension: string, fieldKey: string, operator: FilterOperator, value: any) => Filter;
  /** 更新筛选条件 */
  updateFilter: (id: string, updates: Partial<Filter>) => void;
  /** 删除筛选条件 */
  removeFilter: (id: string) => void;
  /** 清除所有筛选条件 */
  clearFilters: () => void;
  /** 设置时间范围 */
  setMonthRange: (range: { start: string; end: string } | null) => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  globalFilters: [],
  monthRange: null,

  addFilter: (dimension, fieldKey, operator, value) => {
    const filter: Filter = {
      id: uuidv4(),
      dimension,
      fieldKey,
      operator,
      value,
    };
    set(state => ({ globalFilters: [...state.globalFilters, filter] }));
    return filter;
  },

  updateFilter: (id, updates) => {
    set(state => ({
      globalFilters: state.globalFilters.map(f => f.id === id ? { ...f, ...updates } : f),
    }));
  },

  removeFilter: (id) => {
    set(state => ({ globalFilters: state.globalFilters.filter(f => f.id !== id) }));
  },

  clearFilters: () => set({ globalFilters: [], monthRange: null }),

  setMonthRange: (range) => set({ monthRange: range }),
}));
