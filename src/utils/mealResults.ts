import type { MealRecord } from '../types'
import { mockHistory } from '../data/mockHistory'

const STORAGE_KEY = 'smart-mess-consumption-results'

export function getSavedMealResults(): MealRecord[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    return Array.isArray(saved) ? saved as MealRecord[] : []
  } catch {
    return []
  }
}

export function saveMealResult(record: MealRecord): MealRecord[] {
  const saved = getSavedMealResults()
  const key = (row: MealRecord) => row.date + '|' + row.meal
  const next = [...saved.filter(row => key(row) !== key(record)), record]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  return next
}

export function getMealHistory(): MealRecord[] {
  const combined = new Map<string, MealRecord>()
  for (const record of mockHistory) combined.set(record.date + '|' + record.meal, record)
  for (const record of getSavedMealResults()) combined.set(record.date + '|' + record.meal, record)
  return [...combined.values()].sort((a, b) => b.date.localeCompare(a.date) || a.meal.localeCompare(b.meal))
}
