import { app } from './app.js'
import { prisma } from './services/prisma.js'

const port = Number(process.env.PORT ?? 3001)
const server = app.listen(port, () => {
  console.log('Smart Mess API listening on http://localhost:' + port)
})

async function shutdown() {
  server.close()
  await prisma.$disconnect()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
