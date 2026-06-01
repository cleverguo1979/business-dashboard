/**
 * 标准化业务报关单 - 跨月度横向对比，X轴固定1-12月
 */
import React, { useMemo, useState } from 'react';
import { Card, Row, Col, Tag, Space, Empty, Select, Alert, Table, Progress } from 'antd';
import { BarChartOutlined, ClockCircleOutlined, AlertOutlined, ExportOutlined, ImportOutlined, SafetyOutlined, RiseOutlined, WarningOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useDataStore } from '../store/dataStore';
import {
  buildCustomerProfiles,
  generateRiskInsights,
  riskLevelColor,
  fmtPct,
  fmtMin,
  fmtGrowth,
} from '../utils/customerRiskAnalyzer';
import type { CustomerMonthDetail, MonthSlotWithDetails, CustomerRiskProfile } from '../utils/customerRiskAnalyzer';

function parseTime(s: string): Date | null { if(!s)return null; const d=new Date(s.replace(' ','T')); return isNaN(d.getTime())?null:d; }
function fmtSec(s: number): string { if(s<60)return `${Math.round(s)}秒`; if(s<3600)return `${(s/60).toFixed(1)}分`; return `${(s/3600).toFixed(1)}时`; }

const ALL_MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const C = ['#1677ff','#52c41a','#fa8c16','#f5222d','#722ed1','#13c2c2'];

function extractMonth(name: string): number|null {
  const m=name.match(/(\d{4})[-/](\d{1,2})/); if(m)return parseInt(m[2],10);
  const m2=name.match(/(\d{1,2})月/); if(m2)return parseInt(m2[1],10);
  return null;
}

function avg(arr: number[]): number { return arr.length>0?arr.reduce((a,b)=>a+b,0)/arr.length:0; }

interface ImpExpStats { acceptAll: number[]; acceptClean: number[]; docAll: number[]; docClean: number[]; }
interface MonthSlot {
  total: number; crossDate: number; after17: number;
  exp: ImpExpStats; imp: ImpExpStats;
  entrustCounts: Map<string,number>; hasData: boolean;
  entrustDetails: Map<string, CustomerMonthDetail>;
}
function emptyStats(): ImpExpStats { return { acceptAll:[],acceptClean:[],docAll:[],docClean:[] }; }
function emptyDetail(): CustomerMonthDetail { return { total:0, after17:0, crossDate:0, inquirySum:0, docPrepSum:0, docPrepCount:0 }; }
function emptySlot(): MonthSlot { return { total:0,crossDate:0,after17:0,exp:emptyStats(),imp:emptyStats(),entrustCounts:new Map(),hasData:false,entrustDetails:new Map() }; }

function buildTimeLine(data: (number|null)[], name: string, color: string, isClean?: boolean): any {
  return { name, type:'line', data, smooth:true, symbol: isClean?'diamond':'circle', symbolSize:6,
    label:{ show:true, formatter:(p:any)=>fmtSec(p.value), fontSize:9 },
    itemStyle:{ color }, lineStyle:{ color } };
}

function makeTimeChart(series: any[]): EChartsOption {
  return {
    color: [C[0],C[1]], tooltip:{ trigger:'axis', formatter:(p:any)=>{ const a=Array.isArray(p)?p:[p]; return a.map((d:any)=>`${d.seriesName}: ${fmtSec(d.value)}`).join('<br/>'); }},
    legend:{ bottom:0, textStyle:{ fontSize:10 } },
    grid:{ left:45, right:15, top:15, bottom:40 },
    xAxis:{ type:'category', data:ALL_MONTHS, axisLabel:{ fontSize:10 } },
    yAxis:{ type:'value', name:'耗时', axisLabel:{ formatter:(v:number)=>fmtSec(v), fontSize:10 } },
    series,
  };
}

