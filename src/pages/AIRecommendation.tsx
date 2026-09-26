import { useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowDown, ArrowLeft, CheckCircle2, GraduationCap, ShieldCheck, Sparkles, Users, Utensils } from 'lucide-react'
import type { MealPlanInput, MealPlanResult } from './MealPlanning'
import { mockMeals } from '../data/mockMeals'
import { getMealHistory } from '../utils/mealResults'
import { predictDemand } from '../utils/prediction'
import { calculateWaste } from '../utils/calculations'

function localDateString(date: Date) {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
}
function buildDefaultPlan(): MealPlanInput {
  const history = getMealHistory()
  const date = localDateString(new Date())
  const weekday = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
  const menu = mockMeals.find(item => item.day === weekday && item.meal === 'Lunch')?.menu ?? mockMeals[0].menu
  const matching = history.filter(row => row.menu === menu)
  const sameDay = history.filter(row => row.weekday === weekday && row.meal === 'Lunch')
  const expectedSource = matching.length ? matching : sameDay.length ? sameDay : history
  const expectedStudents = Math.round(expectedSource.reduce((sum, row) => sum + row.expectedStudents, 0) / expectedSource.length)
  const totalHostelStudents = Math.round(history.reduce((sum, row) => sum + row.totalHostelStudents, 0) / history.length)
  return { date, weekday, meal: 'Lunch', menu, totalHostelStudents, expectedStudents, dayStatus: 'College Day', event: '', notes: '' }
}
function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
const formatDate = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

