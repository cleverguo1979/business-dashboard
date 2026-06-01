/**
 * 制单员工作量及时效分析
 */
import React, { useMemo, useState } from 'react';
import { Card, Row, Col, Select, Tag, Space, Empty, Table, Statistic, Tooltip } from 'antd';
import { TeamOutlined, ClockCircleOutlined, BarChartOutlined, TrophyOutlined, QuestionCircleOutlined, ExportOutlined, ImportOutlined, AlertOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { useDataStore } from '../store/dataStore';

const ALL_MONTHS = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const C = ['#1677ff','#52c41a','#fa8c16','#f5222d','#722ed1','#13c2c2','#eb2f96','#faad14'];

function parseTime(s: string): Date|null { if(!s)return null; const d=new Date(s.replace(' ','T')); return isNaN(d.getTime())?null:d; }
function fmtSec(s: number): string { if(s<60)return `${Math.round(s)}秒`; if(s<3600)return `${(s/60).toFixed(1)}分`; return `${(s/3600).toFixed(1)}时`; }
function pct(v: number, t: number): string { return t>0?(v/t*100).toFixed(1):'0'; }
/** 计算指定月份的工作日天数（不含周六日） */
function getWorkingDays(month: number, year: number = 2026): number {
  const daysInMonth = [31,28,31,30,31,30,31,31,30,31,30,31];
  let count = 0;
  for (let day = 1; day <= daysInMonth[month - 1]; day++) {
    const dow = new Date(year, month - 1, day).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

function extractMonth(name: string): number|null {
  const m=name.match(/(\d{4})[-/](\d{1,2})/); if(m)return parseInt(m[2],10);
  const m2=name.match(/(\d{1,2})月/); if(m2)return parseInt(m2[1],10);
  return null;
}

interface StaffMonthStats { total:number; exp:number; imp:number; docPrepSum:number; docPrepCount:number; docPrepCleanSum:number; docPrepCleanCount:number; after17:number; crossDate:number; inquirySum:number; }
interface StaffProfile {
  name:string; monthly:Map<number,StaffMonthStats>;
  total:number; expTotal:number; impTotal:number;
  docPrepSum:number; docPrepCount:number; docPrepCleanSum:number; docPrepCleanCount:number;
  after17Total:number; crossTotal:number; inquiryTotal:number;
}

export const StaffAnalysisPage: React.FC = () => {
  const dataSets = useDataStore(s => s.dataSets);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [speedMode, setSpeedMode] = useState<'full'|'clean'>('full');
  const [rankingPageSize, setRankingPageSize] = useState(20);

  const activeMonths = useMemo(() => {
    const set = new Set<number>();
    for (const ds of dataSets) { const m = extractMonth(ds.name); if (m) set.add(m); }
    return [...set].sort((a,b)=>a-b);
  }, [dataSets]);
  const monthCount = activeMonths.length;

  const staffProfiles = useMemo((): Map<string, StaffProfile> => {
    const map = new Map<string, StaffProfile>();
    for (const ds of dataSets) {
      const month = extractMonth(ds.name); if (month===null||month<1||month>12) continue;
      for (const r of ds.records) {
        const name = r['报关员姓名'] || '(未知)';
        if (!map.has(name)) map.set(name, { name, monthly:new Map(), total:0, expTotal:0, impTotal:0, docPrepSum:0, docPrepCount:0, docPrepCleanSum:0, docPrepCleanCount:0, after17Total:0, crossTotal:0, inquiryTotal:0 });
        const p = map.get(name)!;
        if (!p.monthly.has(month)) p.monthly.set(month, { total:0,exp:0,imp:0,docPrepSum:0,docPrepCount:0,docPrepCleanSum:0,docPrepCleanCount:0,after17:0,crossDate:0,inquirySum:0 });
        const ms = p.monthly.get(month)!;

        const ot = parseTime(r['业务下单时间']), rt = parseTime(r['首次提交复核时间']);
        const rawType = (r['进/口类型']||'').toString().trim();
        const isExp = rawType==='E', isImp = rawType==='I';
        const inquiry = parseInt(r['问询次数'])||0;
        const isCross = ot&&rt ? ot.toDateString()!==rt.toDateString() : false;

        p.total++; ms.total++;
        if (isExp) { p.expTotal++; ms.exp++; }
        if (isImp) { p.impTotal++; ms.imp++; }
        if (ot && ot.getHours()>=17) { p.after17Total++; ms.after17++; }
        if (isCross) { p.crossTotal++; ms.crossDate++; }
        p.inquiryTotal += inquiry; ms.inquirySum += inquiry;

        if (ot && rt) {
          const d = (rt.getTime()-ot.getTime())/1000;
          if (d>=0) {
            p.docPrepSum+=d; p.docPrepCount++; ms.docPrepSum+=d; ms.docPrepCount++;
            if (!isCross) { p.docPrepCleanSum+=d; p.docPrepCleanCount++; ms.docPrepCleanSum+=d; ms.docPrepCleanCount++; }
          }
        }
      }
    }
    return map;
  }, [dataSets]);

  const staffList = useMemo(() => [...staffProfiles.values()].sort((a,b)=>b.total-a.total), [staffProfiles]);
  const rankingData = useMemo(() => staffList.map((s,i) => ({...s, _rk: i})), [staffList]);

  // 被排除在时效分布外的制单员数量
  const speedExcluded = useMemo(() => staffList.filter(s => {
    const cnt = speedMode==='clean' ? s.docPrepCleanCount : s.docPrepCount;
    return cnt === 0;
  }).length, [staffList, speedMode]);

  const rankingCols = [
    { title: '#', width:35, render:(_:any,__:any,i:number)=><Tag color={i<3?'gold':'default'}>{i+1}</Tag> },
    { title: '姓名', dataIndex:'name', width:75 },
    { title: "标准化报关单量", dataIndex:'total', width:65, sorter:(a:any,b:any)=>a.total-b.total, defaultSortOrder:'descend' as const, render:(v:number)=><b>{v}</b> },
    { title: '出口', dataIndex:'expTotal', width:50, sorter:(a:any,b:any)=>a.expTotal-b.expTotal },
    { title: '进口', dataIndex:'impTotal', width:50, sorter:(a:any,b:any)=>a.impTotal-b.impTotal },
    { title: '制单时效(全量)', key:'avg', width:105, sorter:(a:any,b:any)=>{const aa=a.docPrepCount>0?a.docPrepSum/a.docPrepCount:Infinity;const bb=b.docPrepCount>0?b.docPrepSum/b.docPrepCount:Infinity;return aa-bb;}, render:(_:any,r:StaffProfile)=>r.docPrepCount>0?<Tag color="blue">{fmtSec(r.docPrepSum/r.docPrepCount)}</Tag>:'-' },
    { title: '制单时效(剔除)', key:'avgC', width:105, sorter:(a:any,b:any)=>{const aa=a.docPrepCleanCount>0?a.docPrepCleanSum/a.docPrepCleanCount:Infinity;const bb=b.docPrepCleanCount>0?b.docPrepCleanSum/b.docPrepCleanCount:Infinity;return aa-bb;}, render:(_:any,r:StaffProfile)=>r.docPrepCleanCount>0?<Tag color="green">{fmtSec(r.docPrepCleanSum/r.docPrepCleanCount)}</Tag>:'-' },
    { title: '问询', dataIndex:'inquiryTotal', width:50, sorter:(a:any,b:any)=>a.inquiryTotal-b.inquiryTotal },
    { title: '17点后', key:'a17', width:65, sorter:(a:any,b:any)=>a.after17Total-b.after17Total, render:(_:any,r:StaffProfile)=><span style={{fontSize:12}}>{r.after17Total}<span style={{color:'#f5222d'}}>({pct(r.after17Total,r.total)}%)</span></span> },
    { title: '跨日', key:'cr', width:60, sorter:(a:any,b:any)=>a.crossTotal-b.crossTotal, render:(_:any,r:StaffProfile)=><span style={{fontSize:12}}>{r.crossTotal}<span style={{color:'#fa8c16'}}>({pct(r.crossTotal,r.total)}%)</span></span> },
  ];

  const top10Chart = useMemo(():EChartsOption => ({
    color:[C[0],C[1]], tooltip:{trigger:'axis',axisPointer:{type:'shadow'}}, legend:{bottom:0},
    grid:{left:80,right:50,top:10,bottom:45},
    xAxis:{type:'category',data:staffList.slice(0,10).map(s=>s.name).reverse(),axisLabel:{fontSize:10},inverse:true},
    yAxis:{type:'value',name:'单量'},
    series:[
      {name:'出口',type:'bar',data:staffList.slice(0,10).map(s=>s.expTotal).reverse(),stack:'total'},
      {name:'进口',type:'bar',data:staffList.slice(0,10).map(s=>s.impTotal).reverse(),stack:'total',itemStyle:{borderRadius:[4,4,0,0]}},
    ],
  }),[staffList]);

  const selectedProfile = useMemo(()=>selectedStaff?staffProfiles.get(selectedStaff):null,[staffProfiles,selectedStaff]);
  const selectedMonthlyChart = useMemo(():EChartsOption => {
    if(!selectedProfile) return {};
    const months = [...selectedProfile.monthly.entries()].sort((a,b)=>a[0]-b[0]);
    return {
      color:[C[0],C[1],C[3]], tooltip:{trigger:'axis'}, legend:{bottom:0},
      grid:{left:50,right:20,top:10,bottom:45},
      xAxis:{type:'category',data:months.map(([m])=>ALL_MONTHS[m-1]),axisLabel:{fontSize:10}},
      yAxis:{type:'value',name:'单量'},
      series:[
        {name:'出口',type:'line',data:months.map(([,s])=>s.exp),smooth:true,symbol:'circle',label:{show:true,fontSize:10},markLine:{silent:true,symbol:'none',data:[{type:'average',name:'均值',label:{formatter:'均值:{c}',fontSize:10}}],lineStyle:{color:C[0],type:'dashed'}}},
        {name:'进口',type:'line',data:months.map(([,s])=>s.imp),smooth:true,symbol:'diamond',label:{show:true,fontSize:10},markLine:{silent:true,symbol:'none',data:[{type:'average',name:'均值',label:{formatter:'均值:{c}',fontSize:10}}],lineStyle:{color:C[1],type:'dashed'}}},
        {name:'报关单量',type:'line',data:months.map(([,s])=>s.total),smooth:true,symbol:'triangle',label:{show:true,fontSize:10,fontWeight:'bold'},lineStyle:{width:3}},
      ],
    };
  },[selectedProfile]);

  const workloadDist = useMemo(()=>{
    const bins=[0,100,200,500,1000,2000,3000,5000,Infinity];
    const labels=['<100','100-200','200-500','500-1K','1K-2K','2K-3K','3K-5K','5K+'];
    const counts=new Array(labels.length).fill(0);
    for(const s of staffList){
      for(let i=0;i<bins.length-1;i++){ if(s.total>=bins[i]&&s.total<bins[i+1]){ counts[i]++; break; } }
    }
    return {labels,counts};
  },[staffList]);
  const workloadChart = useMemo(():EChartsOption=>({
    color:[C[2]], tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    grid:{left:50,right:20,top:10,bottom:35},
    xAxis:{type:'category',data:workloadDist.labels},
    yAxis:{type:'value',name:'人数'},
    series:[{type:'bar',data:workloadDist.counts,itemStyle:{borderRadius:[4,4,0,0]},label:{show:true,position:'top'}}],
  }),[workloadDist]);

  const speedBins = [{label:'<5分',max:300},{label:'5-15分',max:900},{label:'15-30分',max:1800},{label:'30分-1时',max:3600},{label:'1-2时',max:7200},{label:'2时+',max:Infinity}];
  const speedDist = useMemo(()=>{
    const counts=new Array(speedBins.length).fill(0);
    for(const s of staffList){
      const cnt = speedMode==='clean' ? s.docPrepCleanCount : s.docPrepCount;
      const sum = speedMode==='clean' ? s.docPrepCleanSum : s.docPrepSum;
      if(cnt===0) continue;
      const avg = sum/cnt;
      for(let i=0;i<speedBins.length;i++){ if(avg<speedBins[i].max){ counts[i]++; break; } }
    }
    return {labels:speedBins.map(b=>b.label),counts};
  },[staffList, speedMode]);
  const speedChart = useMemo(():EChartsOption=>({
    color:[C[1]], tooltip:{trigger:'axis',axisPointer:{type:'shadow'}},
    grid:{left:50,right:20,top:10,bottom:35},
    xAxis:{type:'category',data:speedDist.labels},
    yAxis:{type:'value',name:'人数'},
    series:[{type:'bar',data:speedDist.counts,itemStyle:{borderRadius:[4,4,0,0]},label:{show:true,position:'top'}}],
  }),[speedDist]);

  if (dataSets.length===0) return <Empty style={{marginTop:100}} description="请先加载数据"/>;

  const totalOrders = staffList.reduce((s,p)=>s+p.total,0);
  const avgPerPerson = staffList.length>0 ? Math.round(totalOrders/staffList.length) : 0;
  const allCleanAvg = (()=>{
    let sum=0, cnt=0;
    for(const s of staffList){ if(s.docPrepCleanCount>0){ sum+=s.docPrepCleanSum/s.docPrepCleanCount; cnt++; } }
    return cnt>0?fmtSec(sum/cnt):'-';
  })();
  const allFullAvg = (()=>{
    let sum=0, cnt=0;
    for(const s of staffList){ if(s.docPrepCount>0){ sum+=s.docPrepSum/s.docPrepCount; cnt++; } }
    return cnt>0?fmtSec(sum/cnt):'-';
  })();

  return (
    <div>
      <Card size="small" style={{marginBottom:12}}>
        <Space><span style={{fontWeight:600,fontSize:15}}><TeamOutlined/> 制单员分析</span><Tag color="blue">{staffList.length} 人</Tag><Tag color="green">基于 {monthCount} 个月数据</Tag></Space>
      </Card>

      <Row gutter={[12,12]} style={{marginBottom:12}}>
        <Col xs={12} sm={5}><Card size="small" style={{height:105}} bodyStyle={{padding:'12px 8px'}}><Statistic title="制单员总数" value={staffList.length} suffix="人" prefix={<TeamOutlined/>} valueStyle={{color:C[0],fontWeight:700,fontSize:24}}/></Card></Col>
        <Col xs={12} sm={5}><Card size="small" style={{height:105}} bodyStyle={{padding:'12px 8px'}}><Statistic title="报关单量" value={totalOrders} suffix="单" prefix={<BarChartOutlined/>} valueStyle={{color:C[0],fontWeight:700,fontSize:24}}/></Card></Col>
        <Col xs={12} sm={5}><Card size="small" style={{height:105}} bodyStyle={{padding:'12px 8px'}}><Statistic title="月人均单量" value={monthCount>0?Math.round(avgPerPerson/monthCount):0} suffix="单/月" prefix={<TrophyOutlined/>} valueStyle={{color:C[0],fontWeight:700,fontSize:24}}/></Card></Col>
        <Col xs={12} sm={9}><Card size="small" style={{height:105}} bodyStyle={{padding:'10px 12px'}}>
            <div style={{fontSize:12,color:'rgba(0,0,0,0.45)',marginBottom:6}}>人均制单时效（基于{monthCount}个月）</div>
            <div style={{display:'flex',justifyContent:'space-around',alignItems:'baseline'}}>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:10,color:'rgba(0,0,0,0.45)',marginBottom:2}}>全量统计</div>
                <div style={{color:C[0],fontWeight:700,fontSize:24}}>{allFullAvg}</div>
              </div>
              <div style={{textAlign:'center'}}>
                <div style={{fontSize:10,color:'rgba(0,0,0,0.45)',marginBottom:2}}>剔除异常后</div>
                <div style={{color:C[1],fontWeight:700,fontSize:24}}>{allCleanAvg}</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[12,12]} style={{marginBottom:12}}>
        <Col xs={24} lg={14}>
          <Card title={<span style={{fontSize:13}}><TrophyOutlined style={{color:C[3],marginRight:4}}/>制单员工作量 TOP10 <span style={{fontWeight:400,color:'#999',fontSize:11}}>（基于{monthCount}个月）</span></span>} size="small" style={{height:'100%'}}>
            <ReactECharts option={top10Chart} style={{height:330}}/>
          </Card>
        </Col>
        <Col xs={24} lg={10} style={{display:'flex',flexDirection:'column'}}>
          <Card title={<Space><BarChartOutlined/>工作量负荷分布 <Tooltip title="每位制单员在全时间段内的标准化报关单量，按区间统计人数，反映团队整体负荷结构"><QuestionCircleOutlined style={{color:'#bbb',fontSize:12}}/></Tooltip></Space>} size="small" style={{flex:1,marginBottom:12}}>
            <ReactECharts option={workloadChart} style={{height:140}}/>
          </Card>
          <Card title={<Space><ClockCircleOutlined/>制单时效分布 <Tooltip title="按制单员平均制单时长区间统计人数。全量=所有数据，剔除=排除跨日制单异常"><QuestionCircleOutlined style={{color:'#bbb',fontSize:12}}/></Tooltip></Space>} size="small" style={{flex:1}}
            extra={
              <Select size="small" style={{width:100}} value={speedMode} onChange={v=>setSpeedMode(v)} options={[
                {label:'全量统计',value:'full'},{label:'剔除异常',value:'clean'}
              ]}/>
            }>
            <ReactECharts option={speedChart} style={{height:120}}/>
            {speedExcluded > 0 && <div style={{fontSize:10,color:'#999',textAlign:'center',marginTop:-4}}>注：{speedExcluded} 人无{speedMode==='clean'?'剔除异常后':''}制单数据，未纳入统计</div>}
          </Card>
        </Col>
      </Row>

      <Card title="制单员总览排行" size="small" style={{marginBottom:12}}>
        <Table dataSource={rankingData} rowKey="_rk" size="small" pagination={{pageSize:rankingPageSize,showSizeChanger:true,pageSizeOptions:['10','20','50','100'],showTotal:(t:number)=>`共 ${t} 人`,onChange:(_page:number,pageSize:number)=>{setRankingPageSize(pageSize);}}} columns={rankingCols as any}/>
      </Card>

      <Card title={<Space>制单员月度明细{selectedStaff && <Tag color="blue">{selectedStaff}</Tag>}</Space>} size="small"
        extra={<Select size="small" style={{width:160}} value={selectedStaff||undefined} placeholder="选择制单员" showSearch optionFilterProp="label" onChange={v=>setSelectedStaff(v)} options={staffList.map(s=>({label:s.name,value:s.name}))}/>}>
        {selectedProfile ? (
          <div>
            <ReactECharts option={selectedMonthlyChart} style={{height:280}}/>
            <Row gutter={[10,10]} style={{marginTop:12,justifyContent:'center'}}>
              {(()=>{
                const s=selectedProfile;
                const avgFull=s.docPrepCount>0?fmtSec(s.docPrepSum/s.docPrepCount):'-';
                const avgClean=s.docPrepCleanCount>0?fmtSec(s.docPrepCleanSum/s.docPrepCleanCount):'-';
                const cards = [
                  {icon:<BarChartOutlined/>,label:'报关单量',value:s.total,unit:'单',color:C[0]},
                  {icon:<ExportOutlined/>,label:'出口',value:s.expTotal,unit:'单',color:C[0]},
                  {icon:<ImportOutlined/>,label:'进口',value:s.impTotal,unit:'单',color:C[1]},
                  {icon:<ClockCircleOutlined/>,label:'制单时效(全量)',value:avgFull,color:C[0]},
                  {icon:<ClockCircleOutlined/>,label:'制单时效(剔除)',value:avgClean,color:C[1]},
                  {icon:<AlertOutlined/>,label:'17点后',value:`${s.after17Total} 单`,sub:`${pct(s.after17Total,s.total)}%`,color:'#f5222d'},
                  {icon:<AlertOutlined/>,label:'跨日',value:`${s.crossTotal} 单`,sub:`${pct(s.crossTotal,s.total)}%`,color:'#fa8c16'},
                  (()=>{
                    const months = [...s.monthly.keys()];
                    let totalWD = 0;
                    for(const m of months) totalWD += getWorkingDays(m);
                    const ppd = totalWD>0 ? (s.total/totalWD).toFixed(1) : '-';
                    return {icon:<TeamOutlined/>,label:'人天',value:ppd,unit:'票/天',color:C[5]};
                  })(),
                ];
                return cards.map((c,i)=>(
                  <Col key={i} xs={6} sm={3} style={{flex:'1 1 0'}}>
                    <Card size="small" style={{height:78}} bodyStyle={{padding:'8px 6px',textAlign:'center'}}>
                      <div style={{fontSize:11,color:'#999',marginBottom:2}}><span style={{color:c.color,marginRight:3}}>{c.icon}</span>{c.label}</div>
                      <div style={{fontSize:17,fontWeight:700,color:c.color}}>{c.value}{c.unit||''}</div>
                      {c.sub && <div style={{fontSize:10,color:'#aaa',marginTop:1}}>{c.sub}</div>}
                    </Card>
                  </Col>
                ));
              })()}
            </Row>
            <Table dataSource={[...(selectedProfile.monthly.entries())].sort((a,b)=>a[0]-b[0]).map(([m,ms],i)=>({_key:i,month:ALL_MONTHS[m-1],...ms,avgFull:ms.docPrepCount>0?fmtSec(ms.docPrepSum/ms.docPrepCount):'-',avgClean:ms.docPrepCleanCount>0?fmtSec(ms.docPrepCleanSum/ms.docPrepCleanCount):'-',monthNum:m}))} rowKey="_key" size="small" pagination={false} style={{marginTop:8}}
              columns={[
                {title:'月份',dataIndex:'month',width:55},
                {title:'报关单量',dataIndex:'total',width:60,render:(v:number)=><b>{v}</b>},
                {title:'出口',dataIndex:'exp',width:50},
                {title:'进口',dataIndex:'imp',width:50},
                {title:'时效(全量)',dataIndex:'avgFull',width:90,render:(v:string)=><Tag color="blue">{v}</Tag>},
                {title:'时效(剔除)',dataIndex:'avgClean',width:90,render:(v:string)=><Tag color="green">{v}</Tag>},
                {title:'17点后',dataIndex:'after17',width:55},
                {title:'跨日',dataIndex:'crossDate',width:50},
                {title:'问询',dataIndex:'inquirySum',width:50},
                {title:'人天',key:'ppd',width:65,render:(_:any,r:any)=>{const wd=getWorkingDays(r.monthNum);return <span style={{fontWeight:500}}>{(r.total/wd).toFixed(1)}<span style={{fontSize:10,color:'#999'}}> 票/天</span></span>;}},
              ]}
            />
          </div>
        ) : <Empty description="请选择一位制单员查看月度明细"/>}
      </Card>
    </div>
  );
};
