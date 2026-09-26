import express from 'express'
import cors from 'cors'
import mealsRouter from './routes/meals.js'
import mealResultsRouter from './routes/mealResults.js'
import menuRouter from './routes/menu.js'
import holidaysRouter from './routes/holidays.js'
import historyRouter from './routes/history.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

export const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173' }))
app.use(express.json({ limit: '100kb' }))

app.get('/api/health', (_request, response) => response.json({ status: 'ok' }))
app.use('/api/meals', mealsRouter)
app.use('/api/meal-results', mealResultsRouter)
app.use('/api/menu', menuRouter)
app.use('/api/holidays', holidaysRouter)
app.use('/api', historyRouter)
app.use(notFound)
app.use(errorHandler)
