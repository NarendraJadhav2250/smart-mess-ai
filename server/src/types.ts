export const weekdays = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const

export type Weekday = typeof weekdays[number]
export type MealType = 'Lunch' | 'Dinner'
export type CollegeStatus = 'College Day' | 'Non-college Day'
