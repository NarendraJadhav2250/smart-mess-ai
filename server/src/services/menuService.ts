import { prisma } from './prisma.js'
import type { z } from 'zod'
import { menuSchema } from '../schemas.js'

type MenuInput = z.infer<typeof menuSchema>
const order = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export async function listMenu() {
  const rows = await prisma.menuMaster.findMany()
  return rows.sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day))
}

export function saveMenu(input: MenuInput) {
  return prisma.menuMaster.upsert({
    where: { day: input.day },
    create: input,
    update: { lunch: input.lunch, dinner: input.dinner },
  })
}
