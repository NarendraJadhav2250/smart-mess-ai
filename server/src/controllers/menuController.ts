import type { RequestHandler } from 'express'
import { listMenu, saveMenu } from '../services/menuService.js'

export const getMenu: RequestHandler = async (_request, response) => {
  response.json(await listMenu())
}

export const postMenu: RequestHandler = async (request, response) => {
  response.status(201).json(await saveMenu(request.body))
}
