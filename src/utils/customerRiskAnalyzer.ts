/**
 * 客户风控分析引擎
 * 基于多月度数据，对重点客户进行风险评分、增长/下滑检测、流失识别，
 * 并生成自然语言风控洞察
 */

// ==================== 类型定义 ====================

/** 单客户单月明细 */
export interface CustomerMonthDetail {
  total: number;
  after17: number;
  crossDate: number;
  inquirySum: number;
  docPrepSum: number;   // 制单时长总和（秒）
  docPrepCount: number;  // 有效制单记录数
}

/** 扩展的月槽位 —— OverviewPage 使用 */
export interface MonthSlotWithDetails {
  hasData: boolean;
  total: number;
  entrustCounts: Map<string, number>;
  entrustDetails: Map<string, CustomerMonthDetail>;
}

/** 客户风险画像 */
export interface CustomerRiskProfile {
  name: string;
  /** 各月委托量 (1-12，无数据月份为 null) */
  monthlyVolumes: (number | null)[];
  /** 最近有数据的月份索引 (0-based) */
  latestMonthIndex: number;
  /** 最近有数据月份的上一个月索引，-1 表示只有一个有数据月 */
  prevMonthIndex: number;
  /** 总委托量 */
  totalVolume: number;
  /** 最近月环比变化率 (latest vs prev)，无法计算时为 null */
  growthRate: number | null;
  /** 17点后下单总占比 */
  after17Ratio: number;
  /** 跨日制单总占比 */
  crossDateRatio: number;
  /** 平均每单问询次数 */
  avgInquiry: number;
  /** 问询总次数 */
  totalInquiry: number;
  /** 平均制单时长（分钟） */
  avgDocPrepMin: number;
  /** 综合风险评分 0-100 */
  riskScore: number;
  /** 风险等级 */
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  /** 各月明细 */
  monthlyDetails: (CustomerMonthDetail | null)[];
  /** 标签集 */
  tags: string[];
}

/** 一条风控洞察 */
export interface RiskInsight {
  type: 'growth' | 'decline' | 'churn' | 'high_risk' | 'healthy';
  severity: 'info' | 'warning' | 'error' | 'success';
  title: string;
  description: string;
  relatedCustomers: string[];
}

/** 完整分析结果 */
export interface RiskAnalysisResult {
  profiles: CustomerRiskProfile[];
  insights: RiskInsight[];
  highRiskCount: number;
  mediumRiskCount: number;
  churnedCount: number;
  fastGrowingCount: number;
  sharpDecliningCount: number;
}

// ==================== 常量 ====================

/** 最小月单量（过滤噪音） */
const MIN_MONTHLY_VOLUME = 5;
/** 快速增长阈值：环比增长 > 50% */
const FAST_GROWTH_THRESHOLD = 0.5;
/** 严重下滑阈值：环比下滑 > 30% */
const SHARP_DECLINE_THRESHOLD = 0.3;

// ==================== 核心函数 ====================

/**
 * 从月度槽位构建所有客户的风险画像
 */
