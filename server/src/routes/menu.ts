import { Router } from 'express'
import { getMenu, postMenu } from '../controllers/menuController.js'
import { validateBody } from '../middleware/validate.js'
import { menuSchema } from '../schemas.js'

const router = Router()
router.get('/', getMenu)
router.post('/', validateBody(menuSchema), postMenu)
export default router
