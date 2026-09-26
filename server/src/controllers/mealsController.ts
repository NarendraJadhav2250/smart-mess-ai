import type { RequestHandler } from 'express'
import { mealQuerySchema } from '../schemas.js'
import { findMeal, createMeal, listMeals } from '../services/mealService.js'
import { HttpError } from '../middleware/httpError.js'

export const postMeal: RequestHandler = async (request, response) => {
  const meal = await createMeal(request.body)
  response.status(201).json(meal)
}

export const getMeals: RequestHandler = async (request, response) => {
  const filters = mealQuerySchema.parse(request.query)
  response.json(await listMeals(filters))
}

export const getMeal: RequestHandler = async (request, response) => {
  const meal = await findMeal(String(request.params.id))
  if (!meal) throw new HttpError(404, 'Meal not found')
  response.json(meal)
}