export function buildCustomerProfiles(
  monthSlots: MonthSlotWithDetails[],
): CustomerRiskProfile[] {
  const allCustomers = new Set<string>();
  monthSlots.forEach(s => {
    if (!s.hasData) return;
    s.entrustDetails.forEach((_, name) => allCustomers.add(name));
  });

  const profiles: CustomerRiskProfile[] = [];

  for (const name of allCustomers) {
    const monthlyVolumes: (number | null)[] = new Array(12).fill(null);
    const monthlyDetails: (CustomerMonthDetail | null)[] = new Array(12).fill(null);
    let totalVolume = 0;
    let totalAfter17 = 0;
    let totalCrossDate = 0;
    let totalInquiry = 0;
    let totalOrders = 0;
    let docPrepSumAll = 0;
    let docPrepCountAll = 0;

    let latestMonthIndex = -1;
    let prevMonthIndex = -1;

    for (let i = 0; i < 12; i++) {
      const slot = monthSlots[i];
      if (!slot.hasData) continue;
      const detail = slot.entrustDetails.get(name);
      if (detail && detail.total > 0) {
        monthlyVolumes[i] = detail.total;
        monthlyDetails[i] = detail;
        totalVolume += detail.total;
        totalAfter17 += detail.after17;
        totalCrossDate += detail.crossDate;
        totalInquiry += detail.inquirySum;
        totalOrders += detail.total;
        docPrepSumAll += detail.docPrepSum;
        docPrepCountAll += detail.docPrepCount;

        if (latestMonthIndex === -1 || i > latestMonthIndex) {
          prevMonthIndex = latestMonthIndex;
          latestMonthIndex = i;
        }
      }
    }

    // 跳过总量太小的客户（噪音）
    if (totalOrders < MIN_MONTHLY_VOLUME) continue;

    // 环比增长率
    let growthRate: number | null = null;
    if (latestMonthIndex >= 0 && prevMonthIndex >= 0) {
      const latest = monthlyVolumes[latestMonthIndex]!;
      const prev = monthlyVolumes[prevMonthIndex]!;
      if (prev > 0) {
        growthRate = (latest - prev) / prev;
      }
    }

    const after17Ratio = totalOrders > 0 ? totalAfter17 / totalOrders : 0;
    const crossDateRatio = totalOrders > 0 ? totalCrossDate / totalOrders : 0;
    const avgInquiry = totalOrders > 0 ? totalInquiry / totalOrders : 0;
    const avgDocPrepMin = docPrepCountAll > 0
      ? (docPrepSumAll / docPrepCountAll) / 60
      : 0;

    const riskScore = calcRiskScore({
      after17Ratio,
      crossDateRatio,
      avgInquiry,
      avgDocPrepMin,
      growthRate,
    });

    const riskLevel = scoreToLevel(riskScore);

    const tags = buildTags({
      growthRate,
      riskLevel,
      after17Ratio,
      crossDateRatio,
      avgInquiry,
    });

    profiles.push({
      name,
      monthlyVolumes,
      latestMonthIndex,
      prevMonthIndex,
      totalVolume,
      growthRate,
      after17Ratio,
      crossDateRatio,
      avgInquiry,
      totalInquiry,
      avgDocPrepMin,
      riskScore,
      riskLevel,
      monthlyDetails,
      tags,
    });
  }

  // 按总委托量降序排列
  profiles.sort((a, b) => b.totalVolume - a.totalVolume);

  return profiles;
}

/**
 * 计算综合风险评分
 */
export function calcRiskScore(params: {
  after17Ratio: number;
  crossDateRatio: number;
  avgInquiry: number;
  avgDocPrepMin: number;
  growthRate: number | null;
}): number {
  let score = 0;

  // 17点后占比过高 → 有赶单风险
  if (params.after17Ratio > 0.5) score += 25;
  else if (params.after17Ratio > 0.3) score += 15;
  else if (params.after17Ratio > 0.15) score += 8;

  // 跨日制单占比高 → 流程积压风险
  if (params.crossDateRatio > 0.2) score += 25;
  else if (params.crossDateRatio > 0.1) score += 15;
  else if (params.crossDateRatio > 0.05) score += 8;

  // 问询频繁 → 数据质量/沟通成本高
  if (params.avgInquiry > 3) score += 20;
  else if (params.avgInquiry > 2) score += 15;
  else if (params.avgInquiry > 1) score += 8;

  // 制单耗时过长
  if (params.avgDocPrepMin > 180) score += 15;      // > 3小时
  else if (params.avgDocPrepMin > 120) score += 10;  // > 2小时
  else if (params.avgDocPrepMin > 60) score += 5;    // > 1小时

  // 业务量严重下滑
  if (params.growthRate !== null && params.growthRate < -0.5) score += 15;
  else if (params.growthRate !== null && params.growthRate < -0.3) score += 10;

  return Math.min(100, score);
}

function scoreToLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'critical';
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}

function buildTags(params: {
  growthRate: number | null;
  riskLevel: string;
  after17Ratio: number;
  crossDateRatio: number;
  avgInquiry: number;
}): string[] {
  const tags: string[] = [];
  if (params.growthRate !== null && params.growthRate > FAST_GROWTH_THRESHOLD) tags.push('快速增长');
  if (params.growthRate !== null && params.growthRate < -SHARP_DECLINE_THRESHOLD) tags.push('严重下滑');
  if (params.after17Ratio > 0.3) tags.push('晚间下单多');
  if (params.crossDateRatio > 0.1) tags.push('跨日制单多');
  if (params.avgInquiry > 2) tags.push('问询频繁');
  return tags;
}

// ==================== 洞察生成 ====================

/**
 * 生成自然语言风控洞察
 */
