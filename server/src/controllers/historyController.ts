import type { RequestHandler } from 'express'
import { z } from 'zod'
import { getAnalytics, getHistory } from '../services/historyService.js'

const querySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  mealType: z.enum(['Lunch', 'Dinner']).optional(),
  menu: z.string().trim().min(1).optional(),
})

export const getMealHistory: RequestHandler = async (request, response) => {
  response.json(await getHistory(querySchema.parse(request.query)))
}

export const getMealAnalytics: RequestHandler = async (_request, response) => {
  response.json(await getAnalytics())
}
