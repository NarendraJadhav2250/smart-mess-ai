import { useMemo, useState } from 'react'
import { Activity, CalendarDays, ChartNoAxesCombined, FilterX, TrendingDown, TrendingUp, Utensils } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getMealHistory } from '../utils/mealResults'
import { calculatePredictionError, calculateShortage, calculateWaste } from '../utils/calculations'

const weekdays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const shortDate = (value: string) => new Date(value+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short'})
function ChartPanel({title,subtitle,children,className=''}:{title:string;subtitle:string;children:React.ReactNode;className?:string}) {
  return <section className={'card analytics-chart-card '+className}><div className="analytics-chart-heading"><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="analytics-chart-area">{children}</div></section>
}
export default function Analytics() {
  const allRecords = useMemo(()=>getMealHistory(),[])
  const [from,setFrom]=useState('')
  const [to,setTo]=useState('')
  const [meal,setMeal]=useState('')
  const [menu,setMenu]=useState('')
  const menus=useMemo(()=>[...new Set(allRecords.map(record=>record.menu))].sort((a,b)=>a.localeCompare(b)),[allRecords])
  const records=useMemo(()=>allRecords.filter(record=>
    (!from||record.date>=from)&&(!to||record.date<=to)&&(!meal||record.meal===meal)&&(!menu||record.menu===menu)
  ),[allRecords,from,to,meal,menu])
  const prepared=records.reduce((sum,row)=>sum+row.preparedQuantity,0)
  const consumed=records.reduce((sum,row)=>sum+row.consumedQuantity,0)
  const waste=records.reduce((sum,row)=>sum+calculateWaste(row.preparedQuantity,row.consumedQuantity),0)
  const wasteRate=prepared?waste/prepared*100:0
  const shortageEvents=records.filter(row=>calculateShortage(row.preparedQuantity,row.consumedQuantity)>0).length
  const predictionError=records.length?records.reduce((sum,row)=>sum+calculatePredictionError(row.predictedDemand,row.consumedQuantity),0)/records.length:0
  const kpis=[
    {label:'Total Prepared',value:prepared.toLocaleString(),unit:'portions',icon:Utensils,tone:'green',detail:records.length+' meal records'},
    {label:'Total Consumed',value:consumed.toLocaleString(),unit:'portions',icon:Activity,tone:'blue',detail:prepared?Math.round(consumed/prepared*100)+'% of prepared':'No servings recorded'},
    {label:'Total Waste',value:waste.toLocaleString(),unit:'portions',icon:TrendingDown,tone:'amber',detail:'Prepared minus consumed'},
    {label:'Waste Rate',value:wasteRate.toFixed(1)+'%',unit:'',icon:ChartNoAxesCombined,tone:'navy',detail:'Waste / prepared'},
    {label:'Shortage Events',value:String(shortageEvents),unit:'meals',icon:TrendingUp,tone:'red',detail:'Consumed exceeded prepared'},
    {label:'Average Prediction Error',value:predictionError.toFixed(1),unit:'portions',icon:ChartNoAxesCombined,tone:'purple',detail:'Mean absolute error'},
  ]
  const wasteByMenu=Object.values(records.reduce<Record<string,{menu:string;waste:number}>>((groups,row)=>{
    const group=groups[row.menu]??{menu:row.menu,waste:0}
    group.waste+=calculateWaste(row.preparedQuantity,row.consumedQuantity)
    groups[row.menu]=group
    return groups
  },{})).sort((a,b)=>b.waste-a.waste)
  const wasteByDay=weekdays.map(day=>({day:day.slice(0,3),waste:records.filter(row=>row.weekday===day).reduce((sum,row)=>sum+calculateWaste(row.preparedQuantity,row.consumedQuantity),0)})).filter(row=>records.some(record=>record.weekday.slice(0,3)===row.day))
  const byDate=Object.values(records.reduce<Record<string,{date:string;prepared:number;consumed:number;predicted:number}>>((groups,row)=>{
    const group=groups[row.date]??{date:row.date,prepared:0,consumed:0,predicted:0}
    group.prepared+=row.preparedQuantity
    group.consumed+=row.consumedQuantity
    group.predicted+=row.predictedDemand
    groups[row.date]=group
    return groups
  },{})).sort((a,b)=>a.date.localeCompare(b.date))
  const clearFilters=()=>{setFrom('');setTo('');setMeal('');setMenu('')}
  const hasFilters=Boolean(from||to||meal||menu)

  return <div className="content records-content analytics-content">
    <div className="records-heading"><div><small className="eyebrow">MESS OPERATIONS · MEASURABLE IMPACT</small><h1>Analytics</h1><p>Track preparation, consumption, waste, and prediction accuracy from your meal records.</p></div><span><ChartNoAxesCombined size={16}/>{records.length} meal records</span></div>
    <section className="card analytics-filterbar" aria-label="Analytics filters"><div className="analytics-filter-title"><CalendarDays size={15}/><b>Filter records</b></div><label><span>From</span><input aria-label="From date" type="date" value={from} onChange={event=>setFrom(event.target.value)}/></label><label><span>To</span><input aria-label="To date" type="date" value={to} onChange={event=>setTo(event.target.value)}/></label><label><span>Meal</span><select aria-label="Filter by meal" value={meal} onChange={event=>setMeal(event.target.value)}><option value="">All meals</option><option>Lunch</option><option>Dinner</option></select></label><label><span>Menu</span><select aria-label="Filter by menu" value={menu} onChange={event=>setMenu(event.target.value)}><option value="">All menus</option>{menus.map(item=><option key={item}>{item}</option>)}</select></label>{hasFilters&&<button type="button" onClick={clearFilters}><FilterX size={14}/>Clear</button>}</section>
    <div className="analytics-impact"><div className="analytics-impact-mark"><Activity size={20}/></div><div><small>MEASURABLE FOOD IMPACT</small><b>{waste.toLocaleString()} portions of calculated waste</b><span>{wasteRate.toFixed(1)}% of {prepared.toLocaleString()} prepared portions across {records.length} meal records in this view.</span></div><div className="impact-rate"><strong>{wasteRate.toFixed(1)}%</strong><small>waste rate</small></div></div>
    <div className="analytics-dashboard-kpis">{kpis.map(({label,value,unit,icon:Icon,tone,detail})=><article className="card analytics-dashboard-kpi" key={label}><div className="analytics-kpi-top"><span>{label}</span><i className={'analytics-icon-'+tone}><Icon size={17}/></i></div><b>{value}<small>{unit}</small></b><p>{detail}</p></article>)}</div>
    <div className="analytics-charts-grid">
      <ChartPanel title="Waste by Menu" subtitle="Calculated leftover portions for each menu"><ResponsiveContainer width="100%" height="100%"><BarChart data={wasteByMenu} layout="vertical" margin={{top:4,right:16,bottom:4,left:0}}><CartesianGrid horizontal={false} stroke="#edf0f3"/><XAxis type="number" axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:9}}/><YAxis type="category" dataKey="menu" width={86} axisLine={false} tickLine={false} tick={{fill:'#657386',fontSize:9}}/><Tooltip cursor={{fill:'#f5f8f6'}} contentStyle={{border:'1px solid #edf0f3',borderRadius:9,fontSize:10}}/><Bar dataKey="waste" name="Waste" fill="#d4a66b" radius={[0,5,5,0]} barSize={15}/></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Waste by Day" subtitle="Historical waste grouped by weekday"><ResponsiveContainer width="100%" height="100%"><BarChart data={wasteByDay} margin={{top:9,right:5,bottom:0,left:-19}}><CartesianGrid vertical={false} stroke="#edf0f3"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:10}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:9}}/><Tooltip contentStyle={{border:'1px solid #edf0f3',borderRadius:9,fontSize:10}}/><Bar dataKey="waste" name="Waste" fill="#c58d55" radius={[5,5,0,0]} barSize={25}/></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Prepared vs Consumed" subtitle="Actual serving totals grouped by date"><ResponsiveContainer width="100%" height="100%"><BarChart data={byDate} barGap={4} margin={{top:8,right:5,bottom:0,left:-19}}><CartesianGrid vertical={false} stroke="#edf0f3"/><XAxis dataKey="date" tickFormatter={shortDate} axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:9}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:9}}/><Tooltip labelFormatter={value=>shortDate(String(value))} contentStyle={{border:'1px solid #edf0f3',borderRadius:9,fontSize:10}}/><Legend iconType="circle" wrapperStyle={{fontSize:9,color:'#758294'}}/><Bar dataKey="prepared" name="Prepared" fill="#dce8e2" radius={[4,4,0,0]}/><Bar dataKey="consumed" name="Consumed" fill="#1b7959" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></ChartPanel>
      <ChartPanel title="Predicted vs Actual Consumption" subtitle="Recorded prediction compared with consumed servings"><ResponsiveContainer width="100%" height="100%"><BarChart data={byDate} barGap={4} margin={{top:8,right:5,bottom:0,left:-19}}><CartesianGrid vertical={false} stroke="#edf0f3"/><XAxis dataKey="date" tickFormatter={shortDate} axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:9}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:9}}/><Tooltip labelFormatter={value=>shortDate(String(value))} contentStyle={{border:'1px solid #edf0f3',borderRadius:9,fontSize:10}}/><Legend iconType="circle" wrapperStyle={{fontSize:9,color:'#758294'}}/><Bar dataKey="predicted" name="Predicted" fill="#c9d7ee" radius={[4,4,0,0]}/><Bar dataKey="consumed" name="Actual consumed" fill="#5475a6" radius={[4,4,0,0]}/></BarChart></ResponsiveContainer></ChartPanel>
    </div>
    <p className="analytics-data-note">All totals and chart series use the filtered historical dataset, including saved meal results. Waste and shortage are derived from prepared and consumed quantities.</p>
  </div>
}
