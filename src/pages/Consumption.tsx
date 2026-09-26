import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, ClipboardList, Users, Utensils } from 'lucide-react'
import type { MealPlanInput, MealPlanResult } from './MealPlanning'
import { api, type ApiMeal } from '../services/api'
import { mockHistory } from '../data/mockHistory'
import { predictDemand } from '../utils/prediction'
import { calculateShortage, calculateWaste } from '../utils/calculations'

type Prediction = ReturnType<typeof predictDemand>
type MealContext = { mealId: string; plan: MealPlanInput; prediction: Prediction }
function formatDate(date: string) {
  return new Date(date + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}
function makeContext(meal: ApiMeal, prediction?: Prediction): MealContext {
  const date = meal.date.slice(0, 10)
  const plan: MealPlanInput = {
    date, weekday: meal.day, meal: meal.mealType, menu: meal.menu,
    totalHostelStudents: meal.hostelStudents, expectedStudents: meal.expectedStudents,
    dayStatus: meal.holiday ? 'Holiday' : meal.collegeStatus,
    event: meal.event, notes: meal.notes,
  }
  const estimate = prediction ?? predictDemand({
    menu: meal.menu,
    weekday: meal.day,
    expectedStudents: meal.expectedStudents,
    isCollegeDay: meal.collegeStatus === 'College Day',
    isHoliday: meal.holiday,
    history: mockHistory,
  })
  return { mealId: meal.id, plan, prediction: estimate }
}
const routeContext = (value: unknown): MealContext | null => {
  const state = value as (MealPlanResult & { mealId?: string }) | null
  return state?.mealId && state.mealPlan && state.prediction
    ? { mealId: state.mealId, plan: state.mealPlan, prediction: state.prediction }
    : null
}

export default function Consumption() {
  const location = useLocation()
  const [context, setContext] = useState<MealContext | null>(() => routeContext(location.state))
  const [loadingContext, setLoadingContext] = useState(() => !routeContext(location.state))
  const [preparedValue, setPreparedValue] = useState('')
  const [consumedValue, setConsumedValue] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const prepared = Number(preparedValue) || 0
  const consumed = Number(consumedValue) || 0
  const waste = calculateWaste(prepared, consumed)
  const shortage = calculateShortage(prepared, consumed)
  const wastePercentage = prepared ? waste / prepared * 100 : 0

  useEffect(() => {
    const current = routeContext(location.state)
    if (current) {
      setContext(current)
      setLoadingContext(false)
      return
    }
    let active = true
    api.getMeals(1).then(meals => {
      if (!active) return
      const latest = meals[0]
      if (latest) {
        const prediction = latest.result
          ? { predictedDemand: latest.result.predictedConsumption, recommendedQuantity: latest.result.recommendedQuantity, reasons: [] }
          : undefined
        setContext(makeContext(latest, prediction))
      } else {
        setError('No meal plan is saved yet. Plan a meal before recording consumption.')
      }
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load the saved meal plan.')
    }).finally(() => { if (active) setLoadingContext(false) })
    return () => { active = false }
  }, [location.state])

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!context) return
    if (preparedValue === '' || consumedValue === '' || prepared < 0 || consumed < 0) {
      setError('Enter both prepared and consumed quantities. Use zero if none were served.')
      return
    }
    if (!Number.isInteger(prepared) || !Number.isInteger(consumed)) {
      setError('Enter whole serving counts for prepared and consumed food.')
      return
    }
    setError('')
    setSuccess(false)
    try {
      await api.createMealResult({
        mealId: context.mealId,
        predictedConsumption: context.prediction.predictedDemand,
        recommendedQuantity: context.prediction.recommendedQuantity,
        preparedQuantity: prepared,
        consumedQuantity: consumed,
      })
      setSuccess(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the meal result.')
    }
  }
  const updatePrepared = (value: string) => { setPreparedValue(value); setSuccess(false); setError('') }
  const updateConsumed = (value: string) => { setConsumedValue(value); setSuccess(false); setError('') }

  if (!context && !loadingContext) {
    return <div className="content consumption-content">
      <div className="consumption-heading"><div><small className="eyebrow">MESS OPERATIONS · MEAL CLOSEOUT</small><h1>Record consumption</h1><p>Capture actual servings after the meal is prepared.</p></div><span className="consumption-local"><ClipboardCheck size={15}/> Database record</span></div>
      <section className="card placeholder" role="status"><ClipboardList/><b>{error || 'No meal plan is available.'}</b><p>Create a meal plan first. Saved plans and results are stored in the SQLite database.</p><NavLink className="button" to="/meal-planning">Plan a meal</NavLink></section>
    </div>
  }

  if (loadingContext || !context) {
    return <div className="content consumption-content"><section className="card placeholder" role="status"><ClipboardList/><b>Loading saved meal…</b><p>Connecting to the meal service.</p></section></div>
  }

  const { plan, prediction } = context
  return <div className="content consumption-content">
    <div className="consumption-heading"><div><small className="eyebrow">MESS OPERATIONS · MEAL CLOSEOUT</small><h1>Record consumption</h1><p>Capture what was prepared and served to keep future recommendations grounded in real results.</p></div><span className="consumption-local"><ClipboardCheck size={15}/> Database record</span></div>
    <div className="consumption-layout">
      <form className="card consumption-form" onSubmit={save} noValidate>
        <div className="form-section-heading"><i><ClipboardList size={18}/></i><div><h2>Meal result</h2><p>Confirm the service and enter actual serving counts.</p></div></div>
        <div className="consumption-context">
          <div><small>DATE</small><b>{formatDate(plan.date)}</b></div>
          <div><small>MEAL</small><b>{plan.meal}</b></div>
          <div><small>MENU</small><b><Utensils size={14}/>{plan.menu}</b></div>
          <div><small>AI RECOMMENDED</small><b className="recommended-value">{prediction.recommendedQuantity} <em>portions</em></b></div>
        </div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="consumption-inputs">
          <label className="field"><span>Food prepared <b>*</b></span><div className="input-with-icon"><ClipboardList size={16}/><input type="number" min="0" step="1" inputMode="numeric" placeholder="Enter portions prepared" value={preparedValue} onChange={event => updatePrepared(event.target.value)} required/></div><small>Total portions made for this service.</small></label>
          <label className="field"><span>Food consumed <b>*</b></span><div className="input-with-icon"><Users size={16}/><input type="number" min="0" step="1" inputMode="numeric" placeholder="Enter portions consumed" value={consumedValue} onChange={event => updateConsumed(event.target.value)} required/></div><small>Total portions served and consumed.</small></label>
        </div>
        <div className="consumption-save-row"><span><b>*</b> Required fields</span><button className="button consumption-save" type="submit"><CheckCircle2 size={16}/>Save Meal Result</button></div>
        {success&&<div className="save-success" role="status"><CheckCircle2 size={17}/><span><b>Meal result saved.</b> It is now stored in the database and available through the History API.</span></div>}
      </form>
      <aside className="card consumption-help"><div className="consumption-help-icon"><Utensils size={18}/></div><h2>Close the feedback loop</h2><p>Actual meal results help the demand engine learn from what students really ate.</p><div><CheckCircle2 size={15}/> Waste and shortage are calculated on the server.</div><div><CheckCircle2 size={15}/> Saved in SQLite through the meal-results API.</div></aside>
    </div>
    <section className="consumption-results">
      <div className="consumption-result-heading"><div><small>LIVE CALCULATION</small><h2>Meal result</h2></div><span>Updates as quantities change</span></div>
      <div className="result-grid">
        <article className="card result-tile"><small>PREPARED</small><b>{preparedValue===''?'—':prepared}</b><span>portions</span></article>
        <article className="card result-tile"><small>CONSUMED</small><b>{consumedValue===''?'—':consumed}</b><span>portions</span></article>
        <article className="card result-tile result-waste"><small>WASTE</small><b>{preparedValue===''||consumedValue===''?'—':waste}</b><span>portions</span></article>
        <article className="card result-tile result-shortage"><small>SHORTAGE</small><b>{preparedValue===''||consumedValue===''?'—':shortage}</b><span>portions</span></article>
        <article className="card result-tile result-percent"><small>WASTE %</small><b>{preparedValue===''||consumedValue===''?'—':wastePercentage.toFixed(1)+'%'}</b><span>of prepared food</span></article>
      </div>
      <p className="consumption-formula">Waste = prepared − consumed when prepared is higher. Shortage = consumed − prepared when consumption is higher.</p>
    </section>
  </div>
}
