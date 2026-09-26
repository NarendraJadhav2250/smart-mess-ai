import { once } from 'node:events'
import { app } from '../src/app.js'
import { prisma } from '../src/services/prisma.js'

function todayLocal() {
  const now = new Date()
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-')
}

async function main() {
  const date = todayLocal()
  const day = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })
  const server = app.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Could not start the temporary API listener.')
  const baseUrl = `http://127.0.0.1:${address.port}/api`

  async function request<T>(path: string, init?: RequestInit) {
    const response = await fetch(baseUrl + path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
    const body = await response.json().catch(() => ({})) as T & { error?: string }
    return { response, body }
  }

  function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message)
  }

  try {
    const mealInput = (mealType: 'Lunch' | 'Dinner', menu: string, expectedStudents: number) => ({
      date,
      day,
      mealType,
      menu,
      hostelStudents: 432,
      expectedStudents,
      holiday: false,
      collegeStatus: 'Non-college Day',
      event: '',
      notes: 'Final MVP flow verification',
    })

    const existingHistory = await request<Array<{ id: string; date: string; mealType: string; menu: string; expectedStudents: number }>>('/history')
    assert(existingHistory.response.ok, `Initial history request failed: ${existingHistory.response.status}`)
    const existingToday = existingHistory.body.filter(row => row.date.slice(0, 10) === date)
    let lunchId: string
    let dinnerId: string
    if (!existingToday.length) {
      const lunchCreate = await request<{ id: string }>('/meals', { method: 'POST', body: JSON.stringify(mealInput('Lunch', 'Sambar', 375)) })
      assert(lunchCreate.response.status === 201, `Lunch creation failed: ${lunchCreate.body.error ?? lunchCreate.response.status}`)
      const dinnerCreate = await request<{ id: string }>('/meals', { method: 'POST', body: JSON.stringify(mealInput('Dinner', 'Rice', 403)) })
      assert(dinnerCreate.response.status === 201, `Dinner creation failed: ${dinnerCreate.body.error ?? dinnerCreate.response.status}`)
      lunchId = lunchCreate.body.id
      dinnerId = dinnerCreate.body.id
    } else {
      assert(existingToday.length === 2, `Expected an empty day or the exact two-meal demo pair; found ${existingToday.length} rows.`)
      const existingLunch = existingToday.find(row => row.mealType === 'Lunch')
      const existingDinner = existingToday.find(row => row.mealType === 'Dinner')
      assert(existingLunch?.menu === 'Sambar' && existingLunch.expectedStudents === 375, 'Existing Lunch does not match the requested demo data.')
      assert(existingDinner?.menu === 'Rice' && existingDinner.expectedStudents === 403, 'Existing Dinner does not match the requested demo data.')
      lunchId = existingLunch.id
      dinnerId = existingDinner.id
    }

    const lunchPrediction = await request<{ predictedConsumption: number; recommendedQuantity: number; historicalRecordsUsed: number }>('/predictions', {
      method: 'POST', body: JSON.stringify({ mealId: lunchId }),
    })
    assert(lunchPrediction.response.ok, `Lunch prediction failed: ${lunchPrediction.body.error ?? lunchPrediction.response.status}`)
    assert(lunchPrediction.body.historicalRecordsUsed > 0, 'Lunch prediction did not use historical results.')
    assert(lunchPrediction.body.predictedConsumption !== 375, 'Lunch prediction unexpectedly equals expected attendance.')

    const duplicateLunch = await request<{ error?: string }>('/meals', { method: 'POST', body: JSON.stringify(mealInput('Lunch', 'Sambar', 375)) })
    assert(duplicateLunch.response.status === 409 && duplicateLunch.body.error === 'Lunch is already planned for this date.', 'Duplicate Lunch was not rejected with the required message.')

    const duplicateDinner = await request<{ error?: string }>('/meals', { method: 'POST', body: JSON.stringify(mealInput('Dinner', 'Rice', 403)) })
    assert(duplicateDinner.response.status === 409 && duplicateDinner.body.error === 'Dinner is already planned for this date.', 'Duplicate Dinner was not rejected with the required message.')

    const dinnerPrediction = await request<{ predictedConsumption: number; recommendedQuantity: number; historicalRecordsUsed: number }>('/predictions', {
      method: 'POST', body: JSON.stringify({ mealId: dinnerId }),
    })
    assert(dinnerPrediction.response.ok, `Dinner prediction failed: ${dinnerPrediction.body.error ?? dinnerPrediction.response.status}`)
    assert(dinnerPrediction.body.historicalRecordsUsed > 0, 'Dinner prediction did not use historical results.')
    assert(dinnerPrediction.body.predictedConsumption !== 403, 'Dinner prediction unexpectedly equals expected attendance.')

    const lunchResult = await request<{ waste: number; shortage: number; wastePercentage: number; predictionError: number }>('/meal-results', {
      method: 'POST',
      body: JSON.stringify({
        mealId: lunchId,
        predictedConsumption: lunchPrediction.body.predictedConsumption,
        recommendedQuantity: lunchPrediction.body.recommendedQuantity,
        preparedQuantity: 350,
        consumedQuantity: 330,
      }),
    })
    assert(lunchResult.response.status === 201, `Lunch result save failed: ${lunchResult.body.error ?? lunchResult.response.status}`)
    assert(lunchResult.body.waste === 20 && lunchResult.body.shortage === 0 && lunchResult.body.wastePercentage === 5.71, 'Lunch waste/shortage calculations do not match 350 prepared and 330 consumed.')

    const history = await request<Array<{
      id: string; date: string; mealType: string; expectedStudents: number; recommendedQuantity: number | null
      preparedQuantity: number | null; consumedQuantity: number | null; waste: number | null; shortage: number | null
    }>>('/history')
    assert(history.response.ok, `History request failed: ${history.response.status}`)
    const today = history.body.filter(row => row.date.slice(0, 10) === date)
    assert(today.length === 2, `Expected exactly two Dashboard rows for today, found ${today.length}.`)
    assert(today.filter(row => row.mealType === 'Lunch').length === 1 && today.filter(row => row.mealType === 'Dinner').length === 1, 'Today does not contain exactly one Lunch and one Dinner.')
    assert(today.reduce((sum, row) => sum + row.expectedStudents, 0) === 778, 'Dashboard expected attendance did not total 778.')
    const lunch = today.find(row => row.mealType === 'Lunch')!
    const dinner = today.find(row => row.mealType === 'Dinner')!
    const recommendedTotal = (lunch.recommendedQuantity ?? lunchPrediction.body.recommendedQuantity) + (dinner.recommendedQuantity ?? dinnerPrediction.body.recommendedQuantity)
    assert(recommendedTotal === lunchPrediction.body.recommendedQuantity + dinnerPrediction.body.recommendedQuantity, 'Dashboard recommendations do not match the two backend predictions.')
    assert(lunch.preparedQuantity === 350 && lunch.consumedQuantity === 330 && lunch.waste === 20 && lunch.shortage === 0, 'Saved Lunch result is not present in Dashboard history.')

    console.log(JSON.stringify({
      date,
      meals: today.map(row => ({ id: row.id, mealType: row.mealType, menu: row.mealType === 'Lunch' ? 'Sambar' : 'Rice', expectedStudents: row.expectedStudents, predictedConsumption: row.mealType === 'Lunch' ? lunchPrediction.body.predictedConsumption : dinnerPrediction.body.predictedConsumption, recommendedQuantity: row.recommendedQuantity ?? (row.mealType === 'Lunch' ? lunchPrediction.body.recommendedQuantity : dinnerPrediction.body.recommendedQuantity), preparedQuantity: row.preparedQuantity, consumedQuantity: row.consumedQuantity, waste: row.waste, shortage: row.shortage })),
      expectedMealAttendance: 778,
      aiRecommendedServings: recommendedTotal,
      duplicateLunchRejected: duplicateLunch.body.error,
      duplicateDinnerRejected: duplicateDinner.body.error,
      historicalRecordsUsed: { Lunch: lunchPrediction.body.historicalRecordsUsed, Dinner: dinnerPrediction.body.historicalRecordsUsed },
      wastePercentage: lunchResult.body.wastePercentage,
      verification: 'passed',
    }, null, 2))
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
