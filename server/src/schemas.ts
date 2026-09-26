import { z } from 'zod'
import { weekdays } from './types.js'

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .refine(value => {
    const date = new Date(value + 'T00:00:00.000Z')
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  }, 'Enter a valid calendar date')

export const mealSchema = z.object({
  date: dateString,
  day: z.enum(weekdays),
  mealType: z.enum(['Lunch', 'Dinner']),
  menu: z.string().trim().min(1).max(120),
  hostelStudents: z.number().int().min(1).max(100000),
  expectedStudents: z.number().int().min(1).max(100000),
  holiday: z.boolean().default(false),
  collegeStatus: z.enum(['College Day', 'Non-college Day']),
  event: z.string().trim().max(200).default(''),
  notes: z.string().trim().max(2000).default(''),
}).refine(value => value.expectedStudents <= value.hostelStudents, {
  path: ['expectedStudents'],
  message: 'Expected students cannot exceed hostel students',
})

export const mealQuerySchema = z.object({
  date: dateString.optional(),
  mealType: z.enum(['Lunch', 'Dinner']).optional(),
  menu: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(100),
})

export const mealResultSchema = z.object({
  mealId: z.string().min(1),
  predictedConsumption: z.number().int().min(0).max(100000),
  recommendedQuantity: z.number().int().min(0).max(100000),
  preparedQuantity: z.number().int().min(0).max(100000),
  consumedQuantity: z.number().int().min(0).max(100000),
})

export const menuSchema = z.object({
  day: z.enum(weekdays),
  lunch: z.string().trim().min(1).max(120),
  dinner: z.string().trim().min(1).max(120),
})

export const holidaySchema = z.object({
  date: dateString,
  name: z.string().trim().min(1).max(120),
})
