/**
 * 总分析看板 - 跨月度横向对比，X轴固定1-12月
 */
import React, { useMemo, useState } from 'react';
import { Card, Row, Col, Tag, Space, Empty, Select } from 'antd';
import { BarChartOutlined, ClockCircleOutlined, AlertOutlined, ExportOutlined, ImportOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useDataStore } from '../store/dataStore';

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
}
function emptyStats(): ImpExpStats { return { acceptAll:[],acceptClean:[],docAll:[],docClean:[] }; }
function emptySlot(): MonthSlot { return { total:0,crossDate:0,after17:0,exp:emptyStats(),imp:emptyStats(),entrustCounts:new Map(),hasData:false }; }

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
      for(const r of ds.records){
        const entrust = r['委托企业']||'(空)'; entrustCounts.set(entrust,(entrustCounts.get(entrust)||0)+1);
        const ot=parseTime(r['业务下单时间']), at=parseTime(r['接单时间']), rt=parseTime(r['首次提交复核时间']);
        const isCross=ot&&rt?ot.toDateString()!==rt.toDateString():false;
        const isExp = (r['进/口类型']||'').toString().trim()==='E';
        const isImp = (r['进/口类型']||'').toString().trim()==='I';
        const stats = isExp ? s.exp : isImp ? s.imp : null;
        if(ot){ if(ot.getHours()>=17) s.after17++; }
        if(ot&&at){ const d=(at.getTime()-ot.getTime())/1000; if(d>=0){ s.total++; if(stats){ stats.acceptAll.push(d); if(!isCross) stats.acceptClean.push(d); } } }
        if(ot&&rt){ const d=(rt.getTime()-ot.getTime())/1000; if(d>=0){ if(stats){ stats.docAll.push(d); if(!isCross) stats.docClean.push(d); } } if(isCross) s.crossDate++; }
      }
      s.entrustCounts = entrustCounts;
    }
    return slots;
  }, [dataSets]);

  const hasData = monthSlots.some(s=>s.hasData);
  const allEntrusts = useMemo(()=>{ const set=new Set<string>(); monthSlots.forEach(s=>s.entrustCounts.forEach((_,k)=>set.add(k))); return [...set].sort(); },[monthSlots]);
  const selectedEntrustData = useMemo(()=>!selectedEntrust?[]:monthSlots.map(s=>s.hasData?(s.entrustCounts.get(selectedEntrust)||0):null),[monthSlots,selectedEntrust]);

  const nullIf = (has:boolean, v:number)=>has?v:null;

  // 图1：业务总量
  const volChart = useMemo(():EChartsOption=>({
    color:[C[0]], tooltip:{trigger:'axis'}, grid:{left:45,right:15,top:15,bottom:35},
    xAxis:{type:'category',data:ALL_MONTHS,axisLabel:{fontSize:10}}, yAxis:{type:'value',name:'单量'},
    series:[{name:'业务总量',type:'line',data:monthSlots.map(s=>nullIf(s.hasData,s.total)),smooth:true,symbol:'circle',symbolSize:6,label:{show:true,fontSize:10}}],
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

  if(!hasData) return <Empty style={{marginTop:100}} description="请先导入数据（数据集名需含月份，如 2026-04）"/>;

  return (
    <div>
      <Card size="small" style={{marginBottom:12}}>
        <Space><span style={{fontWeight:600,fontSize:15}}>总分析 - 1~12月横向对比</span><Tag color="blue">{dataSets.length} 个月份</Tag></Space>
      </Card>

      <Card title={<Space><BarChartOutlined/>月度业务总量</Space>} size="small" style={{marginBottom:10}}>
        <ReactECharts option={volChart} style={{height:250}}/>
      </Card>

      <Card title={<Space><BarChartOutlined/>委托企业月度业务量</Space>} size="small" style={{marginBottom:10}}
        extra={<Select size="small" style={{width:240}} value={selectedEntrust||undefined} placeholder="选择委托企业" showSearch optionFilterProp="label" onChange={v=>setSelectedEntrust(v)} options={allEntrusts.map(e=>({label:e,value:e}))}/>}>
        {selectedEntrust ? <ReactECharts option={entChart} style={{height:250}}/> : <Empty description="请选择一家委托企业" style={{padding:30}}/>}
      </Card>

      {/* 进出口接单耗时 2x2 */}
      <Card title={<Space><ClockCircleOutlined/>平均接单耗时（进出口拆分）</Space>} size="small" style={{marginBottom:10}}>
        <Row gutter={[10,10]}>
          <Col xs={24} lg={12}><Card size="small" title={<span><ExportOutlined style={{color:C[0]}}/> 出口</span>}><ReactECharts option={expAcceptOpt} style={{height:250}}/></Card></Col>
          <Col xs={24} lg={12}><Card size="small" title={<span><ImportOutlined style={{color:C[2]}}/> 进口</span>}><ReactECharts option={impAcceptOpt} style={{height:250}}/></Card></Col>
        </Row>
      </Card>

      {/* 进出口制单时长 2x2 */}
      <Card title={<Space><ClockCircleOutlined/>平均制单时长（进出口拆分）</Space>} size="small" style={{marginBottom:10}}>
        <Row gutter={[10,10]}>
          <Col xs={24} lg={12}><Card size="small" title={<span><ExportOutlined style={{color:C[3]}}/> 出口</span>}><ReactECharts option={expDocOpt} style={{height:250}}/></Card></Col>
          <Col xs={24} lg={12}><Card size="small" title={<span><ImportOutlined style={{color:C[4]}}/> 进口</span>}><ReactECharts option={impDocOpt} style={{height:250}}/></Card></Col>
        </Row>
      </Card>

      <Row gutter={[10,10]}>
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
    </div>
  );
};
