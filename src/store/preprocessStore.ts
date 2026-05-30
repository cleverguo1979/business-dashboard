/**
 * 预处理 Store - 监听数据变化，异步计算预处理结果，全看板共享
 */
import { create } from 'zustand';
import { preprocessRecords, enrichPreprocessed } from '../utils/orderAnalyzer';
import type { PreprocessedData } from '../utils/orderAnalyzer';
import type { DataRecord } from '../types';

interface PreprocessState {
  pre: PreprocessedData | null;
  computing: boolean;
  recordCount: number;
  /** 触发预处理 */
  compute: (records: DataRecord[]) => void;
  /** 重置 */
  reset: () => void;
}

export const usePreprocessStore = create<PreprocessState>((set) => ({
  pre: null,
  computing: false,
  recordCount: 0,

  compute: (records: DataRecord[]) => {
    if (records.length === 0) {
      set({ pre: null, computing: false, recordCount: 0 });
      return;
    }
    set({ computing: true, recordCount: records.length });
    // 延迟到下一个事件循环，不阻塞 UI
    setTimeout(() => {
      const pre = enrichPreprocessed(preprocessRecords(records));
      set({ pre, computing: false });
    }, 10);
  },

  reset: () => set({ pre: null, computing: false, recordCount: 0 }),
}));
