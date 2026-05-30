/**
 * 业务订单时间分析工具
 * 针对固定表结构：业务下单时间、接单时间、派单时间等
 */
import type { DataRecord } from '../types';

/** 按小时分布统计 */
export interface HourlyDistribution {
  hour: string;       // "08", "09", ...
  count: number;
}

/** 接单耗时统计（秒） */
export interface AcceptanceTime {
  range: string;      // "0-1分钟", "1-3分钟", ...
  count: number;
  minSeconds: number;
  maxSeconds: number;
}

/** 5分钟并发窗口 */
export interface ConcurrencyWindow {
  startTime: string;  // 窗口起始时间
  endTime: string;    // 窗口结束时间
  count: number;      // 窗口内订单数
}

/** 每日每小时分布 */
export interface DailyHourly {
  date: string;
  hourly: HourlyDistribution[];
  totalForDay: number;
}

/** 汇总统计 */
export interface SummaryStats {
  totalOrders: number;
  dateRange: { start: string; end: string };
  avgAcceptanceSeconds: number;
  medianAcceptanceSeconds: number;
  peakHour: string;
  peakHourCount: number;
  avgDocPrepSeconds: number;
  medianDocPrepSeconds: number;
  /** 异常统计 */
  crossDateCount: number;      // 跨日制单数
  after17Count: number;        // 17:00后下单数
}

/** 异常标注结果 */
export interface AnomalyFlags {
  isAfter17: boolean;           // 17:00后下单
  isCrossDate: boolean;         // 跨日期制单（下单日期≠提交复核日期）
}

/**
 * 解析时间字符串为 Date
 */
