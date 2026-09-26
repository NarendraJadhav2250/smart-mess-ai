import { prisma } from './prisma.js'
import { HttpError } from '../middleware/httpError.js'
import type { z } from 'zod'
import { mealResultSchema } from '../schemas.js'

type CreateMealResultInput = z.infer<typeof mealResultSchema>

export async function saveMealResult(input: CreateMealResultInput) {
  const meal = await prisma.meal.findUnique({ where: { id: input.mealId } })
  if (!meal) throw new HttpError(404, 'Meal not found')

  const waste = Math.max(input.preparedQuantity - input.consumedQuantity, 0)
  const shortage = Math.max(input.consumedQuantity - input.preparedQuantity, 0)
  const wastePercentage = input.preparedQuantity === 0
    ? 0
    : Number(((waste / input.preparedQuantity) * 100).toFixed(2))
  const predictionError = Math.abs(input.predictedConsumption - input.consumedQuantity)

  return prisma.mealResult.upsert({
    where: { mealId: input.mealId },
    create: { ...input, waste, shortage, wastePercentage, predictionError },
    update: { ...input, waste, shortage, wastePercentage, predictionError },
    include: { meal: true },
  })
}

export function listMealResults() {
  return prisma.mealResult.findMany({
    include: { meal: true },
    orderBy: { createdAt: 'desc' },
  })
}