export function generateRiskInsights(
  profiles: CustomerRiskProfile[],
): RiskInsight[] {
  const insights: RiskInsight[] = [];

  // 1. 流失检测：前几月在 TOP10，最后一月跌出 TOP20
  const churned = detectChurned(profiles);
  if (churned.length > 0) {
    const names = churned.map(c => c.name);
    insights.push({
      type: 'churn',
      severity: 'error',
      title: `⚠️ 客户流失预警：${churned.length} 家重点客户业务量明显下降`,
      description: `${names.slice(0, 5).join('、')}${names.length > 5 ? `等 ${names.length} 家` : ''} 此前位列月度 TOP10，但在最近一个月已跌出 TOP20。这些客户的业务可能在流失，建议销售/客服跟进确认原因，排查是否存在服务质量问题或竞争对手撬单。`,
      relatedCustomers: names,
    });
  }

  // 2. 快速增长
  const fastGrowers = detectFastGrowers(profiles);
  if (fastGrowers.length > 0) {
    // 进一步筛选：快速增长 + 有风险标签的
    const riskyGrowers = fastGrowers.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical');
    const healthyGrowers = fastGrowers.filter(c => c.riskLevel === 'low' || c.riskLevel === 'medium');

    if (riskyGrowers.length > 0) {
      const names = riskyGrowers.map(c => c.name);
      const details = riskyGrowers.map(c => {
        const parts: string[] = [];
        if (c.growthRate !== null) parts.push(`环比增长 ${(c.growthRate * 100).toFixed(0)}%`);
        if (c.after17Ratio > 0.3) parts.push(`${(c.after17Ratio * 100).toFixed(0)}% 订单在 17:00 后`);
        if (c.crossDateRatio > 0.1) parts.push(`${(c.crossDateRatio * 100).toFixed(0)}% 跨日制单`);
        return `${c.name}(${parts.join('，')})`;
      });
      insights.push({
        type: 'growth',
        severity: 'warning',
        title: `⚡ 快速增长 + 风险叠加：${riskyGrowers.length} 家客户需重点关注`,
        description: `以下客户业务量快速增长，但存在风险信号，需警惕"量升质降"：${details.join('；')}。建议对这些客户加强流程管控，提前调配资源，避免因赶单导致制单质量下降。`,
        relatedCustomers: names,
      });
    }

    if (healthyGrowers.length > 0) {
      const names = healthyGrowers.map(c => c.name);
      insights.push({
        type: 'growth',
        severity: 'info',
        title: `📈 业务增长良好：${healthyGrowers.length} 家客户稳健增长`,
        description: `${names.slice(0, 5).join('、')}${names.length > 5 ? `等 ${names.length} 家` : ''} 最近月业务量环比大幅增长，且当前风险指标在可控范围内，属于健康增长。建议保持现有服务水平，适时了解客户是否有新增业务线可挖掘。`,
        relatedCustomers: names,
      });
    }
  }

  // 3. 严重下滑
  const decliners = detectSharpDecliners(profiles);
  if (decliners.length > 0) {
    const names = decliners.map(c => c.name);
    const details = decliners.map(c => {
      let detail = c.name;
      if (c.growthRate !== null) detail += `(环比 ${(c.growthRate * 100).toFixed(0)}%)`;
      return detail;
    });
    insights.push({
      type: 'decline',
      severity: 'warning',
      title: `📉 业务下滑警示：${decliners.length} 家客户委托量大幅缩减`,
      description: `${details.join('、')}。这些客户近两月业务量下滑超过 ${(SHARP_DECLINE_THRESHOLD * 100).toFixed(0)}%，建议尽快了解原因——是客户业务季节性波动、转向其他报关行、还是服务质量问题导致流失？建议安排客户回访。`,
      relatedCustomers: names,
    });
  }

  // 4. 高风险客户（不限于增长/下滑）
  const highRiskProfiles = profiles.filter(
    c => (c.riskLevel === 'high' || c.riskLevel === 'critical') && c.totalVolume >= 20,
  );
  if (highRiskProfiles.length > 0) {
    const topRisks = highRiskProfiles.slice(0, 8);
    const details = topRisks.map(c => {
      const riskFactors: string[] = [];
      if (c.after17Ratio > 0.3) riskFactors.push('晚间下单');
      if (c.crossDateRatio > 0.1) riskFactors.push('跨日制单');
      if (c.avgInquiry > 2) riskFactors.push('问询频繁');
      if (c.avgDocPrepMin > 120) riskFactors.push('制单耗时');
      return `${c.name}(风险分${c.riskScore}：${riskFactors.join('+') || '综合'})`;
    });
    insights.push({
      type: 'high_risk',
      severity: 'error',
      title: `🔴 综合高风险客户 TOP${topRisks.length}`,
      description: `${details.join('；')}。以上客户的综合风险评分较高，存在一项或多项风险因子超标。建议逐家制定改善计划——如提前截单时间、优化制单流程、加强数据预审以减少问询。`,
      relatedCustomers: topRisks.map(c => c.name),
    });
  }

  // 5. 全景概要
  const top5 = profiles.slice(0, 5);
  const top5Summary = top5.map(c => {
    const trend = c.growthRate !== null
      ? (c.growthRate > 0 ? `↑${(c.growthRate * 100).toFixed(0)}%` : `↓${(Math.abs(c.growthRate) * 100).toFixed(0)}%`)
      : '—';
    return `${c.name}(${c.totalVolume}单 ${trend})`;
  });
  const riskCount = profiles.filter(c => c.riskLevel === 'high' || c.riskLevel === 'critical').length;
  insights.push({
    type: 'healthy',
    severity: 'success',
    title: `📊 全景概览：覆盖 ${profiles.length} 家委托企业，识别 ${riskCount} 家需关注`,
    description: `业务量 TOP5：${top5Summary.join('、')}。整体来看，${riskCount > 0 ? `有 ${riskCount} 家客户存在不同程度的风险信号需要关注` : '当前各重点客户风险指标均在可控范围'}。建议每月定期回顾此面板，持续跟踪重点客户健康度。`,
    relatedCustomers: top5.map(c => c.name),
  });

  return insights;
}

