import { Router } from 'express'
import { postPrediction } from '../controllers/predictionsController.js'
import { validateBody } from '../middleware/validate.js'
import { predictionSchema } from '../schemas.js'

const router = Router()
router.post('/', validateBody(predictionSchema), postPrediction)
export default router
