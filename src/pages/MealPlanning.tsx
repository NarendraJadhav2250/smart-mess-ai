import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, CheckCircle2, ClipboardList, GraduationCap, Sparkles, Users } from 'lucide-react'
import { predictDemand } from '../utils/prediction'
import { api, type ApiMeal, type ApiMenu } from '../services/api'

type MealName = 'Lunch' | 'Dinner'
type DayStatus = 'College Day' | 'Non-college Day' | 'Holiday'
export type MealPlanInput = {
  date: string; weekday: string; meal: MealName; menu: string; totalHostelStudents: number
  expectedStudents: number; dayStatus: DayStatus; event: string; notes: string
}
export type MealPlanResult = {
  mealId: string; mealPlan: MealPlanInput; prediction: ReturnType<typeof predictDemand>
}
type HistoryRow = Awaited<ReturnType<typeof api.getHistory>>[number]

const localDateString = (date: Date) => [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-')
const weekdayFor = (value: string) => new Date(value + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' })
const average = (items: number[]) => items.length ? Math.round(items.reduce((sum, item) => sum + item, 0) / items.length) : 0
const mealMenu = (row: ApiMenu, meal: MealName) => meal === 'Lunch' ? row.lunch : row.dinner

function scheduledMenu(date: string, meal: MealName, menuRows: ApiMenu[]) {
  const row = menuRows.find(item => item.day === weekdayFor(date))
  return row ? mealMenu(row, meal) : ''
}
function expectedFromHistory(date: string, meal: MealName, menu: string, rows: HistoryRow[]) {
  const exact = rows.find(row => row.date.slice(0, 10) === date && row.menu === menu && row.mealType === meal)
  if (exact) return exact.expectedStudents
  const byMenu = rows.filter(row => row.menu === menu && row.mealType === meal)
  if (byMenu.length) return average(byMenu.map(row => row.expectedStudents))
  const byDay = rows.filter(row => row.day === weekdayFor(date) && row.mealType === meal)
  return average((byDay.length ? byDay : rows).map(row => row.expectedStudents))
}
function toPredictionHistory(rows: HistoryRow[]) {
  return rows.filter((row): row is HistoryRow & { preparedQuantity: number; consumedQuantity: number; predictedDemand: number } =>
    row.preparedQuantity !== null && row.consumedQuantity !== null && row.predictedDemand !== null,
  ).map(row => ({
    date: row.date.slice(0, 10), weekday: row.weekday, meal: row.mealType, menu: row.menu,
    totalHostelStudents: row.totalHostelStudents, expectedStudents: row.expectedStudents,
    isCollegeDay: !row.holiday && row.collegeStatus === 'College Day', isHoliday: row.holiday,
    preparedQuantity: row.preparedQuantity, consumedQuantity: row.consumedQuantity, predictedDemand: row.predictedDemand,
  }))
}

export default function MealPlanning() {
  const navigate = useNavigate()
  const initialDate = localDateString(new Date())
  const [date, setDate] = useState(initialDate)
  const [meal, setMeal] = useState<MealName>('Lunch')
  const [menu, setMenu] = useState('')
  const [menuRows, setMenuRows] = useState<ApiMenu[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [totalStudents, setTotalStudents] = useState(0)
  const [expectedStudents, setExpectedStudents] = useState(0)
  const [dayStatus, setDayStatus] = useState<DayStatus>('College Day')
  const [event, setEvent] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([api.getMenu(), api.getHistory()])
      .then(([menus, rows]) => {
        if (!active) return
        setMenuRows(menus)
        setHistory(rows)
        const currentMenu = scheduledMenu(initialDate, 'Lunch', menus)
        setMenu(currentMenu)
        setTotalStudents(average(rows.map(row => row.totalHostelStudents)))
        setExpectedStudents(expectedFromHistory(initialDate, 'Lunch', currentMenu, rows))
      })
      .catch(reason => {
        if (active) setError(reason instanceof Error ? reason.message : 'Could not load meal planning data.')
      })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [initialDate])

  const menus = useMemo(() => [...new Set(menuRows.map(row => mealMenu(row, meal)).filter(Boolean))], [meal, menuRows])
  const lunchMenu = menuRows.find(row => row.day === weekdayFor(date))?.lunch
  const dinnerMenu = menuRows.find(row => row.day === weekdayFor(date))?.dinner

  const changeDate = (value: string) => {
    setDate(value)
    const nextMenu = scheduledMenu(value, meal, menuRows)
    setMenu(nextMenu)
    setExpectedStudents(expectedFromHistory(value, meal, nextMenu, history))
  }
  const changeMeal = (value: MealName) => {
    setMeal(value)
    const nextMenu = scheduledMenu(date, value, menuRows)
    setMenu(nextMenu)
    setExpectedStudents(expectedFromHistory(date, value, nextMenu, history))
  }
  const changeMenu = (value: string) => {
    setMenu(value)
    setExpectedStudents(expectedFromHistory(date, meal, value, history))
  }
  const submit = async (formEvent: FormEvent<HTMLFormElement>) => {
    formEvent.preventDefault()
    if (!date || !menu || totalStudents < 1 || expectedStudents < 1) {
      setError('Complete all required fields with a value greater than zero.')
      return
    }
    if (expectedStudents > totalStudents) {
      setError('Expected students cannot exceed the total number of hostel students.')
      return
    }
    setSubmitting(true)
    setError('')
    const weekday = weekdayFor(date)
    const mealPlan: MealPlanInput = {
      date, weekday, meal, menu, totalHostelStudents: totalStudents, expectedStudents,
      dayStatus, event: event.trim(), notes: notes.trim(),
    }
    try {
      const savedMeal: ApiMeal = await api.createMeal({
        date, day: weekday, mealType: meal, menu,
        hostelStudents: totalStudents, expectedStudents,
        holiday: dayStatus === 'Holiday',
        collegeStatus: dayStatus === 'College Day' ? 'College Day' : 'Non-college Day',
        event: event.trim(), notes: notes.trim(),
      })
      const prediction = predictDemand({
        menu, weekday, expectedStudents,
        isCollegeDay: dayStatus === 'College Day',
        isHoliday: dayStatus === 'Holiday',
        history: toPredictionHistory(history),
      })
      const result: MealPlanResult = { mealId: savedMeal.id, mealPlan, prediction }
      navigate('/ai-recommendation', { state: result })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save the meal plan.')
    } finally {
      setSubmitting(false)
    }
  }

  return <div className="content planning-content">
    <div className="planning-heading">
      <div><small className="eyebrow">MESS OPERATIONS · MEAL PLANNING</small><h1>Plan today’s meal</h1><p>Set the service details and attendance outlook before generating a demand recommendation.</p></div>
      <span className="planning-local"><CheckCircle2 size={15}/>{loading ? 'Connecting to meal service' : 'Connected to meal service'}</span>
    </div>
    <div className="planning-layout">
      <form className="card planning-form" onSubmit={submit} noValidate>
        <div className="form-section-heading"><i><ClipboardList size={18}/></i><div><h2>Meal details</h2><p>Choose a date and service to load its weekly menu.</p></div></div>
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-grid">
          <label className="field"><span>Date <b>*</b></span><input type="date" value={date} onChange={e => changeDate(e.target.value)} required/><small>Menu follows the selected day’s weekly schedule.</small></label>
          <label className="field"><span>Meal <b>*</b></span><select value={meal} onChange={e => changeMeal(e.target.value as MealName)}><option>Lunch</option><option>Dinner</option></select><small>Select the service to plan.</small></label>
          <label className="field"><span>Menu <b>*</b></span><select value={menu} onChange={e => changeMenu(e.target.value)} required disabled={loading || menus.length === 0}>{menus.map(option => <option key={option} value={option}>{option}{option === scheduledMenu(date, meal, menuRows) ? ' · scheduled' : ''}</option>)}</select><small>Suggested for {weekdayFor(date)}; change if the menu differs.</small></label>
          <label className="field"><span>College day / holiday <b>*</b></span><select value={dayStatus} onChange={e => setDayStatus(e.target.value as DayStatus)}><option>College Day</option><option>Non-college Day</option><option>Holiday</option></select><small>Used to adjust the attendance pattern.</small></label>
          <label className="field"><span>Total hostel students <b>*</b></span><div className="input-with-icon"><Users size={16}/><input type="number" min="1" step="1" value={totalStudents || ''} onChange={e => setTotalStudents(Number(e.target.value))} required/></div><small>Typical total based on saved meal plans.</small></label>
          <label className="field"><span>Expected students <b>*</b></span><div className="input-with-icon"><Users size={16}/><input type="number" min="1" step="1" value={expectedStudents || ''} onChange={e => setExpectedStudents(Number(e.target.value))} required/></div><small>Estimate attendance for this service.</small></label>
          <label className="field field-full"><span>Optional event</span><input type="text" value={event} onChange={e => setEvent(e.target.value)} placeholder="e.g. Inter-college tournament"/><small>Events are saved with this plan for context.</small></label>
          <label className="field field-full"><span>Notes</span><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Add any preparation notes for the mess team."/></label>
        </div>
        <div className="form-actions"><span><b>*</b> Required fields</span><button className="button planning-submit" type="submit" disabled={submitting || loading}><Sparkles size={17}/>{submitting ? 'Saving meal plan…' : 'Generate AI Recommendation'}</button></div>
      </form>
      <aside className="planning-aside">
        <section className="card schedule-card"><div className="schedule-heading"><i><CalendarDays size={17}/></i><div><small>WEEKLY MENU</small><h2>{weekdayFor(date)} schedule</h2></div></div><div className="schedule-row"><span>Lunch</span><b>{lunchMenu ?? (loading ? 'Loading…' : 'Not configured')}</b></div><div className="schedule-row"><span>Dinner</span><b>{dinnerMenu ?? (loading ? 'Loading…' : 'Not configured')}</b></div><p>Your selected {meal.toLowerCase()} menu is <strong>{menu || 'not selected'}</strong>.</p></section>
        <section className="card planning-info"><div><GraduationCap size={18}/><h2>What shapes the estimate?</h2></div><ul><li>Past consumption for the selected menu</li><li>Weekday attendance patterns</li><li>Expected students and college status</li><li>A modest safety buffer for serving</li></ul><span><Sparkles size={14}/> Transparent, history-based forecast</span></section>
      </aside>
    </div>
  </div>
}
