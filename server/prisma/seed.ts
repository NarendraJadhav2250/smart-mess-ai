import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const weeklyMenu = [
  { day: 'Monday', lunch: 'Vatana', dinner: 'Palkha' },
  { day: 'Tuesday', lunch: 'Muga', dinner: 'Kobi' },
  { day: 'Wednesday', lunch: 'Harbhara', dinner: 'Mataki' },
  { day: 'Thursday', lunch: 'Chole', dinner: 'Sambhar Batata' },
  { day: 'Friday', lunch: 'Masur', dinner: 'Shevaga' },
  { day: 'Saturday', lunch: 'Sambar', dinner: 'Rice' },
  { day: 'Sunday', lunch: 'Mataki', dinner: 'Soyabin' },
]

const menusByDay = Object.fromEntries(weeklyMenu.map(menu => [menu.day, menu]))
const expectedAttendance: Record<string, number[]> = {
  Monday: [418, 410, 423],
  Tuesday: [426, 414, 420],
  Wednesday: [420, 416, 408],
  Thursday: [438, 425, 430],
  Friday: [416, 405, 412],
  Saturday: [375, 366, 359],
  Sunday: [190, 170, 180],
}
const hostelCounts = [432, 428, 436]
const mealTypes = ['Lunch', 'Dinner'] as const
const dayOrder = weeklyMenu.map(menu => menu.day)
const actualOffsets = [2, -4, 5, -3, 7, -6, 0, 3, -8, 4, 1, -2]
const preparationOffsets = [-8, 10, 4, -12, 15, -4, -15, 6, 0, -9, 8, 3]
const seedPrefix = 'demo_seed_'

function startOfLocalTodayUtc() {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function buildDemoRows() {
  const today = startOfLocalTodayUtc()
  const occurrences: Record<string, number> = Object.fromEntries(dayOrder.map(day => [day, 0]))
  const rows = []

  for (let daysAgo = 20; daysAgo >= 0; daysAgo -= 1) {
    const date = new Date(today.getTime() - daysAgo * 24 * 60 * 60 * 1000)
    const day = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' })
    const occurrence = occurrences[day]++
    const dayIndex = dayOrder.indexOf(day)
    const holiday = day === 'Sunday' || (day === 'Wednesday' && occurrence === 1)
    const collegeStatus = holiday || day === 'Saturday' || (day === 'Friday' && occurrence === 2)
      ? 'Non-college Day'
      : 'College Day'
    const menu = menusByDay[day]
    const baseExpected = holiday && day === 'Wednesday'
      ? 245
      : expectedAttendance[day][occurrence]
    const event = day === 'Friday' && occurrence === 0 ? 'Inter-hostel sports event' : ''

    for (const [mealIndex, mealType] of mealTypes.entries()) {
      const hostelStudents = hostelCounts[(occurrence + dayIndex) % hostelCounts.length]
      const eventAttendance = event ? 10 : 0
      const dinnerAdjustment = mealIndex === 1 ? [14, 8, 10][occurrence] : 0
      const expectedStudents = Math.min(hostelStudents, baseExpected + eventAttendance - dinnerAdjustment)
      const consumptionRate = (mealIndex === 0 ? 0.975 : 0.95) + [0, -0.012, 0.008][occurrence]
      const predictedConsumption = Math.round(expectedStudents * consumptionRate)
      const recommendedQuantity = Math.ceil(predictedConsumption * 1.05)
      const offsetIndex = (dayIndex * 2 + occurrence + mealIndex * 3) % actualOffsets.length
      const consumedQuantity = Math.max(0, predictedConsumption + actualOffsets[offsetIndex])
      const preparedQuantity = Math.max(0, predictedConsumption + preparationOffsets[offsetIndex])
      const waste = Math.max(preparedQuantity - consumedQuantity, 0)
      const shortage = Math.max(consumedQuantity - preparedQuantity, 0)
      const wastePercentage = preparedQuantity > 0
        ? Number((waste / preparedQuantity * 100).toFixed(2))
        : 0
      const predictionError = Math.abs(predictedConsumption - consumedQuantity)
      const key = dateKey(date)

      rows.push({
        id: `${seedPrefix}${key.replaceAll('-', '')}_${mealType.toLowerCase()}`,
        date,
        day,
        mealType,
        menu: mealIndex === 0 ? menu.lunch : menu.dinner,
        hostelStudents,
        expectedStudents,
        holiday,
        collegeStatus,
        event,
        notes: 'Deterministic Smart Mess AI demo history.',
        result: {
          create: {
            predictedConsumption,
            recommendedQuantity,
            preparedQuantity,
            consumedQuantity,
            waste,
            shortage,
            wastePercentage,
            predictionError,
          },
        },
      })
    }
  }

  return rows
}

async function main() {
  for (const menu of weeklyMenu) {
    await prisma.menuMaster.upsert({
      where: { day: menu.day },
      create: menu,
      update: { lunch: menu.lunch, dinner: menu.dinner },
    })
  }
  const demoRows = buildDemoRows()
  await prisma.$transaction(async transaction => {
    await transaction.meal.deleteMany({ where: { id: { startsWith: seedPrefix } } })
    for (const row of demoRows) {
      await transaction.meal.create({ data: row })
    }
  })

  console.log(`Weekly menu seeded. ${demoRows.length} demo meals with results created.`)
  console.log('Sample:', JSON.stringify(demoRows[0]))
  console.log('Sample:', JSON.stringify(demoRows.at(-1)))
}

main()
  .catch(error => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
