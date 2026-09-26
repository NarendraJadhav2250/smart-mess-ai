import { prisma } from './prisma.js'
import type { z } from 'zod'
import { holidaySchema } from '../schemas.js'

type HolidayInput = z.infer<typeof holidaySchema>

export function listHolidays() {
  return prisma.holiday.findMany({ orderBy: { date: 'asc' } })
}

export function createHoliday(input: HolidayInput) {
  return prisma.holiday.create({
    data: { date: new Date(input.date + 'T00:00:00.000Z'), name: input.name },
  })
}
