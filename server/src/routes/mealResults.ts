import { Router } from 'express'
import { getMealResults, postMealResult } from '../controllers/mealResultsController.js'
import { validateBody } from '../middleware/validate.js'
import { mealResultSchema } from '../schemas.js'

const router = Router()
router.post('/', validateBody(mealResultSchema), postMealResult)
router.get('/', getMealResults)
export default router