export const OverviewPage: React.FC = () => {
  const dataSets = useDataStore(s => s.dataSets);
  const [selectedEntrust, setSelectedEntrust] = useState('');

  const monthSlots = useMemo((): MonthSlot[] => {
    const slots: MonthSlot[] = Array.from({length:12}, ()=>emptySlot());
    for(const ds of dataSets){
      const month = extractMonth(ds.name); if(month===null||month<1||month>12) continue;
      const s = slots[month-1]; s.hasData = true;
      const entrustCounts = new Map<string,number>();
      const entrustDetails = new Map<string, CustomerMonthDetail>();
      s.total = ds.records.length;
      for(const r of ds.records){
        const entrust = r['委托企业']||'(空)'; entrustCounts.set(entrust,(entrustCounts.get(entrust)||0)+1);
        // 每客户月度明细
        if(!entrustDetails.has(entrust)) entrustDetails.set(entrust, emptyDetail());
        const ed = entrustDetails.get(entrust)!; ed.total++;

        const ot=parseTime(r['业务下单时间']), at=parseTime(r['接单时间']), rt=parseTime(r['首次提交复核时间']);
        const isCross=ot&&rt?ot.toDateString()!==rt.toDateString():false;
        const rawType = (r['进/口类型']||'').toString().trim();
        const isExp = rawType==='E'; const isImp = rawType==='I';
        const stats = isExp ? s.exp : isImp ? s.imp : null;
        if(ot){ if(ot.getHours()>=17) { s.after17++; ed.after17++; } }
        if(ot&&at){ const d=(at.getTime()-ot.getTime())/1000; if(d>=0){ if(stats) stats.acceptAll.push(d); if(!isCross&&stats) stats.acceptClean.push(d); } }
        if(ot&&rt){ const d=(rt.getTime()-ot.getTime())/1000; if(d>=0){ if(stats) stats.docAll.push(d); if(!isCross&&stats) stats.docClean.push(d); ed.docPrepSum+=d; ed.docPrepCount++; } if(isCross) { s.crossDate++; ed.crossDate++; } }
        // 问询次数
        const inquiry = parseInt(r['问询次数']) || 0; ed.inquirySum += inquiry;
      }
      s.entrustDetails = entrustDetails;
      s.entrustCounts = entrustCounts;
    }
    return slots;
  }, [dataSets]);

  const hasData = monthSlots.some(s=>s.hasData);
  const allEntrusts = useMemo(()=>{ const set=new Set<string>(); monthSlots.forEach(s=>s.entrustCounts.forEach((_,k)=>set.add(k))); return [...set].sort(); },[monthSlots]);
  const selectedEntrustData = useMemo(()=>!selectedEntrust?[]:monthSlots.map(s=>s.hasData?(s.entrustCounts.get(selectedEntrust)||0):null),[monthSlots,selectedEntrust]);

  // TOP10 委托企业（跨月总委托量排名）
  const entrustTop10 = useMemo(() => {
    const totals = new Map<string,number>();
    monthSlots.forEach(s => s.entrustCounts.forEach((c, name) => totals.set(name, (totals.get(name)||0)+c)));
    return [...totals.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10);
  }, [monthSlots]);
  const entrustTop10Chart = useMemo(():EChartsOption => ({
    color: [C[1]],
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: 140, right: 50, top: 5, bottom: 20 },
    xAxis: { type: 'value', name: '委托量' },
    yAxis: { type: 'category', data: entrustTop10.map(e => e[0]).reverse(), axisLabel: { fontSize: 10, width: 130, overflow: 'truncate' } },
    series: [{ type: 'bar', data: entrustTop10.map(e => e[1]).reverse(), itemStyle: { borderRadius: [0, 4, 4, 0] }, label: { show: true, position: 'right', fontSize: 11 } }],
  }), [entrustTop10]);

  const nullIf = (has:boolean, v:number)=>has?v:null;

  // 图1：标准化业务报关单月度总量
  const volChart = useMemo(():EChartsOption=>({
    color:[C[0]], tooltip:{trigger:'axis'}, grid:{left:45,right:15,top:15,bottom:35},
    xAxis:{type:'category',data:ALL_MONTHS,axisLabel:{fontSize:10}}, yAxis:{type:'value',name:'单量'},
    series:[{name:'标准化报关单量',type:'line',data:monthSlots.map(s=>nullIf(s.hasData,s.total)),smooth:true,symbol:'circle',symbolSize:6,label:{show:true,fontSize:10}}],
  }),[monthSlots]);

  // 图2：委托企业
  const entChart = useMemo(():EChartsOption=>({
    color:[C[1]], tooltip:{trigger:'axis'}, grid:{left:45,right:15,top:15,bottom:35},
    xAxis:{type:'category',data:ALL_MONTHS,axisLabel:{fontSize:10}}, yAxis:{type:'value',name:'单量'},
    series:[{name:selectedEntrust||'请选择企业',type:'line',data:selectedEntrustData,smooth:true,symbol:'circle',symbolSize:8,label:{show:true,fontSize:11,fontWeight:'bold'}}],
  }),[selectedEntrustData,selectedEntrust]);

  // 图3-6：进出口接单/制单 2x2 网格
  const expAcceptOpt = useMemo(()=>makeTimeChart([
    buildTimeLine(monthSlots.map(s=>nullIf(s.hasData,avg(s.exp.acceptAll))),'出口全量',C[0]),
    buildTimeLine(monthSlots.map(s=>nullIf(s.hasData,avg(s.exp.acceptClean))),'出口剔除',C[1],true),
  ]),[monthSlots]);
  const impAcceptOpt = useMemo(()=>makeTimeChart([
    buildTimeLine(monthSlots.map(s=>nullIf(s.hasData,avg(s.imp.acceptAll))),'进口全量',C[2]),
    buildTimeLine(monthSlots.map(s=>nullIf(s.hasData,avg(s.imp.acceptClean))),'进口剔除',C[1],true),
  ]),[monthSlots]);
  const expDocOpt = useMemo(()=>makeTimeChart([
    buildTimeLine(monthSlots.map(s=>nullIf(s.hasData,avg(s.exp.docAll))),'出口全量',C[3]),
    buildTimeLine(monthSlots.map(s=>nullIf(s.hasData,avg(s.exp.docClean))),'出口剔除',C[1],true),
  ]),[monthSlots]);
  const impDocOpt = useMemo(()=>makeTimeChart([
    buildTimeLine(monthSlots.map(s=>nullIf(s.hasData,avg(s.imp.docAll))),'进口全量',C[4]),
    buildTimeLine(monthSlots.map(s=>nullIf(s.hasData,avg(s.imp.docClean))),'进口剔除',C[1],true),
  ]),[monthSlots]);

  // 异常
  const crossChart = useMemo(():EChartsOption=>({
    color:[C[3]], tooltip:{trigger:'axis'}, grid:{left:45,right:15,top:15,bottom:35},
    xAxis:{type:'category',data:ALL_MONTHS,axisLabel:{fontSize:10}}, yAxis:{type:'value',name:'单量'},
    series:[{name:'跨日制单',type:'bar',data:monthSlots.map(s=>nullIf(s.hasData,s.crossDate)),itemStyle:{borderRadius:[4,4,0,0]},label:{show:true,position:'top',fontSize:10}}],
  }),[monthSlots]);
  const a17Chart = useMemo(():EChartsOption=>({
    color:[C[4]], tooltip:{trigger:'axis'}, grid:{left:45,right:15,top:15,bottom:35},
    xAxis:{type:'category',data:ALL_MONTHS,axisLabel:{fontSize:10}}, yAxis:{type:'value',name:'单量'},
    series:[{name:'17:00后下单',type:'bar',data:monthSlots.map(s=>nullIf(s.hasData,s.after17)),itemStyle:{borderRadius:[4,4,0,0]},label:{show:true,position:'top',fontSize:10}}],
  }),[monthSlots]);

  // ==================== 智能风控分析 ====================
  const customerProfiles = useMemo(() => {
    return buildCustomerProfiles(monthSlots as MonthSlotWithDetails[]);
  }, [monthSlots]);

  const riskInsights = useMemo(() => {
    return generateRiskInsights(customerProfiles);
  }, [customerProfiles]);

  // 风控表格数据：TOP20 客户 + 风险指标
  const riskTableData = useMemo(() => {
    return customerProfiles.slice(0, 20).map((p, i) => ({
      key: p.name,
      rank: i + 1,
      ...p,
    }));
  }, [customerProfiles]);

  const riskStats = useMemo(() => {
    const highRisk = customerProfiles.filter(p => p.riskLevel === 'high' || p.riskLevel === 'critical').length;
    const mediumRisk = customerProfiles.filter(p => p.riskLevel === 'medium').length;
    const fastGrowing = customerProfiles.filter(p => p.tags.includes('快速增长')).length;
    const declining = customerProfiles.filter(p => p.tags.includes('严重下滑')).length;
    return { highRisk, mediumRisk, fastGrowing, declining, total: customerProfiles.length };
  }, [customerProfiles]);

  if(!hasData) return <Empty style={{marginTop:100}} description="请先导入数据（数据集名需含月份，如 2026-04）"/>;

  return (
    <div>
      <Card size="small" style={{marginBottom:12}}>
        <Space><span style={{fontWeight:600,fontSize:15}}>标准化业务报关单 月度横向对比</span><Tag color="blue">{dataSets.length} 个月份</Tag></Space>
      </Card>

      <Card title={<Space><BarChartOutlined/>标准化业务月度总量</Space>} size="small" style={{marginBottom:12}}>
        <ReactECharts option={volChart} style={{height:250}}/>
      </Card>

      <Card title={<Space><BarChartOutlined/>委托企业 跨月总委托量 TOP10</Space>} size="small" style={{marginBottom:12}}>
        <ReactECharts option={entrustTop10Chart} style={{height: 280}}/>
      </Card>

      <Card title={<Space><BarChartOutlined/>委托企业月度委托量（单选查看）</Space>} size="small" style={{marginBottom:12}}
        extra={<Select size="small" style={{width:240}} value={selectedEntrust||undefined} placeholder="选择一家委托企业" showSearch optionFilterProp="label" onChange={v=>setSelectedEntrust(v)} options={allEntrusts.map(e=>({label:e,value:e}))}/>}>
        {selectedEntrust ? <ReactECharts option={entChart} style={{height:250}}/> : <Empty description="请选择一家委托企业" style={{padding:30}}/>}
      </Card>

      {/* 进出口接单耗时 2x2 */}
      <Card title={<Space><ClockCircleOutlined/>平均接单耗时（进出口拆分）</Space>} size="small" style={{marginBottom:12}}>
        <Row gutter={[12,12]}>
          <Col xs={24} lg={12}><Card size="small" title={<span><ExportOutlined style={{color:C[0]}}/> 出口</span>}><ReactECharts option={expAcceptOpt} style={{height:250}}/></Card></Col>
          <Col xs={24} lg={12}><Card size="small" title={<span><ImportOutlined style={{color:C[2]}}/> 进口</span>}><ReactECharts option={impAcceptOpt} style={{height:250}}/></Card></Col>
        </Row>
      </Card>

      {/* 进出口制单时长 2x2 */}
      <Card title={<Space><ClockCircleOutlined/>平均制单时长（进出口拆分）</Space>} size="small" style={{marginBottom:12}}>
        <Row gutter={[12,12]}>
          <Col xs={24} lg={12}><Card size="small" title={<span><ExportOutlined style={{color:C[3]}}/> 出口</span>}><ReactECharts option={expDocOpt} style={{height:250}}/></Card></Col>
          <Col xs={24} lg={12}><Card size="small" title={<span><ImportOutlined style={{color:C[4]}}/> 进口</span>}><ReactECharts option={impDocOpt} style={{height:250}}/></Card></Col>
        </Row>
      </Card>

      <Row gutter={[12,12]}>
        <Col xs={24} lg={12}>
          <Card title={<Space><AlertOutlined style={{color:'#fa8c16'}}/>跨日制单</Space>} size="small">
            <ReactECharts option={crossChart} style={{height:250}}/>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={<Space><AlertOutlined style={{color:'#f5222d'}}/>17:00后下单</Space>} size="small">
            <ReactECharts option={a17Chart} style={{height:250}}/>
          </Card>
        </Col>
      </Row>

      {/* ==================== 智能风控分析 ==================== */}
      <Card
        size="small"
        style={{ marginTop: 12, marginBottom: 12, borderLeft: '4px solid #722ed1' }}
        title={
          <Space>
            <SafetyOutlined style={{ color: '#722ed1' }} />
            <span style={{ fontWeight: 600, fontSize: 15 }}>智能风控分析</span>
            <Tag color="purple">AI 推理</Tag>
            <Tag color="processing">{riskStats.total} 家企业</Tag>
            {riskStats.highRisk > 0 && <Tag color="error">{riskStats.highRisk} 家高风险</Tag>}
            {riskStats.fastGrowing > 0 && <Tag color="orange">↑{riskStats.fastGrowing} 家增长</Tag>}
            {riskStats.declining > 0 && <Tag color="warning">↓{riskStats.declining} 家下滑</Tag>}
          </Space>
        }
      >
        {/* 风控洞察面板 */}
        <div style={{ marginBottom: 12 }}>
          {riskInsights.map((insight, idx) => {
            const iconMap: Record<string, React.ReactNode> = {
              error: <WarningOutlined />,
              warning: <AlertOutlined />,
              info: <RiseOutlined />,
              success: <BarChartOutlined />,
            };
            return (
              <Alert
                key={idx}
                type={insight.severity}
                icon={iconMap[insight.severity]}
                message={<strong>{insight.title}</strong>}
                description={<div style={{ fontSize: 13, lineHeight: 1.8 }}>{insight.description}</div>}
                style={{ marginBottom: 8 }}
                showIcon
              />
            );
          })}
        </div>

        {/* 风险指标概览卡片 */}
        <Row gutter={[12,12]} style={{ marginBottom: 12 }}>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ background: '#fff7e6', borderColor: '#ffa940' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#d46b08' }}>{riskStats.highRisk}</div>
                <div style={{ fontSize: 12, color: '#666' }}>高风险客户</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ background: '#fff2e8', borderColor: '#ff7a45' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#d4380d' }}>{riskStats.declining}</div>
                <div style={{ fontSize: 12, color: '#666' }}>严重下滑</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ background: '#f6ffed', borderColor: '#95de64' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#389e0d' }}>{riskStats.fastGrowing}</div>
                <div style={{ fontSize: 12, color: '#666' }}>快速增长</div>
              </div>
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small" style={{ background: '#e6f7ff', borderColor: '#69c0ff' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#096dd9' }}>{riskStats.mediumRisk}</div>
                <div style={{ fontSize: 12, color: '#666' }}>中风险关注</div>
              </div>
            </Card>
          </Col>
        </Row>

        {/* 客户风险明细表 */}
        <Card
          size="small"
          title={<Space><SafetyOutlined style={{ color: '#722ed1' }} />重点客户风险明细 TOP20</Space>}
          style={{ background: '#fafafa', marginTop: 12 }}
        >
          <Table<CustomerRiskProfile & { rank: number }>
            dataSource={riskTableData}
            size="small"
            pagination={false}
            scroll={{ x: 900 }}
            columns={[
              { title: '#', dataIndex: 'rank', width: 36, align: 'center' },
              {
                title: '委托企业', dataIndex: 'name', width: 160, ellipsis: true,
                render: (v: string) => <span style={{ fontWeight: 500 }}>{v}</span>,
              },
              {
                title: '总委托量', dataIndex: 'totalVolume', width: 80, align: 'right',
                sorter: (a: CustomerRiskProfile, b: CustomerRiskProfile) => b.totalVolume - a.totalVolume,
                defaultSortOrder: 'descend' as const,
              },
              {
                title: '最近月', dataIndex: 'latestMonthIndex', width: 72, align: 'center',
                render: (_: number, r: CustomerRiskProfile) => {
                  const v = r.latestMonthIndex >= 0 ? r.monthlyVolumes[r.latestMonthIndex] : null;
                  return v !== null ? v : '—';
                },
              },
              {
                title: '环比', dataIndex: 'growthRate', width: 72, align: 'center',
                render: (v: number | null) => {
                  if (v === null) return <span style={{ color: '#999' }}>—</span>;
                  const color = v >= 0 ? (v > 0.5 ? '#cf1322' : '#389e0d') : '#cf1322';
                  const icon = v >= 0 ? '↑' : '↓';
                  return <span style={{ color, fontWeight: 600 }}>{icon}{fmtGrowth(v)}</span>;
                },
                sorter: (a: CustomerRiskProfile, b: CustomerRiskProfile) => (a.growthRate ?? -Infinity) - (b.growthRate ?? -Infinity),
              },
              {
                title: '17点后占比', dataIndex: 'after17Ratio', width: 90, align: 'center',
                render: (v: number) => (
                  <Tag color={v > 0.3 ? 'error' : v > 0.15 ? 'warning' : 'success'}>{fmtPct(v)}</Tag>
                ),
                sorter: (a: CustomerRiskProfile, b: CustomerRiskProfile) => a.after17Ratio - b.after17Ratio,
              },
              {
                title: '跨日占比', dataIndex: 'crossDateRatio', width: 84, align: 'center',
                render: (v: number) => (
                  <Tag color={v > 0.1 ? 'error' : v > 0.05 ? 'warning' : 'success'}>{fmtPct(v)}</Tag>
                ),
                sorter: (a: CustomerRiskProfile, b: CustomerRiskProfile) => a.crossDateRatio - b.crossDateRatio,
              },
              {
                title: '问询次数', dataIndex: 'totalInquiry', width: 80, align: 'center',
                render: (v: number) => {
                  const color = v > 20 ? '#cf1322' : v > 10 ? '#d48806' : '#389e0d';
                  return <span style={{ color, fontWeight: 500 }}>{v}次</span>;
                },
                sorter: (a: CustomerRiskProfile, b: CustomerRiskProfile) => a.totalInquiry - b.totalInquiry,
              },
              {
                title: '制单时长', dataIndex: 'avgDocPrepMin', width: 80, align: 'center',
                render: (v: number) => <span>{fmtMin(v)}</span>,
                sorter: (a: CustomerRiskProfile, b: CustomerRiskProfile) => a.avgDocPrepMin - b.avgDocPrepMin,
              },
              {
                title: '风险评分', dataIndex: 'riskScore', width: 140, align: 'center',
                render: (v: number) => {
                  const color = riskLevelColor(v >= 80 ? 'critical' : v >= 60 ? 'high' : v >= 30 ? 'medium' : 'low');
                  const label = v >= 80 ? '严重' : v >= 60 ? '高风险' : v >= 30 ? '中风险' : '低风险';
                  return (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Progress
                        percent={v}
                        size="small"
                        strokeColor={color}
                        showInfo={false}
                        style={{ width: 80, margin: 0 }}
                      />
                      <Tag color={v >= 80 ? 'red' : v >= 60 ? 'error' : v >= 30 ? 'warning' : 'success'} style={{ margin: 0 }}>
                        {label}
                      </Tag>
                    </div>
                  );
                },
                sorter: (a: CustomerRiskProfile, b: CustomerRiskProfile) => a.riskScore - b.riskScore,
              },
              {
                title: '标签', dataIndex: 'tags', width: 140,
                render: (tags: string[]) => (
                  <Space size={[2, 2]} wrap>
                    {tags.map(t => {
                      const colorMap: Record<string, string> = {
                        '快速增长': 'green',
                        '严重下滑': 'red',
                        '晚间下单多': 'orange',
                        '跨日制单多': 'volcano',
                        '问询频繁': 'purple',
                      };
                      return <Tag key={t} color={colorMap[t] || 'default'} style={{ fontSize: 11 }}>{t}</Tag>;
                    })}
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      </Card>
    </div>
  );
};
