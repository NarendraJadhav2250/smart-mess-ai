import { Router } from 'express'
import { getHolidays, postHoliday } from '../controllers/holidaysController.js'
import { validateBody } from '../middleware/validate.js'
import { holidaySchema } from '../schemas.js'

const router = Router()
router.get('/', getHolidays)
router.post('/', validateBody(holidaySchema), postHoliday)
export default router
