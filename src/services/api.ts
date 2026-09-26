export type ApiMenu = { id: string; day: string; lunch: string; dinner: string }
export type ApiMeal = {
  id: string
  date: string
  day: string
  mealType: 'Lunch' | 'Dinner'
  menu: string
  hostelStudents: number
  expectedStudents: number
  holiday: boolean
  collegeStatus: 'College Day' | 'Non-college Day'
  event: string
  notes: string
  result?: ApiMealResult | null
}
export type ApiMealResult = {
  id: string
  mealId: string
  predictedConsumption: number
  recommendedQuantity: number
  preparedQuantity: number
  consumedQuantity: number
  waste: number
  shortage: number
  wastePercentage: number
  predictionError: number
}
export type CreateMealPayload = Omit<ApiMeal, 'id' | 'result' | 'date'> & { date: string }
export type CreateMealResultPayload = Pick<ApiMealResult, 'mealId' | 'predictedConsumption' | 'recommendedQuantity' | 'preparedQuantity' | 'consumedQuantity'>
export type ApiPrediction = {
  predictedConsumption: number
  recommendedQuantity: number
  confidence: 'high' | 'medium' | 'low'
  explanation: string
  historicalRecordsUsed: number
}
export type ApiHistoryRecord = ApiMeal & {
  weekday: string
  totalHostelStudents: number
  isHoliday: boolean
  isCollegeDay: boolean
  preparedQuantity: number | null
  consumedQuantity: number | null
  predictedDemand: number | null
  recommendedQuantity: number | null
  waste: number | null
  shortage: number | null
  wastePercentage: number | null
  predictionError: number | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch('/api' + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = typeof body.error === 'string' ? body.error : 'The server request failed.'
    throw new Error(message)
  }
  return body as T
}

export const api = {
  getMenu: () => request<ApiMenu[]>('/menu'),
  getHistory: () => request<ApiHistoryRecord[]>('/history'),
  getMeals: (limit = 100) => request<ApiMeal[]>('/meals?limit=' + limit),
  createMeal: (meal: CreateMealPayload) => request<ApiMeal>('/meals', {
    method: 'POST',
    body: JSON.stringify(meal),
  }),
  createMealResult: (result: CreateMealResultPayload) => request<ApiMealResult>('/meal-results', {
    method: 'POST',
    body: JSON.stringify(result),
  }),
  createPrediction: (mealId: string) => request<ApiPrediction>('/predictions', {
    method: 'POST',
    body: JSON.stringify({ mealId }),
  }),
}
