import { useMemo, useState } from 'react'
import { CalendarDays, FilterX, History as HistoryIcon, Search } from 'lucide-react'
import { useEffect } from 'react'
import { api, type ApiHistoryRecord } from '../services/api'

function dateLabel(value: string) {
  return new Date(value + 'T12:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function statusFor(record: ApiHistoryRecord) {
  if (record.isHoliday) return 'Holiday'
  if (record.isCollegeDay) return 'College Day'
  return 'Non-college Day'
}
export default function HistoryPage() {
  const [records, setRecords] = useState<ApiHistoryRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    api.getHistory().then(rows => {
      if (active) setRecords(rows)
    }).catch(reason => {
      if (active) setError(reason instanceof Error ? reason.message : 'Could not load meal history.')
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const menus = useMemo(() => [...new Set(records.map(record => record.menu))].sort((a,b)=>a.localeCompare(b)), [records])
  const [date, setDate] = useState('')
  const [meal, setMeal] = useState('')
  const [menu, setMenu] = useState('')
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const filtered = useMemo(() => records.filter(record => {
    const hasResult = record.preparedQuantity !== null && record.consumedQuantity !== null
    const waste = hasResult ? record.waste ?? 0 : 0
    const shortage = hasResult ? record.shortage ?? 0 : 0
    const query = search.trim().toLowerCase()
    const queryMatch = !query || [record.date, record.weekday, record.mealType, record.menu].some(value => value.toLowerCase().includes(query))
    const statusMatch = !status || (status === 'holiday' ? record.isHoliday : status === 'college' ? record.isCollegeDay && !record.isHoliday : !record.isCollegeDay && !record.isHoliday)
    return (!date || record.date === date) && (!meal || record.mealType === meal) && (!menu || record.menu === menu) && statusMatch && queryMatch && waste >= 0 && shortage >= 0
  }), [records,date,meal,menu,status,search])
  const hasFilters = Boolean(date || meal || menu || status || search)
  const clearFilters = () => { setDate(''); setMeal(''); setMenu(''); setStatus(''); setSearch('') }

  return <div className="content records-content history-content">
    {error&&<div className="form-error" role="alert">{error}</div>}
    <div className="records-heading"><div><small className="eyebrow">MESS OPERATIONS · RECORDS</small><h1>Meal history</h1><p>Review demand predictions, actual servings, and meal outcomes.</p></div><span><HistoryIcon size={16}/>{filtered.length} of {records.length} records</span></div>
    <section className="card history-toolbar" aria-label="History filters">
      <div className="history-search"><Search size={16}/><input aria-label="Search history" type="search" placeholder="Search menu, meal, day…" value={search} onChange={event=>setSearch(event.target.value)}/></div>
      <label className="history-filter"><span>Date</span><input aria-label="Filter by date" type="date" value={date} onChange={event=>setDate(event.target.value)}/></label>
      <label className="history-filter"><span>Meal</span><select aria-label="Filter by meal" value={meal} onChange={event=>setMeal(event.target.value)}><option value="">All meals</option><option>Lunch</option><option>Dinner</option></select></label>
      <label className="history-filter"><span>Menu</span><select aria-label="Filter by menu" value={menu} onChange={event=>setMenu(event.target.value)}><option value="">All menus</option>{menus.map(item=><option key={item}>{item}</option>)}</select></label>
      <label className="history-filter"><span>College / Holiday</span><select aria-label="Filter by college or holiday status" value={status} onChange={event=>setStatus(event.target.value)}><option value="">All statuses</option><option value="college">College Day</option><option value="holiday">Holiday</option><option value="non-college">Non-college Day</option></select></label>
      {hasFilters&&<button className="history-clear" type="button" onClick={clearFilters}><FilterX size={14}/>Clear filters</button>}
    </section>
    <section className="card records-card history-card">
      <div className="history-table-caption"><span><CalendarDays size={14}/>Historical meal performance</span><small>Scroll horizontally to see every measure</small></div>
      <div className="records-table-wrap history-table-wrap" role="region" aria-label="Historical meal records table" tabIndex={0}>
        <table className="records-table history-table"><thead><tr><th>Date</th><th>Day</th><th>Meal</th><th>Menu &amp; status</th><th>Expected students</th><th>AI recommended</th><th>Prepared</th><th>Consumed</th><th>Waste</th><th>Shortage</th><th>Prediction error</th></tr></thead>
        <tbody>{loading?<tr><td colSpan={11} className="history-empty"><HistoryIcon size={20}/><b>Loading meal history</b></td></tr>:filtered.length?filtered.map((record,index)=>{
          const hasResult=record.preparedQuantity!==null&&record.consumedQuantity!==null
          const waste=hasResult?record.waste??0:0
          const shortage=hasResult?record.shortage??0:0
          const predictionError=hasResult?record.predictionError:null
          return <tr key={record.date+'-'+record.mealType+'-'+index}>
            <td>{dateLabel(record.date)}</td><td>{record.weekday}</td><td><span className="history-meal">{record.mealType}</span></td>
            <td><div className="history-menu"><b>{record.menu}</b><div className="history-badges"><span className={'history-badge '+(record.isHoliday?'badge-holiday':record.isCollegeDay?'badge-college':'badge-neutral')}>{statusFor(record)}</span>{!hasResult?<span className="history-badge badge-neutral">Awaiting result</span>:waste>0?<span className="history-badge badge-waste">Waste</span>:shortage>0?<span className="history-badge badge-shortage">Shortage</span>:<span className="history-badge badge-normal">Normal</span>}</div></div></td>
            <td>{record.expectedStudents}</td><td><b className="history-ai-value">{record.recommendedQuantity??'—'}</b></td><td>{record.preparedQuantity??'—'}</td><td>{record.consumedQuantity??'—'}</td>
            <td><span className={waste?'history-number-waste':''}>{hasResult?waste:'—'}</span></td><td><span className={shortage?'history-number-shortage':''}>{hasResult?shortage:'—'}</span></td><td>{predictionError??'—'}</td>
          </tr>
        }):<tr><td colSpan={11} className="history-empty"><HistoryIcon size={20}/><b>No matching meal records</b><span>Adjust or clear your filters to see more results.</span></td></tr>}</tbody></table>
      </div>
      <div className="records-foot"><FilterX size={14}/> Waste, shortage, and prediction error are calculated from each record’s source values.</div>
    </section>
  </div>
}
