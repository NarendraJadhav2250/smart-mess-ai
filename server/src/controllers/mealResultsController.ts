import type { RequestHandler } from 'express'
import { mealResultSchema } from '../schemas.js'
import { listMealResults, saveMealResult } from '../services/mealResultService.js'

export const postMealResult: RequestHandler = async (request, response) => {
  const input = mealResultSchema.parse(request.body)
  response.status(201).json(await saveMealResult(input))
}

export const getMealResults: RequestHandler = async (_request, response) => {
  response.json(await listMealResults())
}
