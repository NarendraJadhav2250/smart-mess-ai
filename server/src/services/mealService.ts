import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import type { z } from 'zod'
import { mealSchema, mealQuerySchema } from '../schemas.js'
import { HttpError } from '../middleware/httpError.js'

export type CreateMealInput = z.infer<typeof mealSchema>
export type MealFilters = z.infer<typeof mealQuerySchema>

export async function createMeal(input: CreateMealInput) {
  const date = new Date(input.date + 'T00:00:00.000Z')
  const duplicateMessage = `${input.mealType} is already planned for this date.`
  const existing = await prisma.meal.findFirst({ where: { date, mealType: input.mealType } })
  if (existing) throw new HttpError(409, duplicateMessage)

  try {
    return await prisma.meal.create({
      data: { ...input, date },
      include: { result: true },
    })
  } catch (error) {
    // The database constraint handles concurrent requests that pass the lookup together.
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
      throw new HttpError(409, duplicateMessage)
    }
    throw error
  }
}

export function listMeals(filters: MealFilters) {
  const where: Prisma.MealWhereInput = {}
  if (filters.date) where.date = new Date(filters.date + 'T00:00:00.000Z')
  if (filters.mealType) where.mealType = filters.mealType
  if (filters.menu) where.menu = { contains: filters.menu }
  return prisma.meal.findMany({
    where,
    include: { result: true },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: filters.limit,
  })
}

export function findMeal(id: string) {
  return prisma.meal.findUnique({ where: { id }, include: { result: true } })
}
