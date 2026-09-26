
import {useState} from 'react'
import {BrowserRouter,Routes,Route,Navigate,NavLink,useLocation} from 'react-router-dom'
import {useEffect} from 'react'
import {Activity,Bell,CalendarDays,ChartNoAxesCombined,ChefHat,ClipboardList,History,Home,Lightbulb,Menu,Settings,Sparkles,Users,Utensils} from 'lucide-react'
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {api,type ApiHistoryRecord,type ApiPrediction} from './services/api'
import MealPlanning from './pages/MealPlanning'
import AIRecommendation from './pages/AIRecommendation'
import Consumption from './pages/Consumption'
import HistoryPage from './pages/History'
import Analytics from './pages/Analytics'
import Insights from './pages/Insights'
import './App.css'
const nav=[['Dashboard','/dashboard',Home],["Today's Meal",'/meal-planning',Utensils],['AI Recommendation','/ai-recommendation',Sparkles],['Consumption','/consumption',ClipboardList],['History','/history',History],['Analytics','/analytics',ChartNoAxesCombined],['AI Insights','/insights',Lightbulb]] as const
const date=new Date(),formatted=date.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
function Shell(){const [menuOpen,setMenuOpen]=useState(false);const path=useLocation().pathname,title=nav.find(n=>n[1]===path)?.[0]??'Dashboard';return <div className="layout"><aside className={menuOpen?"sidebar-open":""}><div className="brand"><i><ChefHat/></i><div><b>Smart Mess AI</b><small>Demand intelligence</small></div></div><small className="caption">WORKSPACE</small><nav>{nav.map(([label,to,Icon])=><NavLink key={to} to={to}><Icon size={18}/>{label}</NavLink>)}</nav><div className="sidebottom"><div className="sustain"><Activity/><b>Less waste, better meals.</b><p>Every smart serving makes a difference.</p></div><NavLink to="/settings"><Settings size={18}/>Settings</NavLink><div className="profile"><i>AM</i><span><b>Admin Manager</b><small>Mess administrator</small></span></div></div></aside><main><header><button className="mobile" aria-label="Open navigation" onClick={()=>setMenuOpen(!menuOpen)}><Menu/></button><div>Workspace <span>/</span> <b>{title}</b></div><section><small><CalendarDays size={15}/>{formatted}</small><button aria-label="Notifications"><Bell/></button><b className="manager">AM &nbsp; Admin Manager</b></section></header><Routes><Route path="/" element={<Navigate to="/dashboard" replace/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/meal-planning" element={<MealPlanning/>}/><Route path="/ai-recommendation" element={<AIRecommendation/>}/><Route path="/consumption" element={<Consumption/>}/><Route path="/history" element={<HistoryPage/>}/><Route path="/analytics" element={<Analytics/>}/><Route path="/insights" element={<Insights/>}/><Route path="/settings" element={<Page title="Settings" text="Manage local mess preferences and operating assumptions."/>}/><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes></main></div>}
type DashboardPrediction = Pick<ApiPrediction, 'predictedConsumption' | 'recommendedQuantity'>

function Dashboard(){
 const [history,setHistory]=useState<ApiHistoryRecord[]>([])
 const [predictions,setPredictions]=useState<Record<string,DashboardPrediction>>({})
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState('')
 const today=new Date()
 const todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-')
 const currentDay=today.toLocaleDateString('en-US',{weekday:'long'})

 useEffect(()=>{
  let active=true
  api.getHistory().then(async rows=>{
   if(!active)return
   setHistory(rows)
   const todaysRows=rows.filter(row=>row.date.slice(0,10)===todayKey&&(row.mealType==='Lunch'||row.mealType==='Dinner'))
   const results=await Promise.all(todaysRows.map(async row=>{
    if(row.predictedDemand!==null&&row.recommendedQuantity!==null)return {id:row.id,value:{predictedConsumption:row.predictedDemand,recommendedQuantity:row.recommendedQuantity}}
    try{
     const prediction=await api.createPrediction(row.id)
     return {id:row.id,value:{predictedConsumption:prediction.predictedConsumption,recommendedQuantity:prediction.recommendedQuantity}}
    }catch{return {id:row.id,value:null}}
   }))
   if(active)setPredictions(Object.fromEntries(results.filter((item):item is {id:string;value:DashboardPrediction}=>item.value!==null).map(item=>[item.id,item.value])))
   if(active&&results.some(item=>item.value===null))setError('Some saved meals do not have a prediction available.')
  }).catch(reason=>{
   if(active)setError(reason instanceof Error?reason.message:'Could not load dashboard meal data.')
  }).finally(()=>{if(active)setLoading(false)})
  return ()=>{active=false}
 },[todayKey])

 const todaysRecords=history.filter(row=>row.date.slice(0,10)===todayKey&&(row.mealType==='Lunch'||row.mealType==='Dinner'))
 const meals=todaysRecords.map(row=>{
  const prediction=predictions[row.id]
  return {row,expectedStudents:row.expectedStudents,predicted:row.predictedDemand??prediction?.predictedConsumption??null,recommended:row.recommendedQuantity??prediction?.recommendedQuantity??null,hasResult:row.preparedQuantity!==null&&row.consumedQuantity!==null}
 })
 const totalExpected=meals.reduce((sum,meal)=>sum+meal.expectedStudents,0)
 const hasRecommendations=meals.some(meal=>meal.recommended!==null)
 const recommendedTotal=meals.reduce((sum,meal)=>sum+(meal.recommended??0),0)
 const recordedToday=todaysRecords.filter(row=>row.preparedQuantity!==null&&row.consumedQuantity!==null)
 const preparedToday=recordedToday.reduce((sum,row)=>sum+(row.preparedQuantity??0),0)
 const wasteToday=recordedToday.reduce((sum,row)=>sum+(row.waste??0),0)
 const shortageToday=recordedToday.reduce((sum,row)=>sum+(row.shortage??0),0)
 const wastePercentageToday=preparedToday?Math.round(wasteToday/preparedToday*1000)/10:0
 const completedHistory=history.filter(row=>row.preparedQuantity!==null&&row.consumedQuantity!==null&&row.date.slice(0,10)<=todayKey)
 const dated=[...new Set(completedHistory.map(row=>row.date.slice(0,10)))].sort().slice(-7)
 const chart=dated.map(dateKey=>{
  const records=completedHistory.filter(row=>row.date.slice(0,10)===dateKey)
  return {day:records[0].weekday.slice(0,3),prepared:records.reduce((sum,row)=>sum+(row.preparedQuantity??0),0),consumed:records.reduce((sum,row)=>sum+(row.consumedQuantity??0),0)}
 })
 const weekRecords=completedHistory.filter(row=>dated.includes(row.date.slice(0,10)))
 const weekPrepared=weekRecords.reduce((sum,row)=>sum+(row.preparedQuantity??0),0)
 const weekWaste=weekRecords.reduce((sum,row)=>sum+(row.waste??0),0)
 const wasteRate=weekPrepared?Math.round(weekWaste/weekPrepared*100):0
 const biggestLeftover=[...weekRecords].sort((a,b)=>(b.waste??0)-(a.waste??0))[0]
 const quickActions=[{label:"Plan today's meal",to:'/meal-planning',icon:CalendarDays},{label:'Generate AI recommendation',to:'/ai-recommendation',icon:Sparkles},{label:'Record consumption',to:'/consumption',icon:ClipboardList},{label:'View analytics',to:'/analytics',icon:ChartNoAxesCombined}]
 const kpis:[string,string,string,string,React.ElementType][]=[['Expected meal attendance',loading?'—':String(totalExpected),'students',"Based on today's meal plan",Users],['AI recommended servings',loading||!hasRecommendations?'—':String(recommendedTotal),'servings','Based on historical consumption',Sparkles],['Prepared today',recordedToday.length?String(preparedToday):'—','servings','Recorded preparation',ChefHat],["Today's waste",recordedToday.length?String(wasteToday):'—','servings','Prepared minus consumed.',Activity]]
 return <div className="content dashboard-content">
  <div className="welcome"><div><small className="eyebrow">MESS OPERATIONS · {formatted.toUpperCase()}</small><h1>Good morning, Mess Manager <span>✳</span></h1><p>Your kitchen at a glance. Make every serving count.</p></div><div className="dashboard-date"><CalendarDays size={16}/><span>{formatted}</span></div></div>
  {error&&<div className="form-error" role="alert">{error}</div>}
  <div className="kpis">
   {kpis.map(([label,value,unit,description,Icon])=><article className="card kpi" key={label}><div>{label}<i><Icon size={18}/></i></div><strong>{value}<small>{unit}</small></strong><p>{description}</p></article>)}
  </div>
  <div className="section-title"><div><h2>Today’s meals</h2><p>Saved meal plans for {currentDay}</p></div><span className="dashboard-live">● Database records</span></div>
  <div className="meals">{loading?<article className="card meal meal-polished">Loading today’s meals…</article>:meals.length?meals.map(({row,expectedStudents,predicted,recommended,hasResult})=><article className="card meal meal-polished" key={row.id}>
   <div className="meal-topline"><span className="meal-time">{row.mealType==='Lunch'?'12:30 PM':'7:30 PM'} <i>·</i> {row.mealType}</span><label className={hasResult?'status-recorded':'status-planned'}>{hasResult?'Recorded':'Plan ready'}</label></div>
   <div className="meal-food"><i><Utensils size={19}/></i><div><small>ON THE MENU</small><h3>{row.menu}</h3></div></div>
   <div className="meal-stats"><div><span>Expected students</span><b><Users size={14}/>{expectedStudents}</b></div><div><span>AI recommended</span><b><Sparkles size={14}/>{recommended??'—'} <small>servings</small></b></div></div>
   <div className="meal-record">Predicted {predicted??'—'} <span>·</span> Prepared {row.preparedQuantity??'—'} <span>·</span> Consumed {row.consumedQuantity??'—'}</div>
   {hasResult&&<div className="meal-record">Waste {row.waste??0} <span>·</span> Shortage {row.shortage??0} <span>·</span> Waste {row.wastePercentage??0}%</div>}
  </article>):<article className="card meal meal-polished">No meals have been saved for today yet.</article>}</div>
  <div className="section-title dashboard-subtitle"><div><h2>Meal performance</h2><p>Preparation matched to actual consumption</p></div></div>
  <div className="lower">
   <article className="card chart dashboard-chart"><div className="dashboard-card-heading"><div><h2>Prepared vs consumed</h2><p>Servings · latest 7 dates in your records</p></div><span className="chart-period">Recent history</span></div>
    <ResponsiveContainer width="100%" height={235}><BarChart data={chart} barGap={5} margin={{top:15,right:6,left:-17,bottom:0}}><CartesianGrid vertical={false} stroke="#edf0f3"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:11}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:10}}/><Tooltip cursor={{fill:'#f5f8f6'}} contentStyle={{border:'1px solid #edf0f3',borderRadius:10}}/><Bar dataKey="prepared" name="Prepared" fill="#dce8e2" radius={[5,5,0,0]}/><Bar dataKey="consumed" name="Consumed" fill="#1b7959" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer>
    <div className="chart-legend"><span><i className="prepared-dot"/>Prepared</span><span><i className="consumed-dot"/>Consumed</span></div>
   </article>
   <article className="card waste-card"><div className="waste-heading"><i><Activity size={18}/></i><div><small>WASTE OVERVIEW</small><h2>Food saved starts with a signal</h2></div></div><div className="waste-total">{weekWaste}<small> servings left over</small></div><div className="waste-caption">Across your latest {dated.length} recorded days</div><div className="waste-track"><span style={{width:Math.min(wasteRate*5,100)+'%'}}/></div><div className="waste-breakdown"><span>Waste rate (recent)</span><b>{wasteRate}% of prepared</b></div><div className="waste-breakdown"><span>Today’s totals</span><b>{recordedToday.length?String(wasteToday)+' waste · '+shortageToday+' shortage · '+wastePercentageToday+'%':'No completed meals'}</b></div>{biggestLeftover&&<div className="waste-note"><Activity size={14}/><span>Largest recorded leftover: <b>{biggestLeftover.menu}</b> · {biggestLeftover.waste??0} servings</span></div>}</article>
  </div>
  <div className="section-title dashboard-subtitle"><div><h2>Quick actions</h2><p>Keep today’s service moving</p></div></div>
  <div className="quick-actions">{quickActions.map(({label,to,icon:Icon})=><NavLink className="quick-action card" key={to} to={to}><i><Icon size={18}/></i><span>{label}</span><b>→</b></NavLink>)}</div>
  <div className="dashboard-foot"><span>● Recommendations use saved meals and database history</span><span>Waste is calculated by the backend from prepared and consumed servings</span></div>
 </div>
}
function Page({title,text}:{title:string;text:string}){return <div className="content"><small className="eyebrow">MESS OPERATIONS</small><h1>{title}</h1><p>{text}</p><article className="card placeholder"><Sparkles/><b>{title} workspace</b><p>Ready for mess workflows and local sample data. No external API required.</p></article></div>}
export default function App(){return <BrowserRouter><Shell/></BrowserRouter>}









