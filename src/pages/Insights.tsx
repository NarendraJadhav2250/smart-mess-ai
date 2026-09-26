import { useMemo } from 'react'
import { Activity, CalendarCheck2, Database, Sun, TrendingDown, TrendingUp, Utensils, type LucideIcon } from 'lucide-react'
import { getMealHistory } from '../utils/mealResults'
import { calculatePredictionError, calculateWaste } from '../utils/calculations'
import type { MealRecord } from '../types'

type Tone = 'green' | 'amber' | 'blue' | 'slate' | 'rose'
type InsightProps = { icon: LucideIcon; eyebrow: string; title: string; explanation: string; metric: string; status: string; tone: Tone; detail?: string }
function InsightCard({icon:Icon,eyebrow,title,explanation,metric,status,tone,detail}:InsightProps) {
  return <article className={'card insight-card insight-'+tone}><div className="insight-card-top"><i><Icon size={18}/></i><span>{status}</span></div><small className="insight-eyebrow">{eyebrow}</small><h2>{title}</h2><p>{explanation}</p><div className="insight-metric"><b>{metric}</b>{detail&&<small>{detail}</small>}</div></article>
}
const mean=(values:number[])=>values.length?values.reduce((sum,value)=>sum+value,0)/values.length:0
function menuGroups(records:MealRecord[]) {
  return Object.values(records.reduce<Record<string,{menu:string;meal:string;records:MealRecord[]}>>((groups,row)=>{
    const key=row.menu+'|'+row.meal
    const group=groups[key]??{menu:row.menu,meal:row.meal,records:[]}
    group.records.push(row);groups[key]=group;return groups
  },{}))
}
function collegeComparison(records:MealRecord[]) {
  const regular=records.filter(row=>row.isCollegeDay&&!row.isHoliday)
  const other=records.filter(row=>!row.isCollegeDay&&!row.isHoliday)
  if(!regular.length||!other.length)return null
  const regularAverage=mean(regular.map(row=>row.consumedQuantity))
  const otherAverage=mean(other.map(row=>row.consumedQuantity))
  return {regular,other,regularAverage,otherAverage,difference:regularAverage-otherAverage}
}
function holidayComparison(records:MealRecord[]) {
  const lunch=records.filter(row=>row.meal==='Lunch')
  const holidays=lunch.filter(row=>row.isHoliday)
  const regular=lunch.filter(row=>!row.isHoliday)
  if(!holidays.length||!regular.length)return null
  const holidayAverage=mean(holidays.map(row=>row.consumedQuantity))
  const regularAverage=mean(regular.map(row=>row.consumedQuantity))
  return {holidays,regular,holidayAverage,regularAverage,difference:holidayAverage-regularAverage}
}
function WasteInsight({records}:{records:MealRecord[]}) {
  const group=menuGroups(records).map(item=>{
    const totalPrepared=item.records.reduce((sum,row)=>sum+row.preparedQuantity,0)
    const totalWaste=item.records.reduce((sum,row)=>sum+calculateWaste(row.preparedQuantity,row.consumedQuantity),0)
    return {...item,totalPrepared,totalWaste,averageWaste:mean(item.records.map(row=>calculateWaste(row.preparedQuantity,row.consumedQuantity))),rate:totalPrepared?totalWaste/totalPrepared*100:0}
  }).sort((a,b)=>b.averageWaste-a.averageWaste)[0]
  if(!group)return <InsightCard icon={Utensils} eyebrow="MENU WASTE" title="Waiting for meal results" explanation="Save prepared and consumed quantities to compare leftover patterns across menus." metric="0 meal records" status="No data" tone="slate"/>
  const status=group.rate>=5?'Review':group.rate>=2.5?'Monitor':'On track'
  const tone:Tone=group.rate>=5?'amber':'green'
  return <InsightCard icon={TrendingDown} eyebrow="HIGHEST AVERAGE LEFTOVER" title={group.menu+' · '+group.meal} explanation={group.menu+' averaged '+Math.round(group.averageWaste)+' leftover portions across its recorded meals.'} metric={Math.round(group.averageWaste)+' portions average waste'} detail={group.records.length+' '+(group.records.length===1?'record':'records')+' · '+group.rate.toFixed(1)+'% of prepared'} status={status} tone={tone}/>
}
function DemandInsight({records}:{records:MealRecord[]}) {
  const group=menuGroups(records).map(item=>({...item,averageConsumed:mean(item.records.map(row=>row.consumedQuantity))})).sort((a,b)=>b.averageConsumed-a.averageConsumed)[0]
  if(!group)return <InsightCard icon={TrendingUp} eyebrow="OBSERVED CONSUMPTION" title="Waiting for meal results" explanation="Consumption totals will reveal which menus have the strongest observed demand." metric="0 meal records" status="No data" tone="slate"/>
  return <InsightCard icon={TrendingUp} eyebrow="HIGHEST OBSERVED CONSUMPTION" title={group.menu+' · '+group.meal} explanation={group.menu+' has the highest average recorded consumption in this sample. Use it as an early signal while more meals are logged.'} metric={Math.round(group.averageConsumed)+' portions average consumed'} detail={group.records.length+' '+(group.records.length===1?'record':'records')} status={group.records.length>=3?'Observed':'Early signal'} tone={group.records.length>=3?'green':'blue'}/>
}
function CollegeInsight({records}:{records:MealRecord[]}) {
  const comparison=collegeComparison(records)
  if(!comparison)return <InsightCard icon={CalendarCheck2} eyebrow="COLLEGE DAY PATTERN" title="More day types needed for comparison" explanation={'The dataset has '+records.filter(row=>row.isCollegeDay&&!row.isHoliday).length+' regular college-day records and '+records.filter(row=>!row.isCollegeDay&&!row.isHoliday).length+' non-college records. There is not yet a fair attendance comparison.'} metric={records.filter(row=>row.isCollegeDay&&!row.isHoliday).length+' college-day records'} detail="Log a non-college meal to compare." status="Limited data" tone="slate"/>
  const lower=comparison.difference<0,percent=comparison.otherAverage?Math.round(Math.abs(comparison.difference)/comparison.otherAverage*100):0
  return <InsightCard icon={CalendarCheck2} eyebrow="COLLEGE DAY PATTERN" title={lower?'Lower consumption on college days':'Higher consumption on college days'} explanation={'Average consumption was '+Math.round(comparison.regularAverage)+' portions on college days versus '+Math.round(comparison.otherAverage)+' on non-college days.'} metric={(lower?'−':'+')+percent+'% difference'} detail={comparison.regular.length+' college / '+comparison.other.length+' non-college records'} status="Compared" tone={lower?'amber':'green'}/>
}
function HolidayInsight({records}:{records:MealRecord[]}) {
  const comparison=holidayComparison(records)
  if(!comparison)return <InsightCard icon={Sun} eyebrow="HOLIDAY LUNCH PATTERN" title="Holiday effect is not measurable yet" explanation={'There are '+records.filter(row=>row.meal==='Lunch'&&row.isHoliday).length+' holiday lunch records. Record a holiday meal to compare its demand with a regular lunch.'} metric={records.filter(row=>row.meal==='Lunch'&&row.isHoliday).length+' holiday lunch records'} detail="No holiday comparison is shown without examples." status="Limited data" tone="slate"/>
  const increase=comparison.difference>0,percent=comparison.regularAverage?Math.round(Math.abs(comparison.difference)/comparison.regularAverage*100):0
  return <InsightCard icon={Sun} eyebrow="HOLIDAY LUNCH PATTERN" title={increase?'Higher lunch consumption on holidays':'Lower lunch consumption on holidays'} explanation={'Holiday lunches averaged '+Math.round(comparison.holidayAverage)+' consumed portions compared with '+Math.round(comparison.regularAverage)+' on non-holidays.'} metric={(increase?'+':'−')+percent+'% difference'} detail={comparison.holidays.length+' holiday / '+comparison.regular.length+' regular lunch records'} status="Compared" tone={increase?'green':'amber'}/>
}
function PredictionInsight({records}:{records:MealRecord[]}) {
  const ordered=[...records].sort((a,b)=>a.date.localeCompare(b.date)||a.meal.localeCompare(b.meal))
  if(ordered.length<6)return <InsightCard icon={Activity} eyebrow="PREDICTION ACCURACY" title="More results needed for a trend" explanation="Log at least six meals with predictions and actual consumption before comparing recent error with the prior period." metric={ordered.length+' of 6 records'} detail="Trend uses two groups of three meals." status="Building history" tone="slate"/>
  const errors=ordered.map(row=>calculatePredictionError(row.predictedDemand,row.consumedQuantity))
  const previous=mean(errors.slice(-6,-3)),recent=mean(errors.slice(-3))
  const difference=recent-previous
  const percent=previous?Math.round(Math.abs(difference)/previous*100):difference?100:0
  const direction=Math.abs(difference)<0.5?'stable':difference>0?'increasing':'decreasing'
  const Icon=direction==='decreasing'?TrendingDown:direction==='increasing'?TrendingUp:Activity
  return <InsightCard icon={Icon} eyebrow="PREDICTION ACCURACY" title={'Recent prediction error is '+direction} explanation={'Mean absolute error across the latest three meals was '+recent.toFixed(1)+' portions, compared with '+previous.toFixed(1)+' in the preceding three.'} metric={recent.toFixed(1)+' portions recent error'} detail={direction==='stable'?'No meaningful change between periods.':(difference>0?'+':'−')+percent+'% versus previous period'} status={direction==='decreasing'?'Improving':direction==='increasing'?'Needs attention':'Stable'} tone={direction==='decreasing'?'green':direction==='increasing'?'amber':'blue'}/>
}
export default function Insights() {
  const records=useMemo(()=>getMealHistory(),[])
  const menuCount=new Set(records.map(row=>row.menu)).size
  const dinnerCount=records.filter(row=>row.meal==='Dinner').length
  const holidayCount=records.filter(row=>row.isHoliday).length
  return <div className="content insights-page">
    <div className="insights-heading"><div><small className="eyebrow">MESS OPERATIONS · DATA-LED GUIDANCE</small><h1>AI Insights</h1><p>Simple observations calculated from your meal history. Each insight shows the records behind it.</p></div><div className="insights-data-chip"><Database size={15}/>{records.length} records analyzed</div></div>
    <section className="insights-overview"><div className="insights-overview-icon"><Activity size={19}/></div><div><small>WHAT THE DATA SAYS</small><b>{records.length?menuCount+' menus represented':'No historical meal data yet'}</b><span>{dinnerCount} {dinnerCount===1?'dinner record':'dinner records'} · {holidayCount} {holidayCount===1?'holiday record':'holiday records'} · insights refresh when meal results are saved</span></div><div className="overview-check"><span/></div></section>
    <div className="insight-grid"><WasteInsight records={records}/><DemandInsight records={records}/><CollegeInsight records={records}/><HolidayInsight records={records}/><PredictionInsight records={records}/><InsightCard icon={Database} eyebrow="DATA COVERAGE" title={records.length?'History is still growing':'Start recording meal results'} explanation={records.length?'Some patterns have a small sample. Treat early signals as guidance and keep recording actual servings.':'Save prepared and consumed quantities after each meal to build useful comparisons.'} metric={records.length+' meal records'} detail={dinnerCount+' '+(dinnerCount===1?'dinner':'dinners')+' · '+holidayCount+' '+(holidayCount===1?'holiday':'holidays')} status={records.length>=20?'Growing':'Early dataset'} tone={records.length>=20?'green':'blue'}/></div>
    <p className="insights-footer">These are transparent summaries of local records, not predictions from an external AI service.</p>
  </div>
}




