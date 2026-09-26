import type { ErrorRequestHandler, RequestHandler } from 'express'
import { Prisma } from '@prisma/client'
import { ZodError } from 'zod'
import { HttpError } from './httpError.js'

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: 'Route not found' })
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      error: 'Validation failed',
      details: error.issues.map(issue => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message })
    return
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      response.status(409).json({ error: 'A record with this value already exists' })
      return
    }
    if (error.code === 'P2025') {
      response.status(404).json({ error: 'The requested record was not found' })
      return
    }
  }

  console.error(error)
  response.status(500).json({ error: 'Internal server error' })
}