// ==================== 检测函数 ====================

/**
 * 识别流失客户：前几月在 TOP10，最近月跌出 TOP20
 */
function detectChurned(profiles: CustomerRiskProfile[]): CustomerRiskProfile[] {
  const churned: CustomerRiskProfile[] = [];

  for (const profile of profiles) {
    // 至少有两个月有数据
    const monthsWithData = profile.monthlyVolumes
      .map((v, i) => (v !== null ? i : -1))
      .filter(i => i >= 0);
    if (monthsWithData.length < 2) continue;

    const latestMonth = monthsWithData[monthsWithData.length - 1];
    const earlierMonths = monthsWithData.slice(0, -1);

    // 此前任一月的量 >= 该月总客户中位数 * 某个系数（简化：用>=15单作为"有规模"门槛）
    const hadScale = earlierMonths.some(m => (profile.monthlyVolumes[m] ?? 0) >= 15);
    if (!hadScale) continue;

    // 最近月量显著下降
    const latestVol = profile.monthlyVolumes[latestMonth] ?? 0;
    const maxEarlier = Math.max(...earlierMonths.map(m => profile.monthlyVolumes[m] ?? 0));

    if (maxEarlier >= 15 && latestVol < maxEarlier * 0.3) {
      churned.push(profile);
    }
  }

  return churned;
}

/**
 * 识别快速增长客户
 */
function detectFastGrowers(profiles: CustomerRiskProfile[]): CustomerRiskProfile[] {
  return profiles.filter(p => {
    if (p.growthRate === null) return false;
    // 增长率 > 50% 且最近月有足够量级
    return p.growthRate > FAST_GROWTH_THRESHOLD
      && (p.monthlyVolumes[p.latestMonthIndex] ?? 0) >= MIN_MONTHLY_VOLUME;
  });
}

/**
 * 识别严重下滑客户
 */
function detectSharpDecliners(profiles: CustomerRiskProfile[]): CustomerRiskProfile[] {
  return profiles.filter(p => {
    if (p.growthRate === null) return false;
    // 下滑 > 30% 且前一个月有足够量级（排除小基数波动）
    return p.growthRate < -SHARP_DECLINE_THRESHOLD
      && (p.monthlyVolumes[p.prevMonthIndex] ?? 0) >= MIN_MONTHLY_VOLUME;
  });
}

// ==================== 辅助函数 ====================

/** 获取风险等级对应的颜色 */
export function riskLevelColor(level: string): string {
  switch (level) {
    case 'critical': return '#a8071a';  // 深红
    case 'high': return '#cf1322';       // 红
    case 'medium': return '#d48806';     // 橙
    case 'low': return '#389e0d';        // 绿
    default: return '#666';
  }
}

/** 格式化百分比 */
export function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

/** 格式化分钟 */
export function fmtMin(v: number): string {
  if (v < 60) return `${Math.round(v)}分钟`;
  return `${(v / 60).toFixed(1)}小时`;
}

/** 格式化环比 */
export function fmtGrowth(v: number | null): string {
  if (v === null) return '—';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(0)}%`;
}
