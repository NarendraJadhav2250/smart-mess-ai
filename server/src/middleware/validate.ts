import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

export function validateBody<T>(schema: ZodType<T>) {
  return (request: Request, _response: Response, next: NextFunction) => {
    const result = schema.safeParse(request.body)
    if (!result.success) return next(result.error)
    request.body = result.data
    next()
  }
}
