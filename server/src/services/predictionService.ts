import { prisma } from './prisma.js'
import { HttpError } from '../middleware/httpError.js'

const MIN_HISTORY_RECORDS = 3

function getSafetyBufferPercent() {
  const configured = Number(process.env.DEMAND_SAFETY_BUFFER_PERCENT ?? 5)
  return Number.isFinite(configured) && configured >= 0 && configured <= 100 ? configured : 5
}

export async function predictMealDemand(mealId: string) {
  const meal = await prisma.meal.findUnique({ where: { id: mealId } })
  if (!meal) throw new HttpError(404, 'Meal not found')

  const completedMeals = await prisma.meal.findMany({
    where: { id: { not: meal.id }, result: { isNot: null } },
    include: { result: true },
  })
  const history = completedMeals.flatMap(row => row.result ? [{
    menu: row.menu,
    mealType: row.mealType,
    day: row.day,
    expectedStudents: row.expectedStudents,
    consumedQuantity: row.result.consumedQuantity,
  }] : [])
  const sameMenu = history.filter(row => row.menu.trim().toLocaleLowerCase() === meal.menu.trim().toLocaleLowerCase())
  const sameMenuAndMeal = sameMenu.filter(row => row.mealType === meal.mealType)
  const sameMealAndDay = history.filter(row => row.mealType === meal.mealType && row.day === meal.day)

  let samples = [] as typeof history
  let source = ''
  if (sameMenuAndMeal.length >= MIN_HISTORY_RECORDS) {
    samples = sameMenuAndMeal
    source = `the ${samples.length} completed ${meal.menu} ${meal.mealType.toLowerCase()} records`
  } else if (sameMenu.length) {
    samples = sameMenu
    source = `the ${samples.length} completed records for ${meal.menu}`
  } else if (sameMealAndDay.length) {
    samples = sameMealAndDay
    source = `the ${samples.length} completed ${meal.mealType.toLowerCase()} records from ${meal.day}`
  }

  const historicalRecordsUsed = samples.length
  const baseline = samples.length
    ? samples.reduce((sum, row) => sum + row.consumedQuantity / Math.max(row.expectedStudents, 1), 0) / samples.length * meal.expectedStudents
    : meal.expectedStudents
  const predictedConsumption = Math.max(0, Math.round(baseline))
  const safetyBufferPercent = getSafetyBufferPercent()
  const recommendedQuantity = Math.ceil(predictedConsumption * (1 + safetyBufferPercent / 100))
  const confidence = historicalRecordsUsed >= 5 ? 'high' : historicalRecordsUsed >= 2 ? 'medium' : 'low'
  const dayContext = meal.holiday
    ? 'The planned meal is marked as a holiday.'
    : `The planned meal is marked ${meal.collegeStatus.toLowerCase()}.`
  const baselineExplanation = historicalRecordsUsed
    ? `Estimated ${predictedConsumption} portions using ${source}, scaled to ${meal.expectedStudents} expected students.`
    : `No matching completed history was available for this menu, meal type, or weekday; used the expected attendance baseline of ${meal.expectedStudents}.`
  const explanation = `Based on historical meal consumption. ${baselineExplanation} ${dayContext} Applied a ${safetyBufferPercent}% safety buffer to recommend ${recommendedQuantity} portions.`

  return { predictedConsumption, recommendedQuantity, confidence, explanation, historicalRecordsUsed }
}
