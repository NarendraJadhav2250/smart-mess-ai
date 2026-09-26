import { Router } from 'express'
import { getMealAnalytics, getMealHistory } from '../controllers/historyController.js'

const router = Router()
router.get('/history', getMealHistory)
router.get('/analytics', getMealAnalytics)
export default router
