import type { RequestHandler } from 'express'
import { prisma } from '../services/prisma.js'
import { listHolidays, createHoliday } from '../services/holidayService.js'

export const getHolidays: RequestHandler = async (_request, response) => {
  const holidays = await listHolidays()
  response.json(holidays.map(row => ({ ...row, date: row.date.toISOString().slice(0, 10) })))
}

export const postHoliday: RequestHandler = async (request, response) => {
  const holiday = await createHoliday(request.body)
  response.status(201).json({ ...holiday, date: holiday.date.toISOString().slice(0, 10) })
}