export default function AIRecommendation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)
  const history = useMemo(() => getMealHistory(), [])
  const routeState = location.state as MealPlanResult | null
  const mealPlan = routeState?.mealPlan ?? buildDefaultPlan()
  const prediction = predictDemand({
    menu: mealPlan.menu,
    weekday: mealPlan.weekday,
    expectedStudents: mealPlan.expectedStudents,
    isCollegeDay: mealPlan.dayStatus === 'College Day',
    isHoliday: mealPlan.dayStatus === 'Holiday',
    history: history,
  })
  const menuHistory = useMemo(() => history.filter(row => row.menu.toLowerCase() === mealPlan.menu.toLowerCase()), [mealPlan.menu])
  const weekdayHistory = useMemo(() => history.filter(row => row.weekday === mealPlan.weekday), [mealPlan.weekday])
  const relevantHistory = menuHistory.length ? menuHistory : weekdayHistory
  const averagePrepared = mean(relevantHistory.map(row => row.preparedQuantity))
  const averageConsumed = mean(relevantHistory.map(row => row.consumedQuantity))
  const averageWaste = mean(relevantHistory.map(row => calculateWaste(row.preparedQuantity, row.consumedQuantity)))
  const totalHistoricalPrepared = relevantHistory.reduce((sum, row) => sum + row.preparedQuantity, 0)
  const totalHistoricalConsumed = relevantHistory.reduce((sum, row) => sum + row.consumedQuantity, 0)
  const consumptionRate = totalHistoricalPrepared ? Math.round(totalHistoricalConsumed / totalHistoricalPrepared * 100) : 0
  const confidence = relevantHistory.length >= 8 ? 'High' : relevantHistory.length >= 3 ? 'Medium' : 'Low'
  const confidenceExplanation = confidence === 'High' ? '8+ relevant historical meals' : confidence === 'Medium' ? '3–7 relevant historical meals' : 'Fewer than 3 relevant historical meals'
  const historicalBaseline = relevantHistory.length ? Math.round(mean(relevantHistory.map(row => row.consumedQuantity))) : mealPlan.expectedStudents
  const buffer = prediction.recommendedQuantity - prediction.predictedDemand
  const attendanceRate = mealPlan.totalHostelStudents ? Math.round(mealPlan.expectedStudents / mealPlan.totalHostelStudents * 100) : 0
  const isWeekend = mealPlan.weekday === 'Saturday' || mealPlan.weekday === 'Sunday'
  const reasons = [
    menuHistory.length
      ? `Menu history: ${menuHistory.length} matching meals averaged ${Math.round(mean(menuHistory.map(row => row.consumedQuantity)))} consumed portions.`
      : `Menu history: no ${mealPlan.menu} records yet, so ${relevantHistory.length} ${mealPlan.weekday} records were used as a fallback.`,
    isWeekend
      ? `Day-of-week pattern: the lower weekend attendance pattern reduced the estimate by 7%.`
      : `Day-of-week pattern: ${mealPlan.weekday} weekday attendance pattern was included.`,
    `Expected attendance: ${mealPlan.expectedStudents} of ${mealPlan.totalHostelStudents} hostel students (${attendanceRate}%) informed the estimate.`,
    mealPlan.dayStatus === 'Holiday'
      ? 'Holiday effect: the historical holiday attendance adjustment was applied.'
      : mealPlan.dayStatus === 'College Day'
        ? 'College effect: the regular college-day attendance pattern was applied.'
        : 'College effect: the non-college day attendance adjustment was applied.',
    `Safety buffer: ${buffer} extra portions were added (3.5% buffer, rounded up).`,
  ]
  const confirmRecommendation = () => setConfirmed(true)

  return <div className="content recommendation-content recommendation-page">
    <div className="recommendation-page-heading">
      <div><small className="eyebrow">MESS OPERATIONS · EXPLAINABLE FORECAST</small><h1>AI Recommendation</h1><p>A clear, history-based preparation plan your team can review and trust.</p></div>
      <NavLink className="recommendation-edit-link" to="/meal-planning"><ArrowLeft size={15}/> Edit meal plan</NavLink>
    </div>

    <section className="card rec-summary">
      <div className="rec-summary-title"><div><i><Utensils size={17}/></i><div><small>MEAL PLAN SUMMARY</small><h2>{mealPlan.menu} <span>· {mealPlan.meal}</span></h2></div></div><span className="rec-date">{formatDate(mealPlan.date)}</span></div>
      <div className="rec-summary-grid"><div><small>DAY</small><b>{mealPlan.weekday}</b></div><div><small>EXPECTED STUDENTS</small><b><Users size={14}/>{mealPlan.expectedStudents} <em>of {mealPlan.totalHostelStudents}</em></b></div><div><small>COLLEGE STATUS</small><b><GraduationCap size={14}/>{mealPlan.dayStatus}</b></div>{mealPlan.event&&<div><small>EVENT</small><b>{mealPlan.event}</b></div>}</div>
    </section>

    <section className="card rec-hero">
      <div className="rec-orbit"><Sparkles size={25}/></div>
      <div className="rec-hero-copy"><small>AI RECOMMENDED PREPARATION</small><div className="rec-quantity">{prediction.recommendedQuantity}<span> portions</span></div><p>Recommended for {mealPlan.menu} · {mealPlan.meal}</p></div>
      <div className={'confidence confidence-'+confidence.toLowerCase()}><span><i/> {confidence} confidence</span><small>{confidenceExplanation}</small></div>
      <div className="rec-hero-foot"><ShieldCheck size={15}/><span>Recommendation calculated from your historical consumption, attendance, and a clear safety buffer.</span></div>
    </section>

    <div className="rec-section-heading"><div><small>THE DATA BEHIND THE NUMBER</small><h2>Historical analysis</h2></div><span>{relevantHistory.length} relevant {relevantHistory.length===1?'record':'records'} · {menuHistory.length?'same menu':'weekday fallback'}</span></div>
    <section className="rec-history-grid">
      <article className="card rec-stat"><small>AVERAGE PREPARED</small><b>{relevantHistory.length?Math.round(averagePrepared):'—'} <em>portions</em></b><span>Across the relevant sample</span></article>
      <article className="card rec-stat"><small>AVERAGE CONSUMED</small><b>{relevantHistory.length?Math.round(averageConsumed):'—'} <em>portions</em></b><span>Actual historical servings</span></article>
      <article className="card rec-stat"><small>AVERAGE WASTE</small><b>{relevantHistory.length?Math.round(averageWaste):'—'} <em>portions</em></b><span>Prepared minus consumed</span></article>
      <article className="card rec-stat rec-rate"><small>CONSUMPTION RATE</small><b>{relevantHistory.length?consumptionRate+'%':'—'}</b><span>Consumed / prepared total</span><div><i style={{width:consumptionRate+'%'}}/></div></article>
    </section>

    <div className="rec-lower-grid">
      <section className="card rec-explain"><div className="rec-section-heading"><div><small>NO BLACK BOX</small><h2>Why this recommendation?</h2></div></div><div className="reason-list">{reasons.map((reason,index)=><div className="reason-row" key={reason}><i>{index+1}</i><p>{reason}</p><CheckCircle2 size={16}/></div>)}</div><div className="rec-confidence-note"><Activity size={15}/><span>Confidence is based on the number of relevant past meals, not a claim of model certainty.</span></div></section>
      <section className="card rec-breakdown"><div className="rec-section-heading"><div><small>FOLLOW THE CALCULATION</small><h2>Prediction breakdown</h2></div></div><div className="flow-list">
        <div className="flow-step"><i><Users size={15}/></i><span><small>EXPECTED STUDENTS</small><b>{mealPlan.expectedStudents}</b></span></div><ArrowDown className="flow-arrow" size={16}/>
        <div className="flow-step"><i><Activity size={15}/></i><span><small>HISTORICAL CONSUMPTION</small><b>{historicalBaseline} portions average</b></span></div><ArrowDown className="flow-arrow" size={16}/>
        <div className="flow-step"><i><Sparkles size={15}/></i><span><small>DEMAND PREDICTION</small><b>{prediction.predictedDemand} portions</b></span></div><ArrowDown className="flow-arrow" size={16}/>
        <div className="flow-step"><i><ShieldCheck size={15}/></i><span><small>SAFETY BUFFER · 3.5%</small><b>+{buffer} portions</b></span></div><ArrowDown className="flow-arrow" size={16}/>
        <div className="flow-step flow-final"><i><CheckCircle2 size={15}/></i><span><small>RECOMMENDED QUANTITY</small><b>{prediction.recommendedQuantity} portions</b></span></div>
      </div></section>
    </div>

    <section className={'rec-confirm '+(confirmed?'is-confirmed':'')} aria-live="polite">
      <div><strong>{confirmed?'Recommendation confirmed':'Ready to confirm this preparation plan?'}</strong><span>{confirmed?'Ready to continue to meal closeout.':'You can adjust the meal details before confirming.'}</span></div>
      {confirmed
        ? <button className="button rec-confirm-button" onClick={()=>navigate('/consumption', { state: { mealId: routeState?.mealId, mealPlan, prediction } })}>Continue to Consumption <span>→</span></button>
        : <button className="button rec-confirm-button" onClick={confirmRecommendation}><CheckCircle2 size={16}/>Confirm Recommendation</button>}
    </section>
  </div>
}

