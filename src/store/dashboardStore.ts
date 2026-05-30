/**
 * 仪表盘配置 Store - 管理图表布局和配置
 */
import { create } from 'zustand';
import type { ChartConfig, ChartType } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface DashboardState {
  /** 仪表盘名称 */
  name: string;
  /** 所有图表配置 */
  charts: ChartConfig[];
  /** 网格列数 */
  gridCols: number;

  // Actions
  /** 设置仪表盘名称 */
  setName: (name: string) => void;
  /** 添加图表 */
  addChart: (type: ChartType, title: string) => ChartConfig;
  /** 更新图表配置 */
  updateChart: (id: string, updates: Partial<ChartConfig>) => void;
  /** 删除图表 */
  removeChart: (id: string) => void;
  /** 移动图表位置 */
  moveChart: (id: string, x: number, y: number) => void;
  /** 调整图表大小 */
  resizeChart: (id: string, w: number, h: number) => void;
  /** 复制图表 */
  duplicateChart: (id: string) => void;
  /** 设置网格列数 */
  setGridCols: (cols: number) => void;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  name: '我的看板',
  charts: [],
  gridCols: 12,

  setName: (name) => set({ name }),

  addChart: (type, title) => {
    // 自动计算位置：找到当前最大行号，放在下一行
    const charts = get().charts;
    const maxY = charts.reduce((max, c) => Math.max(max, c.position.y + c.position.h), 0);

    const chart: ChartConfig = {
      id: uuidv4(),
      type,
      title,
      position: {
        x: 0,
        y: maxY,
        w: type === 'pie' ? 4 : type === 'table' ? 12 : 6,
        h: 4,
      },
    };

    set(state => ({ charts: [...state.charts, chart] }));
    return chart;
  },

  updateChart: (id, updates) => {
    set(state => ({
      charts: state.charts.map(c => c.id === id ? { ...c, ...updates } : c),
    }));
  },

  removeChart: (id) => {
    set(state => ({ charts: state.charts.filter(c => c.id !== id) }));
  },

  moveChart: (id, x, y) => {
    set(state => ({
      charts: state.charts.map(c => c.id === id ? { ...c, position: { ...c.position, x, y } } : c),
    }));
  },

  resizeChart: (id, w, h) => {
    set(state => ({
      charts: state.charts.map(c => c.id === id ? { ...c, position: { ...c.position, w, h } } : c),
    }));
  },

  duplicateChart: (id) => {
    const chart = get().charts.find(c => c.id === id);
    if (!chart) return;
    const newChart: ChartConfig = {
      ...chart,
      id: uuidv4(),
      title: `${chart.title} (副本)`,
      position: { ...chart.position, y: chart.position.y + chart.position.h },
    };
    set(state => ({ charts: [...state.charts, newChart] }));
  },

  setGridCols: (cols) => set({ gridCols: cols }),
}));
