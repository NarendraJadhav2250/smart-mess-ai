import type { RequestHandler } from 'express'
import { predictionSchema } from '../schemas.js'
import { predictMealDemand } from '../services/predictionService.js'

export const postPrediction: RequestHandler = async (request, response) => {
  const { mealId } = predictionSchema.parse(request.body)
  response.json(await predictMealDemand(mealId))
}
