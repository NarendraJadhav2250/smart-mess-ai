import type { Prisma } from '@prisma/client'
import { prisma } from './prisma.js'
import type { z } from 'zod'
import { mealSchema, mealQuerySchema } from '../schemas.js'

export type CreateMealInput = z.infer<typeof mealSchema>
export type MealFilters = z.infer<typeof mealQuerySchema>

export function createMeal(input: CreateMealInput) {
  return prisma.meal.create({
    data: { ...input, date: new Date(input.date + 'T00:00:00.000Z') },
    include: { result: true },
  })
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
