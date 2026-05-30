/**
 * 数据管理 Store - 管理导入的数据集
 */
import { create } from 'zustand';
import type { DataSet, DataRecord, ColumnInfo } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { inferColumnType } from '../utils/dataProcessor';

interface DataState {
  /** 所有数据集 */
  dataSets: DataSet[];
  /** 当前选中的数据集 ID */
  currentDataSetId: string | null;

  // Actions
  /** 导入新数据集 */
  importData: (name: string, fileName: string, records: Record<string, any>[]) => DataSet;
  /** 删除数据集 */
  removeDataSet: (id: string) => void;
  /** 设置当前数据集 */
  setCurrentDataSet: (id: string | null) => void;
  /** 获取当前数据集 */
  getCurrentDataSet: () => DataSet | undefined;
  /** 追加数据到已有数据集 */
  appendToDataSet: (id: string, records: Record<string, any>[]) => void;
}

export const useDataStore = create<DataState>((set, get) => ({
  dataSets: [],
  currentDataSetId: null,

  importData: (name: string, fileName: string, rawRecords: Record<string, any>[]) => {
    // 推断列信息
    const columns: ColumnInfo[] = [];
    const keys = Object.keys(rawRecords[0] || {});
    for (const key of keys) {
      const sampleValues = rawRecords.slice(0, 10).map(r => r[key]);
      columns.push({
        key,
        label: key,
        type: inferColumnType(sampleValues),
        sampleValues,
      });
    }

    const records: DataRecord[] = rawRecords.map(r => ({
      id: uuidv4(),
      month: r['月份'] || r['month'] || r['日期'] || r['date'] || fileName,
      ...r,
    }));

    const dataSet: DataSet = {
      id: uuidv4(),
      name,
      fileName,
      importDate: new Date().toISOString(),
      records,
      columns,
    };

    set(state => ({
      dataSets: [...state.dataSets, dataSet],
      // 如果是第一个数据集，自动选中
      currentDataSetId: state.currentDataSetId || dataSet.id,
    }));

    return dataSet;
  },

  removeDataSet: (id: string) => {
    set(state => ({
      dataSets: state.dataSets.filter(ds => ds.id !== id),
      currentDataSetId: state.currentDataSetId === id
        ? state.dataSets.find(d => d.id !== id)?.id ?? null
        : state.currentDataSetId,
    }));
  },

  setCurrentDataSet: (id: string | null) => set({ currentDataSetId: id }),

  getCurrentDataSet: () => {
    const state = get();
    return state.dataSets.find(ds => ds.id === state.currentDataSetId);
  },

  appendToDataSet: (id: string, rawRecords: Record<string, any>[]) => {
    set(state => {
      const dataSet = state.dataSets.find(ds => ds.id === id);
      if (!dataSet) return state;

      const newRecords: DataRecord[] = rawRecords.map(r => ({
        id: uuidv4(),
        month: r['月份'] || r['month'] || r['日期'] || r['date'] || '',
        ...r,
      }));

      return {
        dataSets: state.dataSets.map(ds =>
          ds.id === id
            ? { ...ds, records: [...ds.records, ...newRecords] }
            : ds
        ),
      };
    });
  },
}));
