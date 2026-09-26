import { useMemo, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useEffect } from 'react'
import { Activity, ArrowDown, ArrowLeft, CheckCircle2, GraduationCap, ShieldCheck, Sparkles, Users, Utensils } from 'lucide-react'
import type { MealPlanResult } from './MealPlanning'
import { calculateWaste } from '../utils/calculations'

function mean(values: number[]) { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0 }
const formatDate = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })

import { api, type ApiPrediction } from '../services/api'
import type { MealRecord } from '../types'

export default function AIRecommendation() {
  const location = useLocation()
  const navigate = useNavigate()
  const [confirmed, setConfirmed] = useState(false)
  const [prediction, setPrediction] = useState<ApiPrediction | null>(null)
  const [history, setHistory] = useState<MealRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const routeState = location.state as MealPlanResult | null
  const mealPlan = routeState?.mealPlan ?? null

  useEffect(() => {
    let active = true
    if (!routeState?.mealId) {
      setError('No saved meal was provided. Plan and save a meal before requesting a demand prediction.')
      setLoading(false)
      return () => { active = false }
    }
    setLoading(true)
    setError('')
    Promise.all([api.createPrediction(routeState.mealId), api.getHistory()])
      .then(([result, rows]) => {
        if (!active) return
        setPrediction(result)
        const completedRows = rows.filter(row => row.preparedQuantity !== null && row.consumedQuantity !== null && row.predictedDemand !== null)
        setHistory(completedRows.map(row => ({
          date: row.date.slice(0, 10), weekday: row.weekday, meal: row.mealType, menu: row.menu,
          totalHostelStudents: row.totalHostelStudents, expectedStudents: row.expectedStudents,
          isCollegeDay: !row.holiday && row.collegeStatus === 'College Day', isHoliday: row.holiday,
          preparedQuantity: row.preparedQuantity!, consumedQuantity: row.consumedQuantity!, predictedDemand: row.predictedDemand!,
        })))
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not generate a demand prediction.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [routeState?.mealId])

  const menuHistory = useMemo(() => mealPlan ? history.filter(row => row.menu.toLowerCase() === mealPlan.menu.toLowerCase()) : [], [history, mealPlan?.menu])
  const weekdayHistory = useMemo(() => mealPlan ? history.filter(row => row.weekday === mealPlan.weekday && row.meal === mealPlan.meal) : [], [history, mealPlan?.weekday, mealPlan?.meal])
  const relevantHistory = menuHistory.length ? menuHistory : weekdayHistory
  const averagePrepared = mean(relevantHistory.map(row => row.preparedQuantity))
  const averageConsumed = mean(relevantHistory.map(row => row.consumedQuantity))
  const averageWaste = mean(relevantHistory.map(row => calculateWaste(row.preparedQuantity, row.consumedQuantity)))
  const totalHistoricalPrepared = relevantHistory.reduce((sum, row) => sum + row.preparedQuantity, 0)
  const totalHistoricalConsumed = relevantHistory.reduce((sum, row) => sum + row.consumedQuantity, 0)
  const consumptionRate = totalHistoricalPrepared ? Math.round(totalHistoricalConsumed / totalHistoricalPrepared * 100) : 0
  const historicalBaseline = relevantHistory.length ? Math.round(mean(relevantHistory.map(row => row.consumedQuantity))) : mealPlan?.expectedStudents ?? 0
  const buffer = prediction ? prediction.recommendedQuantity - prediction.predictedConsumption : 0
  const confidenceLabel = prediction ? prediction.confidence[0].toUpperCase() + prediction.confidence.slice(1) : '—'
  const confidenceExplanation = prediction ? `${prediction.historicalRecordsUsed} completed historical ${prediction.historicalRecordsUsed === 1 ? 'record was' : 'records were'} used` : ''

  if (loading) return <div className="content recommendation-content"><section className="card placeholder" role="status"><Sparkles/><b>Generating AI demand recommendation</b><p>Reading the saved meal and completed meal results from the database.</p></section></div>
  if (!mealPlan || !prediction) return <div className="content recommendation-content"><section className="card placeholder" role="alert"><Sparkles/><b>{error || 'A saved meal is required.'}</b><p>The recommendation uses historical meal consumption from the database.</p><NavLink className="button" to="/meal-planning">Plan a meal</NavLink></section></div>

  return <div className="content recommendation-content recommendation-page">
    <div className="recommendation-page-heading"><div><small className="eyebrow">MESS OPERATIONS · HISTORICAL MEAL CONSUMPTION</small><h1>AI Demand Recommendation</h1><p>Based on historical meal consumption.</p></div><NavLink className="recommendation-edit-link" to="/meal-planning"><ArrowLeft size={15}/> Edit meal plan</NavLink></div>
    <section className="card rec-summary"><div className="rec-summary-title"><div><i><Utensils size={17}/></i><div><small>MEAL PLAN SUMMARY · SAVED RECORD</small><h2>{mealPlan.menu} <span>· {mealPlan.meal}</span></h2></div></div><span className="rec-date">{formatDate(mealPlan.date)}</span></div><div className="rec-summary-grid"><div><small>DAY</small><b>{mealPlan.weekday}</b></div><div><small>EXPECTED STUDENTS</small><b><Users size={14}/>{mealPlan.expectedStudents} <em>of {mealPlan.totalHostelStudents}</em></b></div><div><small>COLLEGE STATUS</small><b><GraduationCap size={14}/>{mealPlan.dayStatus}</b></div>{mealPlan.event&&<div><small>EVENT</small><b>{mealPlan.event}</b></div>}</div></section>
    <section className="card rec-hero"><div className="rec-orbit"><Sparkles size={25}/></div><div className="rec-hero-copy"><small>DEMAND RECOMMENDATION · DATABASE HISTORY</small><div className="rec-quantity">{prediction.recommendedQuantity}<span> portions recommended</span></div><p>Predicted consumption: {prediction.predictedConsumption} portions · {mealPlan.menu} · {mealPlan.meal}</p></div><div className={'confidence confidence-'+prediction.confidence}><span><i/> {confidenceLabel} historical support</span><small>{confidenceExplanation}</small></div><div className="rec-hero-foot"><ShieldCheck size={15}/><span>Based on historical meal consumption with a configurable safety buffer.</span></div></section>
    <div className="rec-section-heading"><div><small>THE DATA BEHIND THE NUMBER</small><h2>Historical analysis</h2></div><span>{prediction.historicalRecordsUsed} records used by prediction · {menuHistory.length?'same menu':'meal type and weekday fallback'}</span></div>
    <section className="rec-history-grid"><article className="card rec-stat"><small>AVERAGE PREPARED</small><b>{relevantHistory.length?Math.round(averagePrepared):'—'} <em>portions</em></b><span>Across completed database records</span></article><article className="card rec-stat"><small>AVERAGE CONSUMED</small><b>{relevantHistory.length?Math.round(averageConsumed):'—'} <em>portions</em></b><span>Actual historical servings</span></article><article className="card rec-stat"><small>AVERAGE WASTE</small><b>{relevantHistory.length?Math.round(averageWaste):'—'} <em>portions</em></b><span>Prepared minus consumed</span></article><article className="card rec-stat rec-rate"><small>CONSUMPTION RATE</small><b>{relevantHistory.length?consumptionRate+'%':'—'}</b><span>Consumed / prepared total</span><div><i style={{width:consumptionRate+'%'}}/></div></article></section>
    <div className="rec-lower-grid"><section className="card rec-explain"><div className="rec-section-heading"><div><small>WHY THIS NUMBER?</small><h2>Prediction explanation</h2></div></div><div className="reason-list"><div className="reason-row"><i>1</i><p>{prediction.explanation}</p><CheckCircle2 size={16}/></div></div><div className="rec-confidence-note"><Activity size={15}/><span>Historical support reflects the number of completed database records used.</span></div></section><section className="card rec-breakdown"><div className="rec-section-heading"><div><small>FOLLOW THE CALCULATION</small><h2>Prediction breakdown</h2></div></div><div className="flow-list"><div className="flow-step"><i><Users size={15}/></i><span><small>EXPECTED STUDENTS</small><b>{mealPlan.expectedStudents}</b></span></div><ArrowDown className="flow-arrow" size={16}/><div className="flow-step"><i><Activity size={15}/></i><span><small>HISTORICAL CONSUMPTION BASELINE</small><b>{historicalBaseline} portions average</b></span></div><ArrowDown className="flow-arrow" size={16}/><div className="flow-step"><i><Sparkles size={15}/></i><span><small>PREDICTED CONSUMPTION</small><b>{prediction.predictedConsumption} portions</b></span></div><ArrowDown className="flow-arrow" size={16}/><div className="flow-step"><i><ShieldCheck size={15}/></i><span><small>SAFETY BUFFER</small><b>+{buffer} portions</b></span></div><ArrowDown className="flow-arrow" size={16}/><div className="flow-step flow-final"><i><CheckCircle2 size={15}/></i><span><small>RECOMMENDED QUANTITY</small><b>{prediction.recommendedQuantity} portions</b></span></div></div></section></div>
    <section className={'rec-confirm '+(confirmed?'is-confirmed':'')} aria-live="polite"><div><strong>{confirmed?'Recommendation confirmed':'Ready to confirm this preparation plan?'}</strong><span>{confirmed?'Ready to continue to meal closeout.':'You can adjust the meal details before confirming.'}</span></div>{confirmed?<button className="button rec-confirm-button" onClick={()=>navigate('/consumption',{state:{mealId:routeState?.mealId,mealPlan,prediction:{predictedDemand:prediction.predictedConsumption,recommendedQuantity:prediction.recommendedQuantity,reasons:[prediction.explanation]}}})}>Continue to Consumption <span>→</span></button>:<button className="button rec-confirm-button" onClick={()=>setConfirmed(true)}><CheckCircle2 size={16}/>Confirm Recommendation</button>}</section>
  </div>
}
