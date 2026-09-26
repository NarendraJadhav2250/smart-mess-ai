
import {useState} from 'react'
import {BrowserRouter,Routes,Route,Navigate,NavLink,useLocation} from 'react-router-dom'
import {Activity,Bell,CalendarDays,ChartNoAxesCombined,ChefHat,ClipboardList,History,Home,Lightbulb,Menu,Settings,Sparkles,Users,Utensils} from 'lucide-react'
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts'
import {mockMeals} from './data/mockMeals'
import {getMealHistory} from './utils/mealResults'
import {predictDemand} from './utils/prediction'
import {calculateWaste} from './utils/calculations'
import MealPlanning from './pages/MealPlanning'
import AIRecommendation from './pages/AIRecommendation'
import Consumption from './pages/Consumption'
import HistoryPage from './pages/History'
import Analytics from './pages/Analytics'
import Insights from './pages/Insights'
import './App.css'
const nav=[['Dashboard','/dashboard',Home],["Today's Meal",'/meal-planning',Utensils],['AI Recommendation','/ai-recommendation',Sparkles],['Consumption','/consumption',ClipboardList],['History','/history',History],['Analytics','/analytics',ChartNoAxesCombined],['AI Insights','/insights',Lightbulb]] as const
const date=new Date(),weekday=date.toLocaleDateString('en-US',{weekday:'long'}),formatted=date.toLocaleDateString('en-IN',{weekday:'long',day:'numeric',month:'long',year:'numeric'})
const todays=mockMeals.filter(m=>m.day===weekday),lunch=todays.find(m=>m.meal==='Lunch')??mockMeals[0],dinner=todays.find(m=>m.meal==='Dinner')??mockMeals[1]
function Shell(){const [menuOpen,setMenuOpen]=useState(false);const path=useLocation().pathname,title=nav.find(n=>n[1]===path)?.[0]??'Dashboard';return <div className="layout"><aside className={menuOpen?"sidebar-open":""}><div className="brand"><i><ChefHat/></i><div><b>Smart Mess AI</b><small>Demand intelligence</small></div></div><small className="caption">WORKSPACE</small><nav>{nav.map(([label,to,Icon])=><NavLink key={to} to={to}><Icon size={18}/>{label}</NavLink>)}</nav><div className="sidebottom"><div className="sustain"><Activity/><b>Less waste, better meals.</b><p>Every smart serving makes a difference.</p></div><NavLink to="/settings"><Settings size={18}/>Settings</NavLink><div className="profile"><i>AM</i><span><b>Admin Manager</b><small>Mess administrator</small></span></div></div></aside><main><header><button className="mobile" aria-label="Open navigation" onClick={()=>setMenuOpen(!menuOpen)}><Menu/></button><div>Workspace <span>/</span> <b>{title}</b></div><section><small><CalendarDays size={15}/>{formatted}</small><button aria-label="Notifications"><Bell/></button><b className="manager">AM &nbsp; Admin Manager</b></section></header><Routes><Route path="/" element={<Navigate to="/dashboard" replace/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/meal-planning" element={<MealPlanning/>}/><Route path="/ai-recommendation" element={<AIRecommendation/>}/><Route path="/consumption" element={<Consumption/>}/><Route path="/history" element={<HistoryPage/>}/><Route path="/analytics" element={<Analytics/>}/><Route path="/insights" element={<Insights/>}/><Route path="/settings" element={<Page title="Settings" text="Manage local mess preferences and operating assumptions."/>}/><Route path="*" element={<Navigate to="/dashboard" replace/>}/></Routes></main></div>}
function Dashboard(){
 const history=getMealHistory()
 const today=new Date();const todayKey=[today.getFullYear(),String(today.getMonth()+1).padStart(2,'0'),String(today.getDate()).padStart(2,'0')].join('-')
 const currentDay=today.toLocaleDateString('en-US',{weekday:'long'})
 const todaysRecords=history.filter(row=>row.date===todayKey)
 const expectedFor=(menu:string,meal:string)=>{
  const exact=todaysRecords.find(row=>row.menu===menu)
  if(exact)return exact.expectedStudents
  const sameMenu=history.filter(row=>row.menu===menu)
  const sameDay=history.filter(row=>row.weekday===currentDay&&row.meal===meal)
  const source=sameMenu.length?sameMenu:sameDay.length?sameDay:history
  return Math.round(source.reduce((sum,row)=>sum+row.expectedStudents,0)/source.length)
 }
 const meals=[lunch,dinner].map(item=>{
  const expectedStudents=expectedFor(item.menu,item.meal)
  const recommendation=predictDemand({menu:item.menu,weekday:currentDay,expectedStudents,isCollegeDay:true,isHoliday:false,history:history})
  const record=todaysRecords.find(row=>row.menu===item.menu)
  return {item,expectedStudents,recommended:recommendation.recommendedQuantity,record,status:record?'Recorded':'Plan ready'}
 })
 const totalExpected=meals[0].expectedStudents
 const recommendedTotal=meals.reduce((sum,meal)=>sum+meal.recommended,0)
 const preparedToday=todaysRecords.reduce((sum,row)=>sum+row.preparedQuantity,0)
 const wasteToday=todaysRecords.reduce((sum,row)=>sum+calculateWaste(row.preparedQuantity,row.consumedQuantity),0)
 const dated=[...new Set(history.map(row=>row.date))].sort().slice(-7)
 const chart=dated.map(dateKey=>{
  const records=history.filter(row=>row.date===dateKey)
  return {day:records[0].weekday.slice(0,3),prepared:records.reduce((sum,row)=>sum+row.preparedQuantity,0),consumed:records.reduce((sum,row)=>sum+row.consumedQuantity,0)}
 })
 const weekRecords=history.filter(row=>dated.includes(row.date))
 const weekPrepared=weekRecords.reduce((sum,row)=>sum+row.preparedQuantity,0)
 const weekWaste=weekRecords.reduce((sum,row)=>sum+calculateWaste(row.preparedQuantity,row.consumedQuantity),0)
 const wasteRate=weekPrepared?Math.round(weekWaste/weekPrepared*100):0
 const biggestLeftover=[...weekRecords].sort((a,b)=>calculateWaste(b.preparedQuantity,b.consumedQuantity)-calculateWaste(a.preparedQuantity,a.consumedQuantity))[0]
 const quickActions=[{label:"Plan today's meal",to:'/meal-planning',icon:CalendarDays},{label:'Generate AI recommendation',to:'/ai-recommendation',icon:Sparkles},{label:'Record consumption',to:'/consumption',icon:ClipboardList},{label:'View analytics',to:'/analytics',icon:ChartNoAxesCombined}]
 const kpis:[string,string,string,React.ElementType][]=[['Expected students',String(totalExpected),'students',Users],['AI recommended quantity',String(recommendedTotal),'servings',Sparkles],['Prepared today',preparedToday?String(preparedToday):'—','servings',ChefHat],["Today's waste",todaysRecords.length?String(wasteToday):'—','servings',Activity]]
 return <div className="content dashboard-content">
  <div className="welcome"><div><small className="eyebrow">MESS OPERATIONS · {formatted.toUpperCase()}</small><h1>Good morning, Mess Manager <span>✳</span></h1><p>Your kitchen at a glance. Make every serving count.</p></div><div className="dashboard-date"><CalendarDays size={16}/><span>{formatted}</span></div></div>
  <div className="kpis">
   {kpis.map(([label,value,unit,Icon])=><article className="card kpi" key={label}><div>{label}<i><Icon size={18}/></i></div><strong>{value}<small>{unit}</small></strong><p>{label==="Today's waste"?'Calculated from recorded meals':label==='Prepared today'?'Recorded preparation':'Based on local meal history'}</p></article>)}
  </div>
  <div className="section-title"><div><h2>Today’s meals</h2><p>Smart preparation plan for {currentDay}</p></div><span className="dashboard-live">● Local forecast</span></div>
  <div className="meals">{meals.map(({item,expectedStudents,recommended,record,status})=><article className="card meal meal-polished" key={item.meal}>
   <div className="meal-topline"><span className="meal-time">{item.meal==='Lunch'?'12:30 PM':'7:30 PM'} <i>·</i> {item.meal}</span><label className={record?'status-recorded':'status-planned'}>{status}</label></div>
   <div className="meal-food"><i><Utensils size={19}/></i><div><small>ON THE MENU</small><h3>{item.menu}</h3></div></div>
   <div className="meal-stats"><div><span>Expected students</span><b><Users size={14}/>{expectedStudents}</b></div><div><span>AI recommended</span><b><Sparkles size={14}/>{recommended} <small>servings</small></b></div></div>
   {record&&<div className="meal-record">Prepared {record.preparedQuantity} <span>·</span> Consumed {record.consumedQuantity}</div>}
  </article>)}</div>
  <div className="section-title dashboard-subtitle"><div><h2>Meal performance</h2><p>Preparation matched to actual consumption</p></div></div>
  <div className="lower">
   <article className="card chart dashboard-chart"><div className="dashboard-card-heading"><div><h2>Prepared vs consumed</h2><p>Servings · latest 7 dates in your records</p></div><span className="chart-period">Recent history</span></div>
    <ResponsiveContainer width="100%" height={235}><BarChart data={chart} barGap={5} margin={{top:15,right:6,left:-17,bottom:0}}><CartesianGrid vertical={false} stroke="#edf0f3"/><XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:11}}/><YAxis axisLine={false} tickLine={false} tick={{fill:'#8993a1',fontSize:10}}/><Tooltip cursor={{fill:'#f5f8f6'}} contentStyle={{border:'1px solid #edf0f3',borderRadius:10}}/><Bar dataKey="prepared" name="Prepared" fill="#dce8e2" radius={[5,5,0,0]}/><Bar dataKey="consumed" name="Consumed" fill="#1b7959" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer>
    <div className="chart-legend"><span><i className="prepared-dot"/>Prepared</span><span><i className="consumed-dot"/>Consumed</span></div>
   </article>
   <article className="card waste-card"><div className="waste-heading"><i><Activity size={18}/></i><div><small>WASTE OVERVIEW</small><h2>Food saved starts with a signal</h2></div></div><div className="waste-total">{weekWaste}<small> servings left over</small></div><div className="waste-caption">Across your latest {dated.length} recorded days</div><div className="waste-track"><span style={{width:Math.min(wasteRate*5,100)+'%'}}/></div><div className="waste-breakdown"><span>Waste rate</span><b>{wasteRate}% of prepared</b></div><div className="waste-breakdown"><span>Today</span><b>{todaysRecords.length?wasteToday+' servings':'No meal data yet'}</b></div>{biggestLeftover&&<div className="waste-note"><Activity size={14}/><span>Largest recorded leftover: <b>{biggestLeftover.menu}</b> · {calculateWaste(biggestLeftover.preparedQuantity,biggestLeftover.consumedQuantity)} servings</span></div>}</article>
  </div>
  <div className="section-title dashboard-subtitle"><div><h2>Quick actions</h2><p>Keep today’s service moving</p></div></div>
  <div className="quick-actions">{quickActions.map(({label,to,icon:Icon})=><NavLink className="quick-action card" key={to} to={to}><i><Icon size={18}/></i><span>{label}</span><b>→</b></NavLink>)}</div>
  <div className="dashboard-foot"><span>● Recommendations use local historical data</span><span>Waste is calculated from prepared and consumed servings</span></div>
 </div>
}
function Page({title,text}:{title:string;text:string}){return <div className="content"><small className="eyebrow">MESS OPERATIONS</small><h1>{title}</h1><p>{text}</p><article className="card placeholder"><Sparkles/><b>{title} workspace</b><p>Ready for mess workflows and local sample data. No external API required.</p></article></div>}
export default function App(){return <BrowserRouter><Shell/></BrowserRouter>}









