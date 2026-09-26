import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'

type HistoryFilters = { from?: string; to?: string; mealType?: string; menu?: string }

export async function getHistory(filters: HistoryFilters = {}) {
  const where: Prisma.MealWhereInput = {}
  if (filters.from || filters.to) {
    where.date = {}
    if (filters.from) where.date.gte = new Date(filters.from + 'T00:00:00.000Z')
    if (filters.to) where.date.lte = new Date(filters.to + 'T00:00:00.000Z')
  }
  if (filters.mealType) where.mealType = filters.mealType
  if (filters.menu) where.menu = { contains: filters.menu }
  const meals = await prisma.meal.findMany({
    where,
    include: { result: true },
    orderBy: [{ date: 'desc' }, { mealType: 'asc' }],
  })
  return meals.map(meal => ({
    ...meal,
    date: meal.date.toISOString().slice(0, 10),
    weekday: meal.day,
    isHoliday: meal.holiday,
    isCollegeDay: !meal.holiday && meal.collegeStatus === 'College Day',
    totalHostelStudents: meal.hostelStudents,
    preparedQuantity: meal.result?.preparedQuantity ?? null,
    consumedQuantity: meal.result?.consumedQuantity ?? null,
    predictedDemand: meal.result?.predictedConsumption ?? null,
    recommendedQuantity: meal.result?.recommendedQuantity ?? null,
    waste: meal.result?.waste ?? null,
    shortage: meal.result?.shortage ?? null,
    wastePercentage: meal.result?.wastePercentage ?? null,
    predictionError: meal.result?.predictionError ?? null,
  }))
}

export async function getAnalytics() {
  const records = await prisma.meal.findMany({
    include: { result: true },
    orderBy: { date: 'asc' },
  })
  const completed = records.filter(row => row.result)
  const totals = completed.reduce((sum, row) => ({
    prepared: sum.prepared + row.result!.preparedQuantity,
    consumed: sum.consumed + row.result!.consumedQuantity,
    waste: sum.waste + row.result!.waste,
    shortage: sum.shortage + (row.result!.shortage > 0 ? 1 : 0),
    predictionError: sum.predictionError + row.result!.predictionError,
  }), { prepared: 0, consumed: 0, waste: 0, shortage: 0, predictionError: 0 })

  const byMenu = new Map<string, number>()
  const byDay = new Map<string, number>()
  const byDate = new Map<string, { date: string; prepared: number; consumed: number; predicted: number }>()
  for (const row of completed) {
    const result = row.result!
    byMenu.set(row.menu, (byMenu.get(row.menu) ?? 0) + result.waste)
    byDay.set(row.day, (byDay.get(row.day) ?? 0) + result.waste)
    const date = row.date.toISOString().slice(0, 10)
    const point = byDate.get(date) ?? { date, prepared: 0, consumed: 0, predicted: 0 }
    point.prepared += result.preparedQuantity
    point.consumed += result.consumedQuantity
    point.predicted += result.predictedConsumption
    byDate.set(date, point)
  }

  return {
    recordCount: completed.length,
    totalPrepared: totals.prepared,
    totalConsumed: totals.consumed,
    totalWaste: totals.waste,
    wasteRate: totals.prepared ? Number((totals.waste / totals.prepared * 100).toFixed(2)) : 0,
    shortageEvents: totals.shortage,
    averagePredictionError: completed.length ? Number((totals.predictionError / completed.length).toFixed(2)) : 0,
    wasteByMenu: [...byMenu].map(([menu, waste]) => ({ menu, waste })),
    wasteByDay: [...byDay].map(([day, waste]) => ({ day, waste })),
    preparedVsConsumed: [...byDate.values()],
    predictedVsActual: [...byDate.values()],
  }
}
