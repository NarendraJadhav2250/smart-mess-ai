import { Router } from 'express'
import { getMeal, getMeals, postMeal } from '../controllers/mealsController.js'
import { validateBody } from '../middleware/validate.js'
import { mealSchema } from '../schemas.js'

const router = Router()
router.post('/', validateBody(mealSchema), postMeal)
router.get('/', getMeals)
router.get('/:id', getMeal)
export default router