function parseTime(timeStr: string): Date | null {
  if (!timeStr) return null;
  try {
    const d = new Date(timeStr.replace(' ', 'T'));
    return isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/**
 * 判断是否为跨日期制单（下单日期 ≠ 首次提交复核日期）
 */
export function isCrossDateOrder(r: DataRecord): boolean {
  const orderTime = parseTime(r['业务下单时间']);
  const reviewTime = parseTime(r['首次提交复核时间']);
  if (!orderTime || !reviewTime) return false;
  return orderTime.toDateString() !== reviewTime.toDateString();
}

/**
 * 判断是否为17:00后下单
 */
export function isAfter17Order(r: DataRecord): boolean {
  const orderTime = parseTime(r['业务下单时间']);
  if (!orderTime) return false;
  return orderTime.getHours() >= 17;
}

/**
 * 获取异常标注
 */
export function getAnomalyFlags(r: DataRecord): AnomalyFlags {
  const orderTime = parseTime(r['业务下单时间']);
  const reviewTime = parseTime(r['首次提交复核时间']);
  return {
    isAfter17: orderTime ? orderTime.getHours() >= 17 : false,
    isCrossDate: orderTime && reviewTime ? orderTime.toDateString() !== reviewTime.toDateString() : false,
  };
}

/**
 * 剔除跨日期异常数据
 */
export function filterCrossDateAnomalies(records: DataRecord[]): DataRecord[] {
  return records.filter(r => !isCrossDateOrder(r));
}

/**
 * 按小时统计下单分布
 */
export function calcHourlyDistribution(records: DataRecord[]): HourlyDistribution[] {
  const hourCounts = new Map<string, number>();

  for (const r of records) {
    const orderTime = parseTime(r['业务下单时间']);
    if (!orderTime) continue;
    const hour = String(orderTime.getHours()).padStart(2, '0');
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  const result: HourlyDistribution[] = [];
  for (let h = 0; h < 24; h++) {
    const hour = String(h).padStart(2, '0');
    result.push({ hour, count: hourCounts.get(hour) || 0 });
  }
  return result;
}

/**
 * 计算接单耗时（接单时间 - 业务下单时间，单位秒）
 */
export function calcAcceptanceTime(records: DataRecord[]): AcceptanceTime[] {
  const durations: number[] = [];

  for (const r of records) {
    const orderTime = parseTime(r['业务下单时间']);
    const acceptTime = parseTime(r['接单时间']);
    if (!orderTime || !acceptTime) continue;
    const duration = (acceptTime.getTime() - orderTime.getTime()) / 1000;
    if (duration >= 0) durations.push(duration);
  }

  // 分段统计
  const ranges: { label: string; min: number; max: number }[] = [
    { label: '0-30秒', min: 0, max: 30 },
    { label: '30-60秒', min: 30, max: 60 },
    { label: '1-3分钟', min: 60, max: 180 },
    { label: '3-5分钟', min: 180, max: 300 },
    { label: '5-10分钟', min: 300, max: 600 },
    { label: '10-30分钟', min: 600, max: 1800 },
    { label: '30-60分钟', min: 1800, max: 3600 },
    { label: '1小时以上', min: 3600, max: Infinity },
  ];

  return ranges.map(r => ({
    range: r.label,
    count: durations.filter(d => d >= r.min && d < r.max).length,
    minSeconds: r.min,
    maxSeconds: r.max,
  }));
}

/**
 * 计算5分钟滑动窗口的并发订单数
 */
export function calcConcurrencyWindows(records: DataRecord[], windowMinutes: number = 5): ConcurrencyWindow[] {
  // 提取所有下单时间并排序
  const times: { time: Date; record: DataRecord }[] = [];
  for (const r of records) {
    const t = parseTime(r['业务下单时间']);
    if (t) times.push({ time: t, record: r });
  }
  times.sort((a, b) => a.time.getTime() - b.time.getTime());
  if (times.length === 0) return [];

  const windowMs = windowMinutes * 60 * 1000;
  const result: ConcurrencyWindow[] = [];

  // 滑动窗口
  let left = 0;
  for (let right = 0; right < times.length; right++) {
    // 扩大窗口右边界
    while (left < right && times[right].time.getTime() - times[left].time.getTime() > windowMs) {
      // 记录当前窗口（移动左边界前）
      const count = right - left;
      if (count >= 1) {
        result.push({
          startTime: formatDateTime(times[left].time),
          endTime: formatDateTime(times[right - 1].time),
          count,
        });
      }
      left++;
    }

    // 如果到达末尾，记录最后一个窗口
    if (right === times.length - 1) {
      const count = right - left + 1;
      result.push({
        startTime: formatDateTime(times[left].time),
        endTime: formatDateTime(times[right].time),
        count,
      });
    }
  }

  // 去重并只保留高峰期（默认 >=20 单/窗口，也可配置）
  return dedupeWindows(result).sort((a, b) => b.count - a.count);
}

/** 窗口去重：保留 count 最大的 */
function dedupeWindows(windows: ConcurrencyWindow[]): ConcurrencyWindow[] {
  const seen = new Set<string>();
  const result: ConcurrencyWindow[] = [];
  for (const w of windows) {
    const key = `${w.startTime}`;
    if (!seen.has(key)) {
      seen.add(key);
      // 保留相同 startTime 下 count 最大的
      const existing = result.find(r => r.startTime === w.startTime);
      if (existing) {
        existing.count = Math.max(existing.count, w.count);
      } else {
        result.push(w);
      }
    }
  }
  return result;
}

function formatDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 计算汇总统计
 */
export function calcSummaryStats(records: DataRecord[]): SummaryStats | null {
  if (records.length === 0) return null;

  const durations: number[] = [];
  const hours: number[] = [];
  let minDate: Date | null = null;
  let maxDate: Date | null = null;

  for (const r of records) {
    const orderTime = parseTime(r['业务下单时间']);
    const acceptTime = parseTime(r['接单时间']);
    if (orderTime) {
      hours.push(orderTime.getHours());
      if (!minDate || orderTime < minDate) minDate = orderTime;
      if (!maxDate || orderTime > maxDate) maxDate = orderTime;
    }
    if (orderTime && acceptTime) {
      const d = (acceptTime.getTime() - orderTime.getTime()) / 1000;
      if (d >= 0) durations.push(d);
    }
  }

  // 高峰小时
  const hourCounts = new Map<number, number>();
  hours.forEach(h => hourCounts.set(h, (hourCounts.get(h) || 0) + 1));
  let peakHour = 0;
  let peakCount = 0;
  hourCounts.forEach((c, h) => { if (c > peakCount) { peakCount = c; peakHour = h; } });

  // 中位数
  durations.sort((a, b) => a - b);
  const median = durations.length % 2 === 0
    ? (durations[durations.length / 2 - 1] + durations[durations.length / 2]) / 2
    : durations[Math.floor(durations.length / 2)];

  // 制单时长（业务下单→首次提交复核）
  const docPrepDurations: number[] = [];
  let crossDateCount = 0;
  let after17Count = 0;
  for (const r of records) {
    const orderTime2 = parseTime(r['业务下单时间']);
    const reviewTime = parseTime(r['首次提交复核时间']);
    if (orderTime2 && reviewTime) {
      const d = (reviewTime.getTime() - orderTime2.getTime()) / 1000;
      if (d >= 0) docPrepDurations.push(d);
    }
    if (isCrossDateOrder(r)) crossDateCount++;
    if (isAfter17Order(r)) after17Count++;
  }
  docPrepDurations.sort((a, b) => a - b);
  const medianDoc = docPrepDurations.length % 2 === 0
    ? (docPrepDurations[docPrepDurations.length / 2 - 1] + docPrepDurations[docPrepDurations.length / 2]) / 2
    : docPrepDurations[Math.floor(docPrepDurations.length / 2)];

  return {
    totalOrders: records.length,
    dateRange: {
      start: minDate ? formatDateTime(minDate).split(' ')[0] : '',
      end: maxDate ? formatDateTime(maxDate).split(' ')[0] : '',
    },
    avgAcceptanceSeconds: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    medianAcceptanceSeconds: median || 0,
    peakHour: `${String(peakHour).padStart(2, '0')}:00`,
    peakHourCount: peakCount,
    avgDocPrepSeconds: docPrepDurations.length > 0 ? docPrepDurations.reduce((a, b) => a + b, 0) / docPrepDurations.length : 0,
    medianDocPrepSeconds: medianDoc || 0,
    crossDateCount,
    after17Count,
  };
}

/**
 * 获取所有可用的日期列表
 */
export function getAvailableDates(records: DataRecord[]): string[] {
  const dates = new Set<string>();
  for (const r of records) {
    const t = parseTime(r['业务下单时间']);
    if (t) {
      const d = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      dates.add(d);
    }
  }
  return [...dates].sort();
}

/**
 * 按指定日期计算每小时下单分布
 */
export function calcDailyHourlyDistribution(records: DataRecord[], date: string): HourlyDistribution[] {
  const hourCounts = new Map<string, number>();

  for (const r of records) {
    const orderTime = parseTime(r['业务下单时间']);
    if (!orderTime) continue;
    const d = `${orderTime.getFullYear()}-${String(orderTime.getMonth() + 1).padStart(2, '0')}-${String(orderTime.getDate()).padStart(2, '0')}`;
    if (d !== date) continue;
    const hour = String(orderTime.getHours()).padStart(2, '0');
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  const result: HourlyDistribution[] = [];
  for (let h = 0; h < 24; h++) {
    const hour = String(h).padStart(2, '0');
    result.push({ hour, count: hourCounts.get(hour) || 0 });
  }
  return result;
}

/**
 * 获取所有日期的每日分布
 */
export function calcAllDailyDistributions(records: DataRecord[]): DailyHourly[] {
  const dates = getAvailableDates(records);
  return dates.map(date => ({
    date,
    hourly: calcDailyHourlyDistribution(records, date),
    totalForDay: records.filter(r => {
      const t = parseTime(r['业务下单时间']);
      if (!t) return false;
      const d = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
      return d === date;
    }).length,
  }));
}

/**
 * 计算制单时长（业务下单时间 → 首次提交复核时间，单位秒）
 */
export function calcDocPrepTime(records: DataRecord[]): AcceptanceTime[] {
  const durations: number[] = [];

  for (const r of records) {
    const orderTime = parseTime(r['业务下单时间']);
    const reviewTime = parseTime(r['首次提交复核时间']);
    if (!orderTime || !reviewTime) continue;
    const duration = (reviewTime.getTime() - orderTime.getTime()) / 1000;
    if (duration >= 0) durations.push(duration);
  }

  const ranges: { label: string; min: number; max: number }[] = [
    { label: '0-30分钟', min: 0, max: 1800 },
    { label: '30分钟-1小时', min: 1800, max: 3600 },
    { label: '1小时-2小时', min: 3600, max: 7200 },
    { label: '2小时-3小时', min: 7200, max: 10800 },
    { label: '3小时以上', min: 10800, max: Infinity },
  ];

  return ranges.map(r => ({
    range: r.label,
    count: durations.filter(d => d >= r.min && d < r.max).length,
    minSeconds: r.min,
    maxSeconds: r.max,
  }));
}

// ==================== 异常分析：17:00后下单 ====================

/**
 * 筛选17:00后下单的记录
 */
export function filterAfter17Orders(records: DataRecord[]): DataRecord[] {
  return records.filter(r => isAfter17Order(r));
}

/**
 * 17:00后下单的按小时分布（17-23点）
 */
export function calcAfter17HourlyDistribution(records: DataRecord[]): HourlyDistribution[] {
  const after17 = filterAfter17Orders(records);
  const hourCounts = new Map<string, number>();

  for (const r of after17) {
    const orderTime = parseTime(r['业务下单时间']);
    if (!orderTime) continue;
    const hour = String(orderTime.getHours()).padStart(2, '0');
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  const result: HourlyDistribution[] = [];
  for (let h = 17; h < 24; h++) {
    const hour = String(h).padStart(2, '0');
    result.push({ hour, count: hourCounts.get(hour) || 0 });
  }
  return result;
}

/**
 * 17:00后下单按日期的小时分布
 */
export function calcDailyAfter17HourlyDistribution(records: DataRecord[], date: string): HourlyDistribution[] {
  const after17 = filterAfter17Orders(records);
  const hourCounts = new Map<string, number>();

  for (const r of after17) {
    const orderTime = parseTime(r['业务下单时间']);
    if (!orderTime) continue;
    const d = `${orderTime.getFullYear()}-${String(orderTime.getMonth() + 1).padStart(2, '0')}-${String(orderTime.getDate()).padStart(2, '0')}`;
    if (d !== date) continue;
    const hour = String(orderTime.getHours()).padStart(2, '0');
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  }

  const result: HourlyDistribution[] = [];
  for (let h = 17; h < 24; h++) {
    const hour = String(h).padStart(2, '0');
    result.push({ hour, count: hourCounts.get(hour) || 0 });
  }
  return result;
}

/**
 * 17:00后下单的日期列表
 */
export function getAfter17AvailableDates(records: DataRecord[]): string[] {
  const after17 = filterAfter17Orders(records);
  return getAvailableDates(after17);
}

/**
 * 17:00后下单总览统计
 */
export function calcAfter17Summary(records: DataRecord[]): { total: number; crossCount: number } {
  const after17 = filterAfter17Orders(records);
  let crossCount = 0;
  for (const r of after17) {
    if (isCrossDateOrder(r)) crossCount++;
  }
  return { total: after17.length, crossCount };
}

// ==================== 企业维度分析 ====================

/** 企业排行条目 */
export interface EntityRank {
  name: string;
  count: number;
}

/**
 * 按指定字段统计业务量排行（降序）
 */
export function calcEntityRanking(records: DataRecord[], field: string, topN: number = 20): EntityRank[] {
  const counts = new Map<string, number>();
  for (const r of records) {
    const key = r[field] || '(空)';
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/**
 * 按指定企业筛选后的全部时段分布
 */
export function calcEntityHourlyDistribution(records: DataRecord[], field: string, entityName: string): HourlyDistribution[] {
  const filtered = records.filter(r => (r[field] || '(空)') === entityName);
  return calcHourlyDistribution(filtered);
}

/**
 * 按指定企业 + 日期的小时分布
 */
export function calcEntityDailyHourlyDistribution(records: DataRecord[], field: string, entityName: string, date: string): HourlyDistribution[] {
  const filtered = records.filter(r => (r[field] || '(空)') === entityName);
  return calcDailyHourlyDistribution(filtered, date);
}

/**
 * 获取某字段的唯一条目列表
 */
export function getEntityList(records: DataRecord[], field: string): string[] {
  const set = new Set<string>();
  for (const r of records) {
    set.add(r[field] || '(空)');
  }
  return [...set].sort();
}

/**
 * 统计每家企业在高并发窗口中的出现次数
 */
export function calcHighConcurrencyEntityRanking(
  records: DataRecord[],
  field: string,
  windowMinutes: number = 5,
  threshold: number = 10,
  topN: number = 20,
): EntityRank[] {
  const windows = calcConcurrencyWindows(records, windowMinutes)
    .filter(w => w.count >= threshold);

  const entityCount = new Map<string, number>();
  for (const w of windows) {
    const windowStart = new Date(w.startTime.replace(' ', 'T')).getTime();
    const windowEnd = windowStart + windowMinutes * 60 * 1000;

    const entitiesInWindow = new Set<string>();
    for (const r of records) {
      const orderTime = parseTime(r['业务下单时间']);
      if (!orderTime) continue;
      const ts = orderTime.getTime();
      if (ts >= windowStart && ts < windowEnd) {
        const entity = r[field] || '(空)';
        entitiesInWindow.add(entity);
      }
    }
    for (const e of entitiesInWindow) {
      entityCount.set(e, (entityCount.get(e) || 0) + 1);
    }
  }

  return [...entityCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/**
 * 计算剔除异常后的汇总统计
 */
export function calcCleanSummaryStats(records: DataRecord[]): {
  total: number;
  avgAcceptanceSeconds: number;
  avgDocPrepSeconds: number;
} | null {
  const clean = filterCrossDateAnomalies(records);
  if (clean.length === 0) return null;

  const acceptDurations: number[] = [];
  const docDurations: number[] = [];

  for (const r of clean) {
    const orderTime = parseTime(r['业务下单时间']);
    const acceptTime = parseTime(r['接单时间']);
    const reviewTime = parseTime(r['首次提交复核时间']);

    if (orderTime && acceptTime) {
      const d = (acceptTime.getTime() - orderTime.getTime()) / 1000;
      if (d >= 0) acceptDurations.push(d);
    }
    if (orderTime && reviewTime) {
      const d = (reviewTime.getTime() - orderTime.getTime()) / 1000;
      if (d >= 0) docDurations.push(d);
    }
  }

  return {
    total: clean.length,
    avgAcceptanceSeconds: acceptDurations.length > 0 ? acceptDurations.reduce((a, b) => a + b, 0) / acceptDurations.length : 0,
    avgDocPrepSeconds: docDurations.length > 0 ? docDurations.reduce((a, b) => a + b, 0) / docDurations.length : 0,
  };
}

// ==================== 预处理器：单次遍历所有数据 ====================

export interface PreprocessedData {
  total: number;
  records: DataRecord[];
  cleanRecords: DataRecord[];
  after17Records: DataRecord[];
  // 小时分布（全部）
  hourCounts: Map<string, number>;
  // 小时分布（按日期）
  dailyHourCounts: Map<string, Map<string, number>>; // date → hour → count
  // 接单耗时（秒数组）
  acceptDurations: number[];
  acceptDurationsClean: number[];
  // 制单时长（秒数组）
  docDurations: number[];
  docDurationsClean: number[];
  // 汇总
  dateRange: { start: string; end: string };
  crossDateCount: number;
  after17Count: number;
  // 企业排行
  shipperCounts: Map<string, number>;
  entrustCounts: Map<string, number>;
  // 企业小时分布（委托企业）
  entrustHourCounts: Map<string, Map<string, number>>; // entity → hour → count
  entrustDailyHourCounts: Map<string, Map<string, Map<string, number>>>; // entity → date → hour → count
  // 17点后小时分布
  after17HourCounts: Map<string, number>;
  after17DailyHourCounts: Map<string, Map<string, number>>;
  // 下单时间戳（毫秒），用于并发分析
  orderTimestamps: number[];
  // 日期列表
  availableDates: string[];
  after17AvailableDates: string[];
  entrustList: string[];
  // 境内收发货人 进/出口 制单时长: shipper → impExp → { total, docCount, docSum }
  shipperImpExpDocPrep: Map<string, Map<string, { total: number; docCount: number; docSum: number }>>;
  // 委托企业问询总次数
  entrustInquiryCounts: Map<string, number>;
  // 境内收发货人异常统计: shipper → 进/出口 → { after17, crossDate }
  shipperAnomalyCounts: Map<string, Map<string, { after17: number; crossDate: number }>>;
}

export function enrichPreprocessed(pre: PreprocessedData): PreprocessedData {
  // 境内收发货人 进/出口 制单时长
  const shipperImpExpDocPrep = new Map<string, Map<string, { total: number; docCount: number; docSum: number }>>();
  // 境内收发货人异常统计（按进出口拆分）
  const shipperAnomalyCounts = new Map<string, Map<string, { after17: number; crossDate: number }>>();
  // 委托企业问询
  const entrustInquiryCounts = new Map<string, number>();

  for (const r of pre.records) {
    const orderTime = parseTime(r['业务下单时间']);
    const reviewTime = parseTime(r['首次提交复核时间']);
    const shipper = r['境内收发货人'] || '(空)';
    const entrust = r['委托企业'] || '(空)';
    const rawType = (r['进/口类型'] || '').toString().trim();
    const impExp = rawType === 'I' ? '进口' : rawType === 'E' ? '出口' : '其他';
    const inquiry = parseInt(r['问询次数']) || 0;

    // 问询
    entrustInquiryCounts.set(entrust, (entrustInquiryCounts.get(entrust) || 0) + inquiry);

    // 进/出口 总量统计
    if (!shipperImpExpDocPrep.has(shipper)) shipperImpExpDocPrep.set(shipper, new Map());
    const m = shipperImpExpDocPrep.get(shipper)!;
    if (!m.has(impExp)) m.set(impExp, { total: 0, docCount: 0, docSum: 0 });
    const s = m.get(impExp)!;
    s.total++;

    // 制单时长（仅当有复核时间时）
    if (orderTime && reviewTime) {
      const d = (reviewTime.getTime() - orderTime.getTime()) / 1000;
      if (d >= 0) { s.docCount++; s.docSum += d; }
    }

    // 按收发货人+进出口统计异常
    if (!shipperAnomalyCounts.has(shipper)) shipperAnomalyCounts.set(shipper, new Map());
    const saMap = shipperAnomalyCounts.get(shipper)!;
    if (!saMap.has(impExp)) saMap.set(impExp, { after17: 0, crossDate: 0 });
    const sa = saMap.get(impExp)!;
    if (orderTime && orderTime.getHours() >= 17) sa.after17++;
    if (orderTime && reviewTime && orderTime.toDateString() !== reviewTime.toDateString()) sa.crossDate++;
  }

  return { ...pre, shipperImpExpDocPrep, entrustInquiryCounts, shipperAnomalyCounts };
}

export function preprocessRecords(rawRecords: DataRecord[]): PreprocessedData {
  const records = rawRecords;
  const cleanRecords: DataRecord[] = [];
  const after17Records: DataRecord[] = [];

  const hourCounts = new Map<string, number>();
  const dailyHourCounts = new Map<string, Map<string, number>>();
  const acceptDurations: number[] = [];
  const acceptDurationsClean: number[] = [];
  const docDurations: number[] = [];
  const docDurationsClean: number[] = [];
  const shipperCounts = new Map<string, number>();
  const entrustCounts = new Map<string, number>();
  const entrustHourCounts = new Map<string, Map<string, number>>();
  const entrustDailyHourCounts = new Map<string, Map<string, Map<string, number>>>();
  const after17HourCounts = new Map<string, number>();
  const after17DailyHourCounts = new Map<string, Map<string, number>>();
  const orderTimestamps: number[] = [];
  const dateSet = new Set<string>();
  const after17DateSet = new Set<string>();

  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  let crossDateCount = 0;
  let after17Count = 0;

  for (const r of records) {
    const orderTime = parseTime(r['业务下单时间']);
    const acceptTime = parseTime(r['接单时间']);
    const reviewTime = parseTime(r['首次提交复核时间']);
    const shipper = r['境内收发货人'] || '(空)';
    const entrust = r['委托企业'] || '(空)';

    // 企业计数
    shipperCounts.set(shipper, (shipperCounts.get(shipper) || 0) + 1);
    entrustCounts.set(entrust, (entrustCounts.get(entrust) || 0) + 1);

    if (!orderTime) continue;
    const ts = orderTime.getTime();
    orderTimestamps.push(ts);

    // 日期范围
    if (!minDate || orderTime < minDate) minDate = orderTime;
    if (!maxDate || orderTime > maxDate) maxDate = orderTime;

    const dateStr = fmtDate(orderTime);
    const hourStr = String(orderTime.getHours()).padStart(2, '0');
    dateSet.add(dateStr);

    // 小时分布
    hourCounts.set(hourStr, (hourCounts.get(hourStr) || 0) + 1);

    // 每日小时分布
    if (!dailyHourCounts.has(dateStr)) dailyHourCounts.set(dateStr, new Map());
    const dayMap = dailyHourCounts.get(dateStr)!;
    dayMap.set(hourStr, (dayMap.get(hourStr) || 0) + 1);

    // 企业小时分布
    if (!entrustHourCounts.has(entrust)) entrustHourCounts.set(entrust, new Map());
    const entMap = entrustHourCounts.get(entrust)!;
    entMap.set(hourStr, (entMap.get(hourStr) || 0) + 1);

    // 企业每日小时分布
    if (!entrustDailyHourCounts.has(entrust)) entrustDailyHourCounts.set(entrust, new Map());
    const entDayMap = entrustDailyHourCounts.get(entrust)!;
    if (!entDayMap.has(dateStr)) entDayMap.set(dateStr, new Map());
    const entHourMap = entDayMap.get(dateStr)!;
    entHourMap.set(hourStr, (entHourMap.get(hourStr) || 0) + 1);

    // 17:00后
    const isAfter17 = orderTime.getHours() >= 17;
    if (isAfter17) {
      after17Count++;
      after17Records.push(r);
      after17DateSet.add(dateStr);
      after17HourCounts.set(hourStr, (after17HourCounts.get(hourStr) || 0) + 1);
      if (!after17DailyHourCounts.has(dateStr)) after17DailyHourCounts.set(dateStr, new Map());
      const a17DayMap = after17DailyHourCounts.get(dateStr)!;
      a17DayMap.set(hourStr, (a17DayMap.get(hourStr) || 0) + 1);
    }

    // 跨日期制单
    const isCrossDate = orderTime && reviewTime ? orderTime.toDateString() !== reviewTime.toDateString() : false;
    if (isCrossDate) crossDateCount++;

    // 接单耗时 & 制单时长
    if (acceptTime) {
      const d = (acceptTime.getTime() - ts) / 1000;
      if (d >= 0) {
        acceptDurations.push(d);
        if (!isCrossDate) acceptDurationsClean.push(d);
      }
    }
    if (reviewTime) {
      const d = (reviewTime.getTime() - ts) / 1000;
      if (d >= 0) {
        docDurations.push(d);
        if (!isCrossDate) docDurationsClean.push(d);
        if (!isCrossDate) cleanRecords.push(r);
      }
    }
  }

  orderTimestamps.sort((a, b) => a - b);

  return {
    total: records.length,
    records,
    cleanRecords,
    after17Records,
    hourCounts,
    dailyHourCounts,
    acceptDurations,
    acceptDurationsClean,
    docDurations,
    docDurationsClean,
    dateRange: {
      start: minDate ? fmtDate(minDate) : '',
      end: maxDate ? fmtDate(maxDate) : '',
    },
    crossDateCount,
    after17Count,
    shipperCounts,
    entrustCounts,
    entrustHourCounts,
    entrustDailyHourCounts,
    after17HourCounts,
    after17DailyHourCounts,
    orderTimestamps,
    availableDates: [...dateSet].sort(),
    after17AvailableDates: [...after17DateSet].sort(),
    entrustList: [...new Set(entrustCounts.keys())].sort(),
    shipperImpExpDocPrep: new Map(),
    entrustInquiryCounts: new Map(),
    shipperAnomalyCounts: new Map(),
  };
}

function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * 从预处理器结果快速构建 HourlyDistribution 数组
 */
export function preprocessedToHourly(hourCounts: Map<string, number>, startHour = 0, endHour = 23): HourlyDistribution[] {
  const result: HourlyDistribution[] = [];
  for (let h = startHour; h <= endHour; h++) {
    const hour = String(h).padStart(2, '0');
    result.push({ hour, count: hourCounts.get(hour) || 0 });
  }
  return result;
}

/**
 * 从预处理器结果获取某日的 HourlyDistribution
 */
export function preprocessedToDailyHourly(dailyHourCounts: Map<string, Map<string, number>>, date: string, startHour = 0, endHour = 23): HourlyDistribution[] {
  const dayMap = dailyHourCounts.get(date);
  const result: HourlyDistribution[] = [];
  for (let h = startHour; h <= endHour; h++) {
    const hour = String(h).padStart(2, '0');
    result.push({ hour, count: dayMap?.get(hour) || 0 });
  }
  return result;
}

/**
 * 从预处理器时长数组快速分段
 */
export function preprocessedToTimeRanges(durations: number[], ranges: { label: string; min: number; max: number }[]): AcceptanceTime[] {
  // 一次遍历分类
  const counts = new Array(ranges.length).fill(0);
  for (const d of durations) {
    for (let i = 0; i < ranges.length; i++) {
      if (d >= ranges[i].min && d < ranges[i].max) {
        counts[i]++;
        break;
      }
    }
  }
  return ranges.map((r, i) => ({ range: r.label, count: counts[i], minSeconds: r.min, maxSeconds: r.max }));
}

/**
 * 从预处理器时间戳快速计算并发窗口
 */
export function preprocessedToConcurrency(timestamps: number[], windowMinutes: number): ConcurrencyWindow[] {
  if (timestamps.length === 0) return [];
  const windowMs = windowMinutes * 60 * 1000;
  const result: ConcurrencyWindow[] = [];

  let left = 0;
  for (let right = 0; right < timestamps.length; right++) {
    while (left < right && timestamps[right] - timestamps[left] > windowMs) {
      result.push({
        startTime: tsToStr(timestamps[left]),
        endTime: tsToStr(timestamps[right - 1]),
        count: right - left,
      });
      left++;
    }
    if (right === timestamps.length - 1) {
      result.push({
        startTime: tsToStr(timestamps[left]),
        endTime: tsToStr(timestamps[right]),
        count: right - left + 1,
      });
    }
  }
  return result.sort((a, b) => b.count - a.count);
}

function tsToStr(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * 从预处理器快速计算企业高并发排行
 */
export function preprocessedToHcRanking(
  pre: PreprocessedData,
  windowMinutes: number,
  threshold: number,
  topN: number,
): EntityRank[] {
  const windows = preprocessedToConcurrency(pre.orderTimestamps, windowMinutes)
    .filter(w => w.count >= threshold);

  const entityCount = new Map<string, number>();
  for (const w of windows) {
    const wStart = new Date(w.startTime.replace(' ', 'T')).getTime();
    const wEnd = wStart + windowMinutes * 60 * 1000;

    const entities = new Set<string>();
    for (const r of pre.records) {
      const ot = parseTime(r['业务下单时间']);
      if (!ot) continue;
      const ts = ot.getTime();
      if (ts >= wStart && ts < wEnd) {
        entities.add(r['委托企业'] || '(空)');
      }
    }
    for (const e of entities) entityCount.set(e, (entityCount.get(e) || 0) + 1);
  }
  return [...entityCount.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

/**
 * 从预处理器获取企业排行
 */
export function preprocessedToRanking(countMap: Map<string, number>, topN: number): EntityRank[] {
  return [...countMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
}

// 时间分段常量
export const ACCEPTANCE_RANGES = [
  { label: '0-30秒', min: 0, max: 30 },
  { label: '30-60秒', min: 30, max: 60 },
  { label: '1-3分钟', min: 60, max: 180 },
  { label: '3-5分钟', min: 180, max: 300 },
  { label: '5-10分钟', min: 300, max: 600 },
  { label: '10-30分钟', min: 600, max: 1800 },
  { label: '30-60分钟', min: 1800, max: 3600 },
  { label: '1小时以上', min: 3600, max: Infinity },
];

export const DOCPREP_RANGES = [
  { label: '0-30分钟', min: 0, max: 1800 },
  { label: '30分钟-1小时', min: 1800, max: 3600 },
  { label: '1小时-2小时', min: 3600, max: 7200 },
  { label: '2小时-3小时', min: 7200, max: 10800 },
  { label: '3小时以上', min: 10800, max: Infinity },
];
